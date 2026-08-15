/* =============================================================================
 * GovMatch Autofill — popup.js
 * =============================================================================
 * The popup: paste-data handoff, language toggle, and the "Autofill this page"
 * trigger. It talks to the content script via chrome.tabs.sendMessage and shows
 * an ordered checklist of what was filled / guided / left to do.
 * ============================================================================= */

var STORAGE_DATA = "govmatch_prefill";
var STORAGE_LANG = "govmatch_lang";
var ALLOWED_HOSTS = /(^|\.)grants\.gov$|(^|\.)sam\.gov$/i;

var I18N = {
  en: {
    title: "GovMatch Autofill",
    subtitle: "Fill non-sensitive fields · guide the rest",
    safety:
      "I review and fill non-sensitive fields for you. You review and sign. I don't submit anything on your behalf.",
    dataHeading: "1 · Paste your data",
    dataHint:
      'In GovMatch, go to the last wizard step ("Prepare your materials") and click "Copy data for the extension," then paste it below.',
    whereTitle: "Where you are",
    save: "Save data",
    clearData: "Clear",
    fillHeading: "2 · Autofill the open form",
    fillHint:
      "Open an official Grants.gov or SAM.gov form in this tab, then click below.",
    autofill: "Autofill this page",
    clearHl: "Clear highlights",
    saved: function (f, d) {
      return "Saved " + f + " field(s) and " + d + " draft(s).";
    },
    noData: "No data saved yet. Paste your JSON above.",
    badJson: "That doesn't look like valid GovMatch data (JSON). Please copy it again.",
    dataCleared: "Saved data cleared.",
    wrongSite:
      "Open a Grants.gov or SAM.gov form tab first — autofill only runs on official pages.",
    noReceiver:
      "Couldn't reach the page. Reload the form tab and try again.",
    needData: "Paste and save your data first (step 1).",
    filledH: "✓ Filled for you (please review)",
    guidedH: "⚠ You fill these (guided)",
    pendingH: "➡ Still to do",
    done: function (f, g, p) {
      return "Done: " + f + " filled, " + g + " guided, " + p + " to do.";
    },
    sensitive: "sensitive",
    highlightsCleared: "Highlights cleared.",
    disclaimer:
      "GovMatch Autofill never clicks Submit, Certify, or Sign, and never navigates on its own. AI-assisted help, not an official eligibility determination.",
  },
  es: {
    title: "GovMatch Autofill",
    subtitle: "Rellena campos no sensibles · guía el resto",
    safety:
      "Yo reviso y relleno por ti los campos no sensibles. Tú revisas y firmas. No envío nada en tu nombre.",
    dataHeading: "1 · Pega tus datos",
    dataHint:
      'En GovMatch, ve al último paso del asistente ("Prepara tus materiales") y haz clic en "Copiar datos para la extensión", luego pégalos abajo.',
    whereTitle: "Dónde estás",
    save: "Guardar datos",
    clearData: "Borrar",
    fillHeading: "2 · Autocompletar el formulario abierto",
    fillHint:
      "Abre un formulario oficial de Grants.gov o SAM.gov en esta pestaña y luego haz clic abajo.",
    autofill: "Autocompletar esta página",
    clearHl: "Quitar resaltados",
    saved: function (f, d) {
      return "Se guardaron " + f + " campo(s) y " + d + " borrador(es).";
    },
    noData: "Aún no hay datos guardados. Pega tu JSON arriba.",
    badJson:
      "Esto no parece datos válidos de GovMatch (JSON). Cópialo de nuevo, por favor.",
    dataCleared: "Datos guardados borrados.",
    wrongSite:
      "Abre primero una pestaña con un formulario de Grants.gov o SAM.gov: el autocompletado solo funciona en páginas oficiales.",
    noReceiver:
      "No se pudo conectar con la página. Recarga la pestaña del formulario e inténtalo de nuevo.",
    needData: "Primero pega y guarda tus datos (paso 1).",
    filledH: "✓ Rellenados por ti (revísalos)",
    guidedH: "⚠ Estos los completas tú (guiados)",
    pendingH: "➡ Pendiente",
    done: function (f, g, p) {
      return "Listo: " + f + " rellenados, " + g + " guiados, " + p + " pendientes.";
    },
    sensitive: "sensible",
    highlightsCleared: "Resaltados quitados.",
    disclaimer:
      "GovMatch Autofill nunca hace clic en Enviar, Certificar ni Firmar, y nunca navega por su cuenta. Ayuda asistida por IA, no una determinación oficial de elegibilidad.",
  },
};

var lang = "en";

document.addEventListener("DOMContentLoaded", function () {
  chrome.storage.local.get([STORAGE_LANG, STORAGE_DATA], function (res) {
    lang = res[STORAGE_LANG] === "es" ? "es" : "en";
    applyLang();
    if (res[STORAGE_DATA]) {
      try {
        var parsed =
          typeof res[STORAGE_DATA] === "string"
            ? JSON.parse(res[STORAGE_DATA])
            : res[STORAGE_DATA];
        showDataStatus(parsed, "ok");
      } catch (e) {
        /* ignore */
      }
    }
  });

  document.getElementById("lang-en").addEventListener("click", function () {
    setLang("en");
  });
  document.getElementById("lang-es").addEventListener("click", function () {
    setLang("es");
  });
  document.getElementById("save-btn").addEventListener("click", saveData);
  document.getElementById("clear-data-btn").addEventListener("click", clearData);
  document.getElementById("autofill-btn").addEventListener("click", autofill);
  document.getElementById("clear-hl-btn").addEventListener("click", clearHighlights);

  loadWhere();
});

function t() {
  return I18N[lang];
}

function setLang(next) {
  lang = next;
  chrome.storage.local.set({ govmatch_lang: next });
  applyLang();
}

function applyLang() {
  var d = t();
  document.getElementById("lang-en").classList.toggle("active", lang === "en");
  document.getElementById("lang-es").classList.toggle("active", lang === "es");
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    var key = el.getAttribute("data-i18n");
    if (d[key]) el.textContent = d[key];
  });
  document.getElementById("safety").textContent = d.safety;
  document.getElementById("data-hint").textContent = d.dataHint;
  document.getElementById("fill-hint").textContent = d.fillHint;
  document.getElementById("save-btn").textContent = d.save;
  document.getElementById("clear-data-btn").textContent = d.clearData;
  document.getElementById("autofill-btn").textContent = d.autofill;
  document.getElementById("clear-hl-btn").textContent = d.clearHl;
  document.getElementById("disclaimer").textContent = d.disclaimer;
  loadWhere(); // re-render the contextual summary in the new language
}

/* --------------------------- contextual "where" --------------------------- */

// Ask the content script which official stage the active tab is on and show a
// compact summary. Purely a mirror of the on-page panel — no model, no facts
// invented. Silently hides itself when not on an official form tab.
function loadWhere() {
  var box = document.getElementById("where-box");
  if (!box) return;
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs && tabs[0];
    var host = "";
    try {
      host = tab && tab.url ? new URL(tab.url).hostname : "";
    } catch (e) {
      host = "";
    }
    if (!tab || !ALLOWED_HOSTS.test(host)) {
      box.classList.add("hidden");
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: "GOVMATCH_WHERE" }, function (resp) {
      if (chrome.runtime.lastError || !resp || !resp.ok) {
        box.classList.add("hidden");
        return;
      }
      renderWhere(resp);
    });
  });
}

function renderWhere(resp) {
  var d = t();
  var g = resp.guidance || {};
  document.getElementById("where-title").textContent = d.whereTitle + " · " + (resp.site || "");
  document.getElementById("where-where").textContent = g.where || "";
  var ul = document.getElementById("where-next");
  ul.innerHTML = "";
  (g.next || []).slice(0, 3).forEach(function (line) {
    var li = document.createElement("li");
    li.textContent = "➡ " + line;
    ul.appendChild(li);
  });
  document.getElementById("where-box").classList.remove("hidden");
}

function showStatus(id, message, kind) {
  var el = document.getElementById(id);
  el.textContent = message;
  el.className = "status " + (kind || "info");
  el.classList.remove("hidden");
}

/* --------------------------------- data ----------------------------------- */

function saveData() {
  var raw = document.getElementById("data-input").value.trim();
  if (!raw) {
    showStatus("data-status", t().noData, "info");
    return;
  }
  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    showStatus("data-status", t().badJson, "err");
    return;
  }
  // Accept either the prefillData object or something close to it.
  var fields = Array.isArray(parsed.fields) ? parsed.fields : [];
  var drafts = Array.isArray(parsed.drafts) ? parsed.drafts : [];
  if (fields.length === 0 && drafts.length === 0) {
    showStatus("data-status", t().badJson, "err");
    return;
  }
  var normalized = { fields: fields, drafts: drafts };
  chrome.storage.local.set({ govmatch_prefill: normalized }, function () {
    showDataStatus(normalized, "ok");
  });
}

function showDataStatus(parsed, kind) {
  var f = Array.isArray(parsed.fields) ? parsed.fields.length : 0;
  var d = Array.isArray(parsed.drafts) ? parsed.drafts.length : 0;
  showStatus("data-status", t().saved(f, d), kind);
}

function clearData() {
  chrome.storage.local.remove("govmatch_prefill", function () {
    document.getElementById("data-input").value = "";
    showStatus("data-status", t().dataCleared, "info");
  });
}

/* -------------------------------- autofill -------------------------------- */

function autofill() {
  chrome.storage.local.get([STORAGE_DATA], function (res) {
    var data = res[STORAGE_DATA];
    if (!data || (!(data.fields || []).length && !(data.drafts || []).length)) {
      showStatus("fill-status", t().needData, "err");
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab || !tab.url) {
        showStatus("fill-status", t().wrongSite, "err");
        return;
      }
      var host;
      try {
        host = new URL(tab.url).hostname;
      } catch (e) {
        host = "";
      }
      if (!ALLOWED_HOSTS.test(host)) {
        showStatus("fill-status", t().wrongSite, "err");
        return;
      }
      sendAutofill(tab.id, data, /*retry*/ true);
    });
  });
}

function sendAutofill(tabId, data, retry) {
  chrome.tabs.sendMessage(
    tabId,
    { type: "GOVMATCH_AUTOFILL", data: data, lang: lang },
    function (response) {
      if (chrome.runtime.lastError || !response) {
        if (retry) {
          // Content script may not be injected yet — ask background to inject.
          chrome.runtime.sendMessage(
            { type: "GOVMATCH_ENSURE_CONTENT", tabId: tabId },
            function () {
              setTimeout(function () {
                sendAutofill(tabId, data, /*retry*/ false);
              }, 250);
            }
          );
          return;
        }
        showStatus("fill-status", t().noReceiver, "err");
        return;
      }
      if (!response.ok) {
        showStatus("fill-status", response.error || t().noReceiver, "err");
        return;
      }
      renderReport(response.report);
    }
  );
}

function clearHighlights() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs && tabs[0];
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, { type: "GOVMATCH_CLEAR" }, function () {
      document.getElementById("report").classList.add("hidden");
      showStatus("fill-status", t().highlightsCleared, "info");
    });
  });
}

function renderReport(report) {
  report = report || { filled: [], guided: [], pending: [] };
  var d = t();
  showStatus(
    "fill-status",
    d.done(
      (report.filled || []).length,
      (report.guided || []).length,
      (report.pending || []).length
    ),
    "ok"
  );

  var container = document.getElementById("report");
  container.innerHTML = "";

  container.appendChild(
    section(d.filledH, report.filled || [], "green", function (item) {
      return escapeHtml(item.label);
    })
  );
  container.appendChild(
    section(d.guidedH, report.guided || [], "yellow", function (item) {
      return (
        escapeHtml(item.label) +
        (item.sensitive
          ? ' <span class="badge-sens">🔒 ' + d.sensitive + "</span>"
          : "")
      );
    })
  );
  container.appendChild(
    section(d.pendingH, report.pending || [], "blue", function (item) {
      return (
        "<b>" +
        escapeHtml(item.label) +
        "</b>" +
        (item.note ? "<br>" + escapeHtml(item.note) : "")
      );
    })
  );

  container.classList.remove("hidden");
}

function section(heading, items, cls, render) {
  var wrap = document.createElement("div");
  if (!items.length) return wrap;
  var h = document.createElement("h3");
  h.textContent = heading;
  wrap.appendChild(h);
  var ul = document.createElement("ul");
  items.forEach(function (item) {
    var li = document.createElement("li");
    li.className = cls;
    li.innerHTML = render(item);
    ul.appendChild(li);
  });
  wrap.appendChild(ul);
  return wrap;
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
