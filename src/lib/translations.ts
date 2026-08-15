import type { Language } from "./types";

/**
 * Layer 1 of multi-language support: FIXED UI text.
 * A plain dictionary — no i18n routing libraries. Every user-visible string in
 * the chrome of the app lives here in both English and Spanish.
 *
 * (Layer 2 — Claude's dynamic content — is handled by passing the active
 * language to every API route so Claude writes directly in that language.)
 */
export const translations = {
  en: {
    // Global
    appName: "GovMatch",
    tagline: "Your copilot for U.S. federal funding",
    globalNotice:
      "AI-assisted analysis, not an official eligibility determination. Always verify with the relevant agency.",
    languageLabel: "Language",
    back: "Back",
    next: "Next",
    loading: "Loading…",

    // Discovery
    discoveryTitle:
      "Tell us about your startup and we'll show you how the government can help",
    discoveryPlaceholder:
      "Example: I have a health startup in Utah, 15 employees, we build AI software that reduces administrative work for nurses. We're looking for $500K-$2M for development and hospital pilots.",
    discoveryButton: "See my opportunities",
    entityTypeQuestion: "What type of organization are you?",
    entitySmallBusiness: "Small business / For-profit startup",
    entityHigherEd: "Institution of higher education",
    entityK12: "K-12 school / school district",
    entityNonprofit: "Nonprofit organization",
    entityGovernment: "State or local government",
    entityOther: "Other / not sure",
    examplesLabel: "Or try an example:",
    stepUnderstanding: "Understanding your company…",
    stepSearching: "Searching real opportunities…",
    stepAnalyzing: "Analyzing relevance…",

    // Examples (short labels for the buttons)
    example1: "AI health SaaS",
    example2: "Aerospace manufacturing",
    example3: "Water-loss sensors",
    example4: "AI cybersecurity",
    example5: "Kids' activities marketplace",

    // Opportunities list
    opportunitiesTitle: "Your opportunities",
    opportunitiesSubtitle:
      "These are real programs from Grants.gov, ranked for your startup.",
    noMatchesTitle: "There probably isn't a strong match",
    matchStrengthStrong: "Strong",
    matchStrengthPossible: "Possible",
    matchStrengthWeak: "Weak",
    matchStrengthIneligible: "Ineligible",
    statusRequiresVerification: "Requires verification",
    eligEligible: "Eligible to lead",
    eligIneligible: "Not eligible to lead",
    eligPremature: "Premature",
    eligVerify: "Verify eligibility",
    fitHigh: "High strategic fit",
    fitModerate: "Moderate strategic fit",
    fitLow: "Low strategic fit",
    awardCeilingLabel: "Award ceiling",
    awardFloorLabel: "Award floor",
    notSpecified: "Not specified",
    eligibilityHeading: "Eligibility",
    sourceLabel: "Source",
    evidenceCaveat:
      "Broad federal grant history for these keywords (may include large institutional grants). This is context only — not a prediction of your award, and not proof of eligibility.",
    countReviewed: "reviewed",
    countShown: "shown",
    countFiltered: "filtered (off-domain)",
    deadlineLabel: "Deadline",
    awardLabel: "Award range",
    viewDetails: "View details",
    startOver: "Start over",
    noDeadline: "Not specified",

    // Opportunity detail
    whyYouMatch: "Why you match",
    whyThisMayNotWork: "Why this may not work",
    verifyBeforeApplying:
      "Verify these before spending time on the application.",
    possibleProblems: "Possible problems",
    historicalEvidence: "Historical evidence",
    historicalRecipients: "Historical recipients",
    medianAward: "Median award",
    largestAward: "Largest award",
    evidenceSource: "Source: USAspending.gov",
    noEvidence:
      "No historical funding records were found for this program's keywords.",
    lastChecked: "Last checked",
    sourceGrantsGov: "Source: Grants.gov",
    opportunityNumber: "Opportunity #",
    startApplication: "Start application",
    fundingType: "Funding type",
    readinessHeading: "Before you apply — hard prerequisites",
    readinessSam:
      "An ACTIVE SAM.gov registration + UEI is required for any federal application. It takes 10–15 business days — start it now if you don't have it.",
    readinessSbirSize:
      "SBIR/STTR eligibility: your company must be for-profit, ≤500 employees, and >50% U.S.-owned by individuals. (You appear to qualify — verify.)",

    // Wizard
    wizardTitle: "Application wizard",
    phaseRegistrations: "Registrations",
    phaseEligibility: "Eligibility",
    phaseDocuments: "Documents",
    phaseDrafting: "Drafting",
    phaseFinalPackage: "Final package",
    yourTime: "Your time",
    governmentWait: "Government wait",
    reassurance: (t: string) =>
      `Even if approval takes weeks, your actual effort here is only ${t}.`,
    openOfficialPage: "Open official page",
    extCalloutBody:
      "Going to fill this form? Install the GovMatch browser extension — we autofill the fields we already know about your company and highlight the ones that need your attention. You review and sign; we don't submit anything for you.",
    extInstallBtn: "Install the extension",
    extHowTitle: "How to install it (1 minute):",
    extStep1: "Open chrome://extensions",
    extStep2: "Turn on “Developer mode” (top-right)",
    extStep3: "“Load unpacked” → choose the extension/ folder",
    extHide: "Hide",
    copy: "Copy",
    copied: "Copied!",
    pasteInto: (field: string) => `Paste this into "${field}"`,
    markDone: "Mark done",
    markInProgress: "Mark in progress",
    statusPending: "Pending",
    statusInProgress: "In progress",
    statusDone: "Done",
    warning: "Warning",
    whatItIs: "What it is",
    howToGet: "How to get it",
    yesNoImpact: "Impact",
    editDraft: "Edit this draft below",
    markReady: "Mark ready",
    ready: "Ready",
    viewEnglish: "View English version ready to paste",
    hideEnglish: "Hide English version",
    downloadPackage: "Download my package",
    copyForExtension: "Copy data for the extension",
    finalNotice:
      "Review, sign, and submit YOURSELF on the official portal. This is your AI-assisted draft, not an official eligibility determination.",
    finalSummary: "Your application package",
    prev: "Previous",

    // Dynamic wizard
    wizardBanner:
      "Every agency's process differs. These steps come from THIS opportunity's official listing; confirm anything marked “verify” on the agency portal.",
    stepOf: (x: number, n: number) => `Step ${x} of ${n}`,
    verifyTag: "Verify",
    verifyMeaning:
      "Confirm this on the official portal — it isn't a certain requirement.",
    fromFOA: "From this opportunity's official listing",
    whyStep: "Why this step",
    baseRegHeading: "Base registrations (do these first)",
    baseRegIntro:
      "Every federal grant needs these three. Start them early — the wait times are real.",
    submissionHeading: "How you'll submit",
    eligibilityGateHeading: "Check eligibility first",
    eligibilityGateIntro:
      "Answer these before you invest time writing — they surface hard blockers early.",
    ifFail: "If this isn't true",
    requiredFormsHeading: "Required forms",
    formsVerifyNote:
      "We couldn't read the exact forms automatically — confirm them on the official portal.",
    draftsHeading: "Your drafts",
    prepareMaterials: "Prepare your materials",
    prepareIntro:
      "There's no single downloadable, signable package — you complete the forms inside the official system. This organizes your drafts and a checklist to work through there.",
    downloadMaterials: "Download my drafts & checklist",
    finalNoticeDynamic:
      "You complete, review, sign, and submit everything YOURSELF inside the official system. This is your AI-assisted preparation, not an official eligibility determination.",

    // Errors
    errorTitle: "Something went wrong",
    errorAnalyze:
      "We couldn't understand your description. Please try rephrasing and submit again.",
    errorNoResults:
      "We couldn't find opportunities right now. The government sources may be temporarily unavailable — please try again in a moment.",
    tryAgain: "Try again",
  },

  es: {
    // Global
    appName: "GovMatch",
    tagline: "Tu copiloto para fondos federales de EE. UU.",
    globalNotice:
      "Análisis asistido por IA, no una determinación oficial de elegibilidad. Verifica siempre con la agencia correspondiente.",
    languageLabel: "Idioma",
    back: "Atrás",
    next: "Siguiente",
    loading: "Cargando…",

    // Discovery
    discoveryTitle:
      "Cuéntanos sobre tu startup y te mostraremos cómo el gobierno puede ayudarte",
    discoveryPlaceholder:
      "Ejemplo: Tengo una startup de salud en Utah, 15 empleados, creamos software de IA que reduce el trabajo administrativo de las enfermeras. Buscamos entre $500K y $2M para desarrollo y pilotos en hospitales.",
    discoveryButton: "Ver mis oportunidades",
    entityTypeQuestion: "¿Qué tipo de organización eres?",
    entitySmallBusiness: "Pequeña empresa / Startup con fines de lucro",
    entityHigherEd: "Institución de educación superior",
    entityK12: "Escuela K-12 / distrito escolar",
    entityNonprofit: "Organización sin fines de lucro",
    entityGovernment: "Gobierno estatal o local",
    entityOther: "Otro / no estoy seguro",
    examplesLabel: "O prueba un ejemplo:",
    stepUnderstanding: "Entendiendo tu empresa…",
    stepSearching: "Buscando oportunidades reales…",
    stepAnalyzing: "Analizando relevancia…",

    // Examples
    example1: "SaaS de salud con IA",
    example2: "Manufactura aeroespacial",
    example3: "Sensores de fugas de agua",
    example4: "Ciberseguridad con IA",
    example5: "Marketplace de actividades infantiles",

    // Opportunities list
    opportunitiesTitle: "Tus oportunidades",
    opportunitiesSubtitle:
      "Estos son programas reales de Grants.gov, ordenados para tu startup.",
    noMatchesTitle: "Probablemente no haya una coincidencia fuerte",
    matchStrengthStrong: "Fuerte",
    matchStrengthPossible: "Posible",
    matchStrengthWeak: "Débil",
    matchStrengthIneligible: "No elegible",
    statusRequiresVerification: "Requiere verificación",
    eligEligible: "Elegible para liderar",
    eligIneligible: "No elegible para liderar",
    eligPremature: "Prematuro",
    eligVerify: "Verificar elegibilidad",
    fitHigh: "Alto ajuste estratégico",
    fitModerate: "Ajuste estratégico moderado",
    fitLow: "Bajo ajuste estratégico",
    awardCeilingLabel: "Monto máximo",
    awardFloorLabel: "Monto mínimo",
    notSpecified: "No especificado",
    eligibilityHeading: "Elegibilidad",
    sourceLabel: "Fuente",
    evidenceCaveat:
      "Historial amplio de subvenciones federales para estas palabras clave (puede incluir grandes subvenciones institucionales). Es solo contexto — no una predicción de tu monto ni prueba de elegibilidad.",
    countReviewed: "revisadas",
    countShown: "mostradas",
    countFiltered: "descartadas (fuera de dominio)",
    deadlineLabel: "Fecha límite",
    awardLabel: "Rango del monto",
    viewDetails: "Ver detalles",
    startOver: "Empezar de nuevo",
    noDeadline: "No especificada",

    // Opportunity detail
    whyYouMatch: "Por qué coincides",
    whyThisMayNotWork: "Por qué esto puede no funcionar",
    verifyBeforeApplying:
      "Verifica esto antes de invertir tiempo en la solicitud.",
    possibleProblems: "Posibles problemas",
    historicalEvidence: "Evidencia histórica",
    historicalRecipients: "Beneficiarios históricos",
    medianAward: "Monto mediano",
    largestAward: "Monto más grande",
    evidenceSource: "Fuente: USAspending.gov",
    noEvidence:
      "No se encontraron registros históricos de financiamiento para las palabras clave de este programa.",
    lastChecked: "Última verificación",
    sourceGrantsGov: "Fuente: Grants.gov",
    opportunityNumber: "Oportunidad n.º ",
    startApplication: "Iniciar solicitud",
    fundingType: "Tipo de financiamiento",
    readinessHeading: "Antes de aplicar — prerrequisitos obligatorios",
    readinessSam:
      "Se requiere un registro ACTIVO en SAM.gov + UEI para cualquier solicitud federal. Tarda 10–15 días hábiles — empiézalo ya si no lo tienes.",
    readinessSbirSize:
      "Elegibilidad SBIR/STTR: tu empresa debe ser con fines de lucro, ≤500 empleados, y >50% de propiedad de personas en EE. UU. (Pareces calificar — verifica.)",

    // Wizard
    wizardTitle: "Asistente de solicitud",
    phaseRegistrations: "Registros",
    phaseEligibility: "Elegibilidad",
    phaseDocuments: "Documentos",
    phaseDrafting: "Redacción",
    phaseFinalPackage: "Paquete final",
    yourTime: "Tu tiempo",
    governmentWait: "Espera del gobierno",
    reassurance: (t: string) =>
      `Aunque la aprobación tarde semanas, tu esfuerzo real aquí es solo ${t}.`,
    openOfficialPage: "Abrir página oficial",
    extCalloutBody:
      "¿Vas a llenar este formulario? Instala la extensión GovMatch: autollenamos los campos que ya conocemos de tu empresa y te guiamos en los que necesitan tu atención. Tú revisas y firmas — no enviamos nada por ti.",
    extInstallBtn: "Instalar la extensión",
    extHowTitle: "Cómo instalarla (1 minuto):",
    extStep1: "Abre chrome://extensions",
    extStep2: "Activa el “Modo de desarrollador” (arriba a la derecha)",
    extStep3: "“Cargar descomprimida” → elige la carpeta extension/",
    extHide: "Ocultar",
    copy: "Copiar",
    copied: "¡Copiado!",
    pasteInto: (field: string) => `Pega esto en "${field}"`,
    markDone: "Marcar como hecho",
    markInProgress: "Marcar en progreso",
    statusPending: "Pendiente",
    statusInProgress: "En progreso",
    statusDone: "Hecho",
    warning: "Advertencia",
    whatItIs: "Qué es",
    howToGet: "Cómo obtenerlo",
    yesNoImpact: "Impacto",
    editDraft: "Edita este borrador abajo",
    markReady: "Marcar como listo",
    ready: "Listo",
    viewEnglish: "Ver versión en inglés lista para pegar",
    hideEnglish: "Ocultar versión en inglés",
    downloadPackage: "Descargar mi paquete",
    copyForExtension: "Copiar datos para la extensión",
    finalNotice:
      "Revisa, firma y envía TÚ MISMO en el portal oficial. Este es tu borrador asistido por IA, no una determinación oficial de elegibilidad.",
    finalSummary: "Tu paquete de solicitud",
    prev: "Anterior",

    // Dynamic wizard
    wizardBanner:
      "El proceso de cada agencia es diferente. Estos pasos provienen del anuncio oficial de ESTA oportunidad; confirma en el portal de la agencia todo lo marcado como “verificar”.",
    stepOf: (x: number, n: number) => `Paso ${x} de ${n}`,
    verifyTag: "Verificar",
    verifyMeaning:
      "Confírmalo en el portal oficial: no es un requisito seguro.",
    fromFOA: "Del anuncio oficial de esta oportunidad",
    whyStep: "Por qué este paso",
    baseRegHeading: "Registros base (haz esto primero)",
    baseRegIntro:
      "Toda subvención federal necesita estos tres. Empiézalos pronto: los tiempos de espera son reales.",
    submissionHeading: "Cómo enviarás la solicitud",
    eligibilityGateHeading: "Verifica la elegibilidad primero",
    eligibilityGateIntro:
      "Responde esto antes de invertir tiempo escribiendo: revela bloqueos importantes desde el principio.",
    ifFail: "Si esto no es cierto",
    requiredFormsHeading: "Formularios requeridos",
    formsVerifyNote:
      "No pudimos leer los formularios exactos automáticamente: confírmalos en el portal oficial.",
    draftsHeading: "Tus borradores",
    prepareMaterials: "Prepara tus materiales",
    prepareIntro:
      "No existe un único paquete descargable y firmable: completas los formularios dentro del sistema oficial. Esto organiza tus borradores y una lista de verificación para trabajar allí.",
    downloadMaterials: "Descargar mis borradores y lista",
    finalNoticeDynamic:
      "Completas, revisas, firmas y envías todo TÚ MISMO dentro del sistema oficial. Esta es tu preparación asistida por IA, no una determinación oficial de elegibilidad.",

    // Errors
    errorTitle: "Algo salió mal",
    errorAnalyze:
      "No pudimos entender tu descripción. Intenta reformularla y envíala de nuevo.",
    errorNoResults:
      "No pudimos encontrar oportunidades en este momento. Las fuentes del gobierno pueden estar temporalmente no disponibles; inténtalo de nuevo en un momento.",
    tryAgain: "Intentar de nuevo",
  },
} as const;

export type TranslationKey = keyof typeof translations["en"];

export function getDict(lang: Language) {
  return translations[lang];
}
