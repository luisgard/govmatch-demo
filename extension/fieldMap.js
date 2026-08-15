/* =============================================================================
 * GovMatch Autofill — fieldMap.js
 * =============================================================================
 *
 * THIS IS THE FILE YOU EDIT to teach the extension about real forms.
 *
 * The web app hands off "prefillData" whose fields have arbitrary, human-ish
 * keys that Claude generated (e.g. "Legal business name", "EIN", "Project
 * title"). Real government forms, meanwhile, have their own input ids, names,
 * and labels. This file bridges the two by defining CONCEPTS.
 *
 * For each concept you provide (all optional except `id` + `dataKeywords`):
 *
 *   id             A stable concept name.
 *   dataKeywords   Words to recognize this concept in a prefill field's KEY.
 *                  (e.g. a field keyed "Company legal name" → "legalName")
 *   selectors      LEVEL 1 — exact CSS selectors, per host. The fastest, most
 *                  reliable match. Add real selectors here as you inspect forms.
 *   labelKeywords  LEVEL 3 — words to look for in a field's visible <label>.
 *   semanticKeywords LEVEL 4 — words to look for in an input's name/id/placeholder.
 *   sensitive      If true, ALWAYS guide (never autofill) — regardless of the
 *                  per-field sensitive flag coming from the app.
 *   guide          Tooltip text (en/es): WHAT goes here, WHERE to get it, WARNINGS.
 *
 * The extension tries these in order (see content.js): exact selector → concept
 * match → label match → semantic match → AI/best-guess (guide only) → manual.
 *
 * NOTE ON REAL-WORLD FORMS (React, custom dropdowns, iframes, shadow DOM,
 * multi-step): prefer adding a precise `selectors` entry — it is the level that
 * survives redesigns least badly, and it is the easiest to update. For custom
 * widgets you may need to point the selector at the underlying <input>.
 * ============================================================================= */

var GOVMATCH_FIELD_MAP = {
  concepts: [
    {
      id: "legalName",
      dataKeywords: [
        "legal name",
        "legal business",
        "entity name",
        "organization name",
        "company name",
        "business name",
      ],
      selectors: {
        "grants.gov": ['input[name="legalBusinessName"]', "#legalName"],
        "sam.gov": ['input[name="legalBusinessName"]'],
      },
      labelKeywords: [
        "legal business name",
        "legal name",
        "entity name",
        "organization name",
        "organization legal name",
      ],
      semanticKeywords: ["legalname", "businessname", "entityname", "orgname"],
      sensitive: true,
      guide: {
        en: "Your EXACT legal business name as registered with the IRS. It must match your IRS records character-for-character — a mismatch here is the #1 cause of rejection.",
        es: "El nombre legal EXACTO de tu empresa tal como está registrado en el IRS. Debe coincidir carácter por carácter con tus registros del IRS: una discrepancia aquí es la causa n.º 1 de rechazo.",
      },
    },
    {
      id: "ein",
      dataKeywords: ["ein", "employer identification", "tax id", "tin"],
      selectors: {
        "grants.gov": ['input[name="ein"]', "#ein"],
        "sam.gov": ['input[name="taxpayerId"]'],
      },
      labelKeywords: [
        "ein",
        "employer identification number",
        "tax id",
        "taxpayer identification",
      ],
      semanticKeywords: ["ein", "taxid", "taxpayer", "tin"],
      sensitive: true,
      guide: {
        en: "Your 9-digit Employer Identification Number (EIN) from the IRS. Must match your IRS records exactly. Never share this on an untrusted page.",
        es: "Tu número de identificación patronal (EIN) de 9 dígitos del IRS. Debe coincidir exactamente con tus registros del IRS. Nunca lo compartas en una página no confiable.",
      },
    },
    {
      id: "uei",
      dataKeywords: ["uei", "unique entity"],
      selectors: {
        "grants.gov": ['input[name="uei"]', "#uei"],
        "sam.gov": ['input[name="uei"]'],
      },
      labelKeywords: ["uei", "unique entity id", "unique entity identifier"],
      semanticKeywords: ["uei", "uniqueentity"],
      sensitive: true,
      guide: {
        en: "Your 12-character Unique Entity ID (UEI), assigned by SAM.gov. If you don't have one yet, register your entity at SAM.gov first.",
        es: "Tu identificador único de entidad (UEI) de 12 caracteres, asignado por SAM.gov. Si aún no tienes uno, primero registra tu entidad en SAM.gov.",
      },
    },
    {
      id: "duns",
      dataKeywords: ["duns"],
      labelKeywords: ["duns"],
      semanticKeywords: ["duns"],
      sensitive: true,
      guide: {
        en: "DUNS numbers were retired by the U.S. government in 2022 and replaced by the UEI. Use your UEI instead unless this specific form still asks for DUNS.",
        es: "Los números DUNS fueron retirados por el gobierno de EE. UU. en 2022 y reemplazados por el UEI. Usa tu UEI a menos que este formulario específico aún pida DUNS.",
      },
    },
    {
      id: "address",
      dataKeywords: ["address", "street", "address line 1"],
      selectors: {
        "grants.gov": ['input[name="street1"]', "#address1"],
        "sam.gov": ['input[name="addressLine1"]'],
      },
      labelKeywords: ["address", "street address", "address line 1", "mailing address"],
      semanticKeywords: ["address", "street", "addr1", "addressline1"],
      sensitive: false,
      guide: {
        en: "Your business street address as registered with the IRS. It must match your SAM.gov / IRS records.",
        es: "La dirección de tu empresa tal como está registrada en el IRS. Debe coincidir con tus registros de SAM.gov / IRS.",
      },
    },
    {
      id: "city",
      dataKeywords: ["city"],
      selectors: { "grants.gov": ['input[name="city"]'], "sam.gov": ['input[name="city"]'] },
      labelKeywords: ["city"],
      semanticKeywords: ["city"],
      sensitive: false,
      guide: {
        en: "City of your registered business address.",
        es: "Ciudad de la dirección registrada de tu empresa.",
      },
    },
    {
      id: "state",
      dataKeywords: ["state", "province"],
      selectors: { "grants.gov": ['select[name="state"]'], "sam.gov": ['select[name="state"]'] },
      labelKeywords: ["state", "state/province"],
      semanticKeywords: ["state", "province"],
      sensitive: false,
      guide: {
        en: "State of your registered business address. This may be a dropdown — pick the matching option.",
        es: "Estado de la dirección registrada de tu empresa. Puede ser una lista desplegable: elige la opción correspondiente.",
      },
    },
    {
      id: "zip",
      dataKeywords: ["zip", "postal"],
      selectors: { "grants.gov": ['input[name="zipCode"]'], "sam.gov": ['input[name="zipCode"]'] },
      labelKeywords: ["zip", "zip code", "postal code"],
      semanticKeywords: ["zip", "postal", "zipcode"],
      sensitive: false,
      guide: {
        en: "ZIP / postal code of your registered business address.",
        es: "Código postal de la dirección registrada de tu empresa.",
      },
    },
    {
      id: "email",
      dataKeywords: ["email", "e-mail"],
      selectors: { "grants.gov": ['input[type="email"]'], "sam.gov": ['input[type="email"]'] },
      labelKeywords: ["email", "e-mail"],
      semanticKeywords: ["email", "mail"],
      sensitive: false,
      guide: {
        en: "The contact email for your organization's point of contact.",
        es: "El correo electrónico de contacto del punto de contacto de tu organización.",
      },
    },
    {
      id: "phone",
      dataKeywords: ["phone", "telephone"],
      selectors: { "grants.gov": ['input[type="tel"]'], "sam.gov": ['input[type="tel"]'] },
      labelKeywords: ["phone", "telephone", "phone number"],
      semanticKeywords: ["phone", "tel"],
      sensitive: false,
      guide: {
        en: "A business phone number where the agency can reach your point of contact.",
        es: "Un número de teléfono de la empresa donde la agencia pueda contactar a tu punto de contacto.",
      },
    },
    {
      id: "website",
      dataKeywords: ["website", "url", "web site"],
      labelKeywords: ["website", "url", "web address"],
      semanticKeywords: ["website", "url", "web"],
      sensitive: false,
      guide: {
        en: "Your company website URL.",
        es: "La URL del sitio web de tu empresa.",
      },
    },
    {
      id: "projectTitle",
      dataKeywords: ["project title", "proposal title", "title"],
      selectors: { "grants.gov": ['input[name="projectTitle"]'] },
      labelKeywords: ["project title", "proposal title", "title of project"],
      semanticKeywords: ["projecttitle", "proposaltitle"],
      sensitive: false,
      guide: {
        en: "A short, descriptive title for your project. Keep it clear and specific.",
        es: "Un título breve y descriptivo para tu proyecto. Que sea claro y específico.",
      },
    },
    {
      id: "projectSummary",
      dataKeywords: [
        "summary",
        "abstract",
        "project summary",
        "project description",
        "narrative",
      ],
      labelKeywords: ["project summary", "abstract", "description", "narrative"],
      semanticKeywords: ["summary", "abstract", "description", "narrative"],
      sensitive: false,
      guide: {
        en: "Your project summary / abstract. Review the draft GovMatch prepared before pasting, and tailor it to this program.",
        es: "El resumen / abstract de tu proyecto. Revisa el borrador que preparó GovMatch antes de pegarlo y adáptalo a este programa.",
      },
    },
    {
      id: "requestedAmount",
      dataKeywords: ["amount", "funding requested", "budget", "requested amount"],
      labelKeywords: ["amount requested", "funding requested", "total budget", "federal amount"],
      semanticKeywords: ["amount", "budget", "funding"],
      sensitive: false,
      guide: {
        en: "The dollar amount you are requesting. Make sure it falls within the opportunity's award floor and ceiling.",
        es: "El monto en dólares que solicitas. Asegúrate de que esté dentro del mínimo y el máximo del monto de la oportunidad.",
      },
    },
    {
      id: "contactName",
      dataKeywords: ["contact name", "point of contact", "poc", "authorized representative"],
      labelKeywords: ["contact name", "point of contact", "authorized organization representative"],
      semanticKeywords: ["contactname", "poc", "aor"],
      sensitive: false,
      guide: {
        en: "The name of your organization's point of contact / Authorized Organization Representative (AOR).",
        es: "El nombre del punto de contacto / Representante Autorizado de la Organización (AOR) de tu empresa.",
      },
    },
  ],

  /**
   * Generic guidance shown when a field is guided but no concept applies.
   */
  fallbackGuide: {
    en: "GovMatch isn't sure what goes here. Check the form's instructions and fill it in yourself.",
    es: "GovMatch no está seguro de qué va aquí. Revisa las instrucciones del formulario y complétalo tú mismo.",
  },
};

// Make it reachable from content.js (same content-script isolated world).
if (typeof window !== "undefined") {
  window.GOVMATCH_FIELD_MAP = GOVMATCH_FIELD_MAP;
}
