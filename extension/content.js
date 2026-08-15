/* =============================================================================
 * GovMatch Autofill — content.js  (content script)
 * =============================================================================
 * Runs in the page's DOM (but NOT its JS scope). It:
 *   - AUTOFILLS only non-sensitive fields it maps confidently (hierarchy 1-4),
 *     highlighting them GREEN with "review" notes.
 *   - GUIDES everything else, and ALWAYS sensitive fields, highlighting them
 *     YELLOW with a tooltip that says WHAT goes there, WHERE to get it, WARNINGS.
 *   - Highlights the "next step" button and tells the founder to click it —
 *     but NEVER clicks, submits, signs, or navigates.
 *
 * fieldMap.js runs before this file (same isolated world) and exposes
 * window.GOVMATCH_FIELD_MAP.
 * ============================================================================= */

(function () {
  "use strict";

  var FIELD_MAP =
    (typeof window !== "undefined" && window.GOVMATCH_FIELD_MAP) || { concepts: [] };

  var ANNOTATION_CLASS = "govmatch-annotation";
  var STYLE_ID = "govmatch-style";

  /* --------------------------- messaging entrypoint ------------------------- */

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || !msg.type) return;
    if (msg.type === "GOVMATCH_PING") {
      sendResponse({ ok: true, host: location.hostname });
      return;
    }
    if (msg.type === "GOVMATCH_CLEAR") {
      clearAnnotations();
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === "GOVMATCH_AUTOFILL") {
      try {
        var report = runAutofill(msg.data || {}, msg.lang === "es" ? "es" : "en");
        sendResponse({ ok: true, report: report });
      } catch (e) {
        console.error("[GovMatch] autofill error:", e);
        sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
      }
      return; // synchronous response
    }
  });

  /* ------------------------------- main routine ----------------------------- */

  function runAutofill(data, lang) {
    ensureStyle();
    clearAnnotations();

    var host = shortHost(location.hostname);
    var fields = Array.isArray(data.fields) ? data.fields : [];
    var drafts = Array.isArray(data.drafts) ? data.drafts : [];

    var claimed = new Set();
    var filled = [];
    var guided = [];
    var pending = [];

    // Treat both structured fields and long-form drafts as autofill candidates.
    var candidates = fields
      .map(function (f) {
        return { key: f.key, value: f.value, sensitive: !!f.sensitive, kind: "field" };
      })
      .concat(
        drafts.map(function (d) {
          return {
            key: d.label || d.key || "",
            value: d.value,
            sensitive: false,
            kind: "draft",
          };
        })
      );

    candidates.forEach(function (item) {
      var concept = matchConcept(item.key);
      var isSensitive = item.sensitive || (concept && concept.sensitive);
      var resolved = resolveTarget(concept, item, host, claimed);

      // No element on the page → manual step.
      if (!resolved) {
        pending.push({
          label: item.key,
          note: conceptGuide(concept, lang),
        });
        return;
      }

      claimed.add(resolved.el);

      // ALWAYS guide sensitive fields, regardless of confidence.
      // Guide anything matched only by loose/AI heuristic (level >= 5).
      var confident = resolved.level >= 1 && resolved.level <= 4;
      var alreadyFilled = hasValue(resolved.el);

      if (isSensitive || !confident || alreadyFilled) {
        guideField(resolved.el, {
          key: item.key,
          text: conceptGuide(concept, lang),
          sensitive: isSensitive,
          alreadyFilled: alreadyFilled,
          lang: lang,
        });
        guided.push({ label: item.key, sensitive: !!isSensitive });
        return;
      }

      // AUTOFILL (non-sensitive, confident, empty).
      var ok = setFieldValue(resolved.el, item.value);
      if (ok) {
        markFilled(resolved.el, lang);
        filled.push({ label: item.key });
      } else {
        guideField(resolved.el, {
          key: item.key,
          text: conceptGuide(concept, lang),
          sensitive: false,
          alreadyFilled: false,
          lang: lang,
        });
        guided.push({ label: item.key, sensitive: false });
      }
    });

    // Guide the "next step" button (never click it).
    var nextStep = highlightNextButton(lang);
    if (nextStep) pending.push(nextStep);

    return { filled: filled, guided: guided, pending: pending, host: host };
  }

  /* ----------------------- field-matching hierarchy ------------------------- */

  // Map a prefill field KEY to a concept via dataKeywords.
  function matchConcept(key) {
    var k = norm(key);
    if (!k) return null;
    var best = null;
    var bestScore = 0;
    (FIELD_MAP.concepts || []).forEach(function (c) {
      (c.dataKeywords || []).forEach(function (kw) {
        var nk = norm(kw);
        if (k.indexOf(nk) !== -1 || nk.indexOf(k) !== -1) {
          var score = nk.length; // prefer the longest keyword hit
          if (score > bestScore) {
            bestScore = score;
            best = c;
          }
        }
      });
    });
    return best;
  }

  // Resolve the best target element for a concept/item. Returns {el, level} or null.
  //   1 exact selector · 2 concept selectors · 3 label · 4 semantic · 5 best-guess
  function resolveTarget(concept, item, host, claimed) {
    // LEVEL 1 + 2: selectors from the fieldMap.
    if (concept && concept.selectors) {
      var hostSelectors = concept.selectors[host] || [];
      var el = firstFree(hostSelectors, claimed);
      if (el) return { el: el, level: 1 };

      // any-host selectors as a secondary exact attempt
      var all = [];
      Object.keys(concept.selectors).forEach(function (h) {
        all = all.concat(concept.selectors[h] || []);
      });
      el = firstFree(all, claimed);
      if (el) return { el: el, level: 2 };
    }

    var inputs = collectInputs().filter(function (i) {
      return !claimed.has(i);
    });

    // LEVEL 3: label text matching.
    if (concept && concept.labelKeywords) {
      var byLabel = findByText(inputs, concept.labelKeywords, function (input) {
        return labelTextFor(input);
      });
      if (byLabel) return { el: byLabel, level: 3 };
    }

    // LEVEL 4: semantic matching on name/id/placeholder/aria-label.
    if (concept && concept.semanticKeywords) {
      var bySemantic = findByText(inputs, concept.semanticKeywords, semanticString);
      if (bySemantic) return { el: bySemantic, level: 4 };
    }

    // LEVEL 5: AI/best-guess — loose match on the raw key. GUIDE ONLY.
    var loose = norm(item.key)
      .split(" ")
      .filter(function (w) {
        return w.length >= 4;
      });
    if (loose.length) {
      var guess = findByText(inputs, loose, function (input) {
        return labelTextFor(input) + " " + semanticString(input);
      });
      if (guess) return { el: guess, level: 5 };
    }

    // LEVEL 6: nothing on the page → manual (handled by caller as pending).
    return null;
  }

  function firstFree(selectors, claimed) {
    for (var i = 0; i < selectors.length; i++) {
      var nodes;
      try {
        nodes = document.querySelectorAll(selectors[i]);
      } catch (e) {
        continue;
      }
      for (var j = 0; j < nodes.length; j++) {
        if (isFillable(nodes[j]) && !claimed.has(nodes[j])) return nodes[j];
      }
    }
    return null;
  }

  function collectInputs() {
    var nodes = document.querySelectorAll(
      "input, textarea, select"
    );
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      if (isFillable(nodes[i])) out.push(nodes[i]);
    }
    return out;
  }

  function findByText(inputs, keywords, getText) {
    var normKw = keywords.map(norm);
    for (var i = 0; i < inputs.length; i++) {
      var text = norm(getText(inputs[i]));
      if (!text) continue;
      for (var k = 0; k < normKw.length; k++) {
        if (normKw[k] && text.indexOf(normKw[k]) !== -1) return inputs[i];
      }
    }
    return null;
  }

  /* ------------------------------- DOM helpers ------------------------------ */

  function isFillable(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toLowerCase();
    if (tag === "input") {
      var type = (el.getAttribute("type") || "text").toLowerCase();
      var skip = ["hidden", "submit", "button", "reset", "image", "file"];
      if (skip.indexOf(type) !== -1) return false;
    } else if (tag !== "textarea" && tag !== "select") {
      return false;
    }
    if (el.disabled || el.readOnly) return false;
    if (!isVisible(el)) return false;
    return true;
  }

  function isVisible(el) {
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    var style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function hasValue(el) {
    return el && typeof el.value === "string" && el.value.trim() !== "";
  }

  function labelTextFor(input) {
    // 1) explicit <label for="id">
    if (input.id) {
      var lbl = document.querySelector('label[for="' + cssEscape(input.id) + '"]');
      if (lbl) return lbl.textContent || "";
    }
    // 2) wrapping <label>
    var p = input.parentElement;
    var hops = 0;
    while (p && hops < 4) {
      if (p.tagName && p.tagName.toLowerCase() === "label") return p.textContent || "";
      p = p.parentElement;
      hops++;
    }
    // 3) aria-label / aria-labelledby
    var aria = input.getAttribute("aria-label");
    if (aria) return aria;
    var labelledby = input.getAttribute("aria-labelledby");
    if (labelledby) {
      var ref = document.getElementById(labelledby);
      if (ref) return ref.textContent || "";
    }
    return "";
  }

  function semanticString(input) {
    return [
      input.getAttribute("name"),
      input.getAttribute("id"),
      input.getAttribute("placeholder"),
      input.getAttribute("aria-label"),
    ]
      .filter(Boolean)
      .join(" ");
  }

  // Robustly set a value so React/Vue controlled inputs register the change.
  function setFieldValue(el, value) {
    if (value == null) return false;
    var str = String(value);
    var tag = el.tagName.toLowerCase();

    try {
      if (tag === "select") {
        var matched = false;
        for (var i = 0; i < el.options.length; i++) {
          var opt = el.options[i];
          if (
            norm(opt.value) === norm(str) ||
            norm(opt.textContent) === norm(str) ||
            norm(opt.textContent).indexOf(norm(str)) !== -1
          ) {
            el.value = opt.value;
            matched = true;
            break;
          }
        }
        if (!matched) return false;
      } else {
        setNativeValue(el, str);
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    } catch (e) {
      console.error("[GovMatch] setFieldValue failed:", e);
      return false;
    }
  }

  function setNativeValue(el, value) {
    var proto = el.tagName.toLowerCase() === "textarea"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto, "value");
    if (setter && setter.set) {
      setter.set.call(el, value);
    } else {
      el.value = value;
    }
  }

  /* ------------------------------- annotations ------------------------------ */

  function markFilled(el, lang) {
    el.classList.add("govmatch-filled");
    var note = makeNote(
      "govmatch-note-green",
      "✓ " +
        (lang === "es"
          ? "Lo rellené por ti — por favor revísalo"
          : "I filled this — please review")
    );
    insertNote(el, note);
    scrollIntoViewOnce(el);
  }

  function guideField(el, opts) {
    el.classList.add("govmatch-guide");
    var prefix = opts.alreadyFilled
      ? opts.lang === "es"
        ? "Ya tiene un valor — revísalo. "
        : "Already has a value — review it. "
      : "";
    var lockIcon = opts.sensitive ? "🔒 " : "⚠ ";
    var sensLabel = opts.sensitive
      ? opts.lang === "es"
        ? "Dato sensible — complétalo tú mismo. "
        : "Sensitive — enter this yourself. "
      : "";
    var note = makeNote(
      "govmatch-note-yellow",
      lockIcon + sensLabel + prefix + (opts.text || "")
    );
    insertNote(el, note);
  }

  function highlightNextButton(lang) {
    var candidates = document.querySelectorAll(
      'button, input[type="submit"], input[type="button"], a[role="button"]'
    );
    var continueRe = /save|continue|next|save\s*&?\s*continue|guardar|continuar|siguiente/i;
    var dangerRe = /submit|certif|sign|finalize|enviar|firmar|finalizar/i;

    for (var i = 0; i < candidates.length; i++) {
      var btn = candidates[i];
      if (!isVisible(btn)) continue;
      var label = (btn.textContent || btn.value || "").trim();
      if (!label) continue;
      if (dangerRe.test(label)) continue; // never point at Submit/Certify/Sign
      if (continueRe.test(label)) {
        btn.classList.add("govmatch-next-btn");
        var note = makeNote(
          "govmatch-note-blue",
          (lang === "es" ? "Cuando termines, haz clic aquí: " : "When done, click here: ") +
            '"' + label + '"'
        );
        insertNote(btn, note);
        return {
          label: lang === "es" ? "Botón para continuar" : "Continue button",
          note:
            (lang === "es"
              ? 'Cuando todo esté listo, haz clic en "'
              : 'When everything is ready, click "') +
            label +
            '"' +
            (lang === "es"
              ? " tú mismo. GovMatch no lo hará por ti."
              : " yourself. GovMatch will not do it for you."),
        };
      }
    }
    return null;
  }

  function makeNote(cls, text) {
    var span = document.createElement("div");
    span.className = ANNOTATION_CLASS + " " + cls;
    span.textContent = text;
    return span;
  }

  function insertNote(el, note) {
    var anchor = el;
    // Place the note after the field's group when possible, else after the field.
    try {
      el.insertAdjacentElement("afterend", note);
    } catch (e) {
      if (anchor.parentElement) anchor.parentElement.appendChild(note);
    }
  }

  var scrolledOnce = false;
  function scrollIntoViewOnce(el) {
    if (scrolledOnce) return;
    scrolledOnce = true;
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {
      /* ignore */
    }
  }

  function clearAnnotations() {
    scrolledOnce = false;
    var notes = document.querySelectorAll("." + ANNOTATION_CLASS);
    for (var i = 0; i < notes.length; i++) {
      if (notes[i].parentElement) notes[i].parentElement.removeChild(notes[i]);
    }
    var marked = document.querySelectorAll(
      ".govmatch-filled, .govmatch-guide, .govmatch-next-btn"
    );
    for (var j = 0; j < marked.length; j++) {
      marked[j].classList.remove("govmatch-filled", "govmatch-guide", "govmatch-next-btn");
    }
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".govmatch-filled{outline:3px solid #16a34a !important;outline-offset:1px;border-radius:4px;}",
      ".govmatch-guide{outline:3px solid #f59e0b !important;outline-offset:1px;border-radius:4px;}",
      ".govmatch-next-btn{outline:3px solid #2563eb !important;outline-offset:2px;}",
      "." +
        ANNOTATION_CLASS +
        "{font:600 12px/1.35 system-ui,sans-serif;margin:4px 0 8px;padding:6px 10px;border-radius:8px;max-width:520px;}",
      ".govmatch-note-green{background:#dcfce7;color:#166534;border:1px solid #86efac;}",
      ".govmatch-note-yellow{background:#fef9c3;color:#854d0e;border:1px solid #fde047;}",
      ".govmatch-note-blue{background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;}",
    ].join("\n");
    (document.head || document.documentElement).appendChild(style);
  }

  /* --------------------------------- utils ---------------------------------- */

  function conceptGuide(concept, lang) {
    if (concept && concept.guide && concept.guide[lang]) return concept.guide[lang];
    if (FIELD_MAP.fallbackGuide && FIELD_MAP.fallbackGuide[lang])
      return FIELD_MAP.fallbackGuide[lang];
    return "";
  }

  function norm(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function shortHost(hostname) {
    if (/grants\.gov$/i.test(hostname) || /\.grants\.gov$/i.test(hostname))
      return "grants.gov";
    if (/sam\.gov$/i.test(hostname) || /\.sam\.gov$/i.test(hostname)) return "sam.gov";
    return hostname;
  }

  function cssEscape(s) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(s);
    return String(s).replace(/([^a-zA-Z0-9_-])/g, "\\$1");
  }
})();
