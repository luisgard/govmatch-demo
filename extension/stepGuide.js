/* =============================================================================
 * GovMatch Autofill — stepGuide.js  (content script, runs before content.js)
 * =============================================================================
 * CONTEXTUAL EXPERT GUIDE. Detects which official stage the user is on
 * (SAM.gov / Grants.gov) from the URL + on-page text, then shows a small
 * floating panel with: WHERE YOU ARE, WHAT'S NEXT, WHAT TO HAVE READY, and
 * WHICH FIELDS ARE SENSITIVE (fill yourself).
 *
 * SOURCE-OF-TRUTH PRINCIPLE: every word here is HUMAN-WRITTEN, curated from the
 * known, stable official registration/application process. NOTHING is generated
 * by a model at runtime, so it can never invent a step, a URL, or a requirement.
 * The only URLs referenced are the official root domains (hardcoded constants).
 * The official site always DETERMINES; this panel only EXPLAINS the map.
 * ============================================================================= */

(function () {
  "use strict";

  var LANG_KEY = "govmatch_lang";
  var DISMISS_KEY = "govmatch_guide_dismissed"; // per-tab session, in-memory only
  var JOURNEY_KEY = "govmatch_journey"; // persisted array of completed step ids
  var HOST_ID = "govmatch-guide-host";

  var OFFICIAL = {
    sam: "https://sam.gov",
    grants: "https://grants.gov",
    login: "https://login.gov",
  };

  /* --------------------------- knowledge base ------------------------------- *
   * Each stage: id, sig (lowercase ENGLISH keywords that appear on the official
   * page — matching is against the site's own text, not the panel language),
   * and g: bilingual guidance { where, next[], ready[], sensitive[] }.
   * Stages are listed in official process order.
   * ------------------------------------------------------------------------- */

  var SITES = {
    "sam.gov": {
      label: "SAM.gov",
      root: OFFICIAL.sam,
      overview: {
        en: {
          where: "SAM.gov — where your entity registers to receive federal awards. Registration is FREE.",
          next: [
            "Sign in with a Login.gov account (that is the only sign-in SAM.gov uses).",
            "If you have never registered, choose “Get Started” / “Register Entity” to begin.",
            "You will move through Core Data → Assertions → Reps & Certs → Points of Contact.",
          ],
          ready: [
            "Your legal business name and physical address EXACTLY as the IRS has them.",
            "Your EIN/TIN and the fiscal year-end date.",
          ],
          sensitive: [
            "EIN/TIN, bank/EFT routing & account numbers, and your MPIN — enter these yourself.",
          ],
        },
        es: {
          where: "SAM.gov — donde tu entidad se registra para recibir fondos federales. El registro es GRATIS.",
          next: [
            "Inicia sesión con una cuenta de Login.gov (es el único acceso que usa SAM.gov).",
            "Si nunca te has registrado, elige “Get Started” / “Register Entity” para empezar.",
            "Pasarás por Core Data → Assertions → Reps & Certs → Points of Contact.",
          ],
          ready: [
            "El nombre legal y la dirección física de tu empresa EXACTAMENTE como los tiene el IRS.",
            "Tu EIN/TIN y la fecha de cierre del año fiscal.",
          ],
          sensitive: [
            "EIN/TIN, número de ruta y cuenta bancaria (EFT) y tu MPIN — escríbelos tú mismo.",
          ],
        },
      },
      stages: [
        {
          id: "sam_uei",
          sig: ["unique entity id", "get a unique entity", "uei", "get started", "register entity", "entity registration"],
          g: {
            en: {
              where: "The SAM.gov entry point — get your Unique Entity ID (UEI) / start entity registration.",
              next: [
                "In the “Register Your Entity or Get a Unique Entity ID” box, click “Get Started”. (“Check Entity Status” looks up an existing one.)",
                "SAM.gov now issues the UEI directly — you no longer need a DUNS number.",
                "Choose full entity registration if you want to receive grants/contracts (not just a UEI).",
                "Your legal name + physical address must match your IRS records, or validation will fail.",
              ],
              ready: ["Legal business name (as filed with the IRS)", "Physical street address (no P.O. box)"],
              sensitive: [],
            },
            es: {
              where: "El punto de entrada de SAM.gov — obtén tu Unique Entity ID (UEI) / inicia el registro.",
              next: [
                "En el cuadro “Register Your Entity or Get a Unique Entity ID”, haz clic en “Get Started”. (“Check Entity Status” consulta uno existente.)",
                "SAM.gov ahora emite el UEI directamente — ya no necesitas número DUNS.",
                "Elige el registro completo si quieres recibir subvenciones/contratos (no solo el UEI).",
                "Tu nombre legal + dirección física deben coincidir con el IRS, o la validación fallará.",
              ],
              ready: ["Nombre legal de la empresa (como en el IRS)", "Dirección física (no apartado postal)"],
              sensitive: [],
            },
          },
        },
        {
          id: "sam_validation",
          sig: ["entity validation", "validate your entity", "legal business name and physical address", "incumbent"],
          g: {
            en: {
              where: "Entity Validation — proving your legal name + address are real.",
              next: [
                "Pick the record that matches your business EXACTLY; if none matches, you can submit documents.",
                "This can take a few days if you must upload proof — start it early.",
              ],
              ready: ["A utility bill, bank statement, or IRS letter showing your name + address"],
              sensitive: [],
            },
            es: {
              where: "Validación de Entidad — probando que tu nombre legal + dirección son reales.",
              next: [
                "Elige el registro que coincida EXACTAMENTE; si ninguno coincide, puedes enviar documentos.",
                "Puede tardar varios días si debes subir pruebas — empieza pronto.",
              ],
              ready: ["Un recibo de servicios, estado de cuenta o carta del IRS con tu nombre + dirección"],
              sensitive: [],
            },
          },
        },
        {
          id: "sam_core_data",
          sig: ["core data", "business information", "financial information", "eft", "cage code", "general information"],
          g: {
            en: {
              where: "Core Data — the backbone of your registration.",
              next: [
                "Confirm business type, start date and fiscal year-end.",
                "A CAGE code is assigned automatically for U.S. entities — you don't request it separately.",
                "You'll enter banking (EFT) details so agencies can pay you.",
              ],
              ready: ["Business start date", "Fiscal year-end date", "Bank routing + account number"],
              sensitive: ["EIN/TIN", "Bank routing & account numbers (EFT)", "MPIN (you create this — keep it private)"],
            },
            es: {
              where: "Core Data — la columna vertebral de tu registro.",
              next: [
                "Confirma tipo de negocio, fecha de inicio y cierre del año fiscal.",
                "El código CAGE se asigna automáticamente para entidades de EE. UU. — no lo pides aparte.",
                "Ingresarás datos bancarios (EFT) para que las agencias te paguen.",
              ],
              ready: ["Fecha de inicio del negocio", "Cierre del año fiscal", "Número de ruta + cuenta bancaria"],
              sensitive: ["EIN/TIN", "Número de ruta y cuenta bancaria (EFT)", "MPIN (lo creas tú — mantenlo privado)"],
            },
          },
        },
        {
          id: "sam_assertions",
          sig: ["assertions", "naics", "goods and services", "size metrics", "edi", "disaster response"],
          g: {
            en: {
              where: "Assertions — what your business does and its size.",
              next: [
                "Add the NAICS codes that describe your work (you can add several).",
                "Enter size metrics (employees / revenue) honestly — they set your small-business status.",
              ],
              ready: ["Your NAICS code(s)", "Average employees and annual revenue"],
              sensitive: [],
            },
            es: {
              where: "Assertions — qué hace tu empresa y su tamaño.",
              next: [
                "Agrega los códigos NAICS que describen tu trabajo (puedes añadir varios).",
                "Ingresa métricas de tamaño (empleados / ingresos) con honestidad — definen tu estatus de small business.",
              ],
              ready: ["Tu(s) código(s) NAICS", "Promedio de empleados e ingresos anuales"],
              sensitive: [],
            },
          },
        },
        {
          id: "sam_reps_certs",
          sig: ["representations and certifications", "reps and certs", "far", "dfars", "certifications"],
          g: {
            en: {
              where: "Representations & Certifications — legal compliance answers.",
              next: [
                "Answer each FAR/DFARS question truthfully; these are legal certifications.",
                "If a question is unclear, pause and check the official help rather than guessing.",
              ],
              ready: ["Knowledge of your business's compliance status (ownership, size, debarment history)"],
              sensitive: ["These are legal attestations — read each one; do not let anyone answer for you."],
            },
            es: {
              where: "Representations & Certifications — respuestas de cumplimiento legal.",
              next: [
                "Responde cada pregunta FAR/DFARS con la verdad; son certificaciones legales.",
                "Si una pregunta no es clara, detente y consulta la ayuda oficial en vez de adivinar.",
              ],
              ready: ["Conocer el estatus de cumplimiento de tu empresa (propiedad, tamaño, historial)"],
              sensitive: ["Son declaraciones legales — léelas; no dejes que nadie las responda por ti."],
            },
          },
        },
        {
          id: "sam_poc",
          sig: ["points of contact", "poc", "electronic business", "accounts receivable"],
          g: {
            en: {
              where: "Points of Contact — who represents your entity.",
              next: [
                "The Electronic Business POC is important: they authorize people in Grants.gov later.",
                "Use real, reachable people — agencies contact these addresses.",
              ],
              ready: ["Name, email and phone for each contact"],
              sensitive: [],
            },
            es: {
              where: "Points of Contact — quién representa a tu entidad.",
              next: [
                "El Electronic Business POC es clave: autoriza a las personas en Grants.gov después.",
                "Usa personas reales y localizables — las agencias contactan esos correos.",
              ],
              ready: ["Nombre, correo y teléfono de cada contacto"],
              sensitive: [],
            },
          },
        },
        {
          id: "sam_workspace",
          sig: ["workspace", "entity dashboard", "registration status", "renew", "manage entity"],
          g: {
            en: {
              where: "Your SAM.gov dashboard — registration status & renewal.",
              next: [
                "Check the status is “Active” before applying anywhere; activation can take days.",
                "Registration must be RENEWED every year or it lapses.",
              ],
              ready: [],
              sensitive: [],
            },
            es: {
              where: "Tu panel de SAM.gov — estado del registro y renovación.",
              next: [
                "Verifica que el estado sea “Active” antes de aplicar; activarlo puede tardar días.",
                "El registro se RENUEVA cada año o caduca.",
              ],
              ready: [],
              sensitive: [],
            },
          },
        },
      ],
    },

    "grants.gov": {
      label: "Grants.gov",
      root: OFFICIAL.grants,
      overview: {
        en: {
          where: "Grants.gov — where you find and apply for federal grants.",
          next: [
            "You need an ACTIVE SAM.gov registration (with a UEI) before you can apply.",
            "Create a Grants.gov account and get your role authorized by your organization's E-Biz POC.",
            "Applications are completed and submitted through a Workspace.",
          ],
          ready: ["Your organization's UEI", "Your SAM.gov registration is Active"],
          sensitive: ["Only the Authorized Organization Representative (AOR) may submit — never share that role's login."],
        },
        es: {
          where: "Grants.gov — donde encuentras y solicitas subvenciones federales.",
          next: [
            "Necesitas un registro de SAM.gov ACTIVO (con UEI) antes de poder aplicar.",
            "Crea una cuenta en Grants.gov y que el E-Biz POC de tu organización autorice tu rol.",
            "Las solicitudes se completan y envían a través de un Workspace.",
          ],
          ready: ["El UEI de tu organización", "Tu registro de SAM.gov está Activo"],
          sensitive: ["Solo el Authorized Organization Representative (AOR) puede enviar — nunca compartas ese acceso."],
        },
      },
      stages: [
        {
          id: "grants_register",
          sig: ["register", "create account", "add profile", "authorized organization representative", "aor", "ebiz", "e-biz"],
          g: {
            en: {
              where: "Registering / setting up your Grants.gov role.",
              next: [
                "Add a profile tied to your organization's UEI.",
                "Your E-Biz POC (from SAM.gov) must approve you as an AOR before you can submit.",
              ],
              ready: ["Organization UEI", "Who your E-Biz POC is"],
              sensitive: [],
            },
            es: {
              where: "Registrándote / configurando tu rol en Grants.gov.",
              next: [
                "Agrega un perfil ligado al UEI de tu organización.",
                "Tu E-Biz POC (de SAM.gov) debe aprobarte como AOR antes de poder enviar.",
              ],
              ready: ["UEI de la organización", "Quién es tu E-Biz POC"],
              sensitive: [],
            },
          },
        },
        {
          id: "grants_search",
          sig: ["search grants", "search results", "opportunity number", "browse", "funding opportunity"],
          g: {
            en: {
              where: "Searching for funding opportunities.",
              next: [
                "Confirm the eligibility and deadline on the opportunity's own page — that is the source of truth.",
                "Click “Apply” to create a Workspace for the one you want.",
              ],
              ready: [],
              sensitive: [],
            },
            es: {
              where: "Buscando oportunidades de financiamiento.",
              next: [
                "Confirma la elegibilidad y la fecha límite en la página de la oportunidad — esa es la fuente oficial.",
                "Haz clic en “Apply” para crear un Workspace de la que quieras.",
              ],
              ready: [],
              sensitive: [],
            },
          },
        },
        {
          id: "grants_workspace",
          sig: ["workspace", "manage workspace", "workspace forms", "participants", "fill out forms"],
          g: {
            en: {
              where: "In a Workspace — completing the application forms.",
              next: [
                "Fill each form (webform or downloadable PDF). Save often.",
                "Use “Check Application” to catch errors before submitting.",
              ],
              ready: ["Project narrative, budget, and any required attachments"],
              sensitive: [],
            },
            es: {
              where: "En un Workspace — completando los formularios de la solicitud.",
              next: [
                "Completa cada formulario (web o PDF descargable). Guarda seguido.",
                "Usa “Check Application” para detectar errores antes de enviar.",
              ],
              ready: ["Narrativa del proyecto, presupuesto y adjuntos requeridos"],
              sensitive: [],
            },
          },
        },
        {
          id: "grants_submit",
          sig: ["submit application", "sign and submit", "check application", "ready to submit"],
          g: {
            en: {
              where: "The submission step.",
              next: [
                "Only the AOR can click Submit — GovMatch never does this for you.",
                "After submit, keep the tracking number Grants.gov gives you.",
              ],
              ready: ["Final review done", "AOR available to submit"],
              sensitive: ["Submitting is a legal act — the AOR must do it personally."],
            },
            es: {
              where: "El paso de envío.",
              next: [
                "Solo el AOR puede hacer clic en Submit — GovMatch nunca lo hace por ti.",
                "Tras enviar, guarda el número de seguimiento que te da Grants.gov.",
              ],
              ready: ["Revisión final hecha", "AOR disponible para enviar"],
              sensitive: ["Enviar es un acto legal — el AOR debe hacerlo en persona."],
            },
          },
        },
      ],
    },

    "login.gov": {
      label: "Login.gov",
      root: OFFICIAL.login,
      overview: {
        en: {
          where: "Login.gov — the secure sign-in SAM.gov uses. GovMatch never sees, reads, or fills your password.",
          next: [
            "First time here? Click “Create an account” to set up your Login.gov account.",
            "Already have one? Enter your email and password, then Submit.",
            "You'll set up two-factor authentication, then be returned to SAM.gov.",
          ],
          ready: ["A business email you'll keep"],
          sensitive: [
            "Your password — type it yourself. GovMatch never reads or fills it, and never submits.",
          ],
        },
        es: {
          where: "Login.gov — el inicio de sesión seguro que usa SAM.gov. GovMatch nunca ve, lee ni llena tu contraseña.",
          next: [
            "¿Primera vez? Haz clic en “Crear una cuenta” para configurar tu cuenta de Login.gov.",
            "¿Ya tienes una? Ingresa tu correo y contraseña, y luego Enviar.",
            "Configurarás la verificación en dos pasos y luego volverás a SAM.gov.",
          ],
          ready: ["Un correo de empresa que vayas a conservar"],
          sensitive: [
            "Tu contraseña — escríbela tú. GovMatch nunca la lee ni la llena, y nunca envía.",
          ],
        },
      },
      stages: [
        {
          id: "login_create",
          sig: ["usuarios nuevos", "new users", "crear una cuenta", "create an account"],
          g: {
            en: {
              where: "Create your Login.gov account (new users).",
              next: [
                "Enter the email you'll use to sign in.",
                "Pick your email language.",
                "Check the box to accept Login.gov's Rules of Use.",
                "Click Submit — Login.gov emails you a link to continue.",
              ],
              ready: ["A business email you'll keep"],
              sensitive: [
                "You'll create your password on the next step — type it yourself. GovMatch never fills it.",
              ],
            },
            es: {
              where: "Crea tu cuenta de Login.gov (usuarios nuevos).",
              next: [
                "Ingresa el correo con el que iniciarás sesión.",
                "Elige el idioma de tus correos.",
                "Marca la casilla para aceptar las Reglas de uso de Login.gov.",
                "Haz clic en Enviar — Login.gov te manda un enlace para continuar.",
              ],
              ready: ["Un correo de empresa que vayas a conservar"],
              sensitive: [
                "Crearás tu contraseña en el siguiente paso — escríbela tú. GovMatch nunca la llena.",
              ],
            },
          },
        },
        {
          id: "login_signin",
          sig: ["usuarios existentes", "existing users"],
          g: {
            en: {
              where: "Sign in to Login.gov (existing users).",
              next: [
                "Enter your Login.gov email and password.",
                "Click Submit, then complete two-factor authentication.",
                "You'll be returned to SAM.gov.",
              ],
              ready: [],
              sensitive: [
                "Your password — type it yourself. GovMatch never reads or fills it.",
              ],
            },
            es: {
              where: "Inicia sesión en Login.gov (usuarios existentes).",
              next: [
                "Ingresa tu correo y contraseña de Login.gov.",
                "Haz clic en Enviar y completa la verificación en dos pasos.",
                "Volverás a SAM.gov.",
              ],
              ready: [],
              sensitive: [
                "Tu contraseña — escríbela tú. GovMatch nunca la lee ni la llena.",
              ],
            },
          },
        },
      ],
    },
  };

  /* ------------------------------- journey ---------------------------------- *
   * The whole path from zero to a submitted application, across Login.gov →
   * SAM.gov → Grants.gov. Ordered milestones the founder can check off; the
   * panel highlights the one matching the page they're on. Curated + bilingual;
   * only official root domains are named. Progress persists in chrome.storage.
   * ------------------------------------------------------------------------- */

  var JOURNEY = [
    {
      id: "login",
      site: "Login.gov",
      url: OFFICIAL.login,
      en: { title: "Create your Login.gov account", steps: [
        "SAM.gov and Grants.gov both sign you in through Login.gov — set this up first.",
        "Use a business email you'll keep, and save the recovery codes somewhere safe.",
        "You'll enable two-factor (phone or authenticator app).",
      ] },
      es: { title: "Crea tu cuenta de Login.gov", steps: [
        "SAM.gov y Grants.gov inician sesión a través de Login.gov — configúralo primero.",
        "Usa un correo de empresa que vayas a conservar y guarda los códigos de recuperación.",
        "Activarás verificación en dos pasos (teléfono o app autenticadora).",
      ] },
    },
    {
      id: "uei",
      site: "SAM.gov",
      url: OFFICIAL.sam,
      en: { title: "Sign in to SAM.gov & start Entity Registration (get your UEI)", steps: [
        "On the SAM.gov home page, in the “Register Your Entity or Get a Unique Entity ID” box, click “Get Started”.",
        "Sign in with Login.gov when prompted. Choose full entity registration (not just a UEI) if you want funding.",
        "SAM.gov issues your 12-character UEI — DUNS numbers are retired.",
        "Have your legal business name + physical address exactly as the IRS has them — it gets validated.",
      ] },
      es: { title: "Entra a SAM.gov e inicia el Registro de Entidad (obtén tu UEI)", steps: [
        "En la página de inicio de SAM.gov, en el cuadro “Register Your Entity or Get a Unique Entity ID”, haz clic en “Get Started”.",
        "Inicia sesión con Login.gov cuando te lo pida. Elige el registro completo (no solo el UEI) si quieres recibir fondos.",
        "SAM.gov te da tu UEI de 12 caracteres — los números DUNS ya no se usan.",
        "Ten el nombre legal + dirección física tal como los tiene el IRS — se valida.",
      ] },
    },
    {
      id: "validation",
      site: "SAM.gov",
      url: OFFICIAL.sam,
      en: { title: "Validate your entity (legal name + address)", steps: [
        "Pick the record that matches your business exactly; if none matches, upload proof.",
        "This can take a few days if documents are needed — start early.",
      ] },
      es: { title: "Valida tu entidad (nombre legal + dirección)", steps: [
        "Elige el registro que coincida exactamente; si ninguno coincide, sube un comprobante.",
        "Puede tardar unos días si piden documentos — empieza pronto.",
      ] },
    },
    {
      id: "core",
      site: "SAM.gov",
      url: OFFICIAL.sam,
      en: { title: "Complete Core Data (business info + banking)", steps: [
        "Confirm business type, start date and fiscal year-end.",
        "Enter banking (EFT) details so agencies can pay you, and create your MPIN.",
        "A CAGE code is assigned automatically for U.S. entities.",
      ] },
      es: { title: "Completa Core Data (info del negocio + banco)", steps: [
        "Confirma tipo de negocio, fecha de inicio y cierre del año fiscal.",
        "Ingresa datos bancarios (EFT) para que te paguen y crea tu MPIN.",
        "El código CAGE se asigna automáticamente para entidades de EE. UU.",
      ] },
    },
    {
      id: "assertions",
      site: "SAM.gov",
      url: OFFICIAL.sam,
      en: { title: "Complete Assertions (NAICS + size)", steps: [
        "Add the NAICS codes that describe your work.",
        "Enter size metrics (employees / revenue) honestly — they set small-business status.",
      ] },
      es: { title: "Completa Assertions (NAICS + tamaño)", steps: [
        "Agrega los códigos NAICS que describen tu trabajo.",
        "Ingresa métricas de tamaño (empleados / ingresos) con honestidad.",
      ] },
    },
    {
      id: "reps",
      site: "SAM.gov",
      url: OFFICIAL.sam,
      en: { title: "Complete Representations & Certifications", steps: [
        "Answer each FAR/DFARS question truthfully — these are legal certifications.",
        "If a question is unclear, check the official help rather than guessing.",
      ] },
      es: { title: "Completa Representations & Certifications", steps: [
        "Responde cada pregunta FAR/DFARS con la verdad — son certificaciones legales.",
        "Si una pregunta no es clara, consulta la ayuda oficial en vez de adivinar.",
      ] },
    },
    {
      id: "poc",
      site: "SAM.gov",
      url: OFFICIAL.sam,
      en: { title: "Add your Points of Contact", steps: [
        "The Electronic Business POC matters — they authorize people in Grants.gov later.",
        "Use real, reachable people.",
      ] },
      es: { title: "Agrega tus Points of Contact", steps: [
        "El Electronic Business POC es clave — autoriza a las personas en Grants.gov después.",
        "Usa personas reales y localizables.",
      ] },
    },
    {
      id: "active",
      site: "SAM.gov",
      url: OFFICIAL.sam,
      en: { title: "Confirm registration is “Active” & set a renewal reminder", steps: [
        "Activation can take several business days — don't apply until it's Active.",
        "Registration must be renewed every year, so set a reminder now.",
      ] },
      es: { title: "Confirma que el registro esté “Active” y pon un recordatorio de renovación", steps: [
        "La activación puede tardar varios días hábiles — no apliques hasta que esté Active.",
        "El registro se renueva cada año, así que pon un recordatorio ya.",
      ] },
    },
    {
      id: "grants_account",
      site: "Grants.gov",
      url: OFFICIAL.grants,
      en: { title: "Create a Grants.gov account & get AOR authorization", steps: [
        "Register a profile tied to your organization's UEI.",
        "Your E-Biz POC (from SAM.gov) approves you as an Authorized Organization Rep (AOR).",
        "Only an AOR can submit applications.",
      ] },
      es: { title: "Crea una cuenta en Grants.gov y obtén autorización AOR", steps: [
        "Registra un perfil ligado al UEI de tu organización.",
        "Tu E-Biz POC (de SAM.gov) te aprueba como Representante Autorizado (AOR).",
        "Solo un AOR puede enviar solicitudes.",
      ] },
    },
    {
      id: "find",
      site: "Grants.gov",
      url: OFFICIAL.grants,
      en: { title: "Find an opportunity & start a Workspace", steps: [
        "Confirm eligibility + deadline on the opportunity's own page — that's the source of truth.",
        "Click “Apply” to create a Workspace.",
      ] },
      es: { title: "Encuentra una oportunidad e inicia un Workspace", steps: [
        "Confirma elegibilidad + fecha límite en la página de la oportunidad — es la fuente oficial.",
        "Haz clic en “Apply” para crear un Workspace.",
      ] },
    },
    {
      id: "forms",
      site: "Grants.gov",
      url: OFFICIAL.grants,
      en: { title: "Complete the Workspace forms", steps: [
        "Fill each form (webform or downloadable PDF). Save often.",
        "Use “Check Application” to catch errors before submitting.",
      ] },
      es: { title: "Completa los formularios del Workspace", steps: [
        "Completa cada formulario (web o PDF descargable). Guarda seguido.",
        "Usa “Check Application” para detectar errores antes de enviar.",
      ] },
    },
    {
      id: "submit",
      site: "Grants.gov",
      url: OFFICIAL.grants,
      en: { title: "Review & have your AOR submit", steps: [
        "Only the AOR clicks Submit — GovMatch never does this for you.",
        "Keep the tracking number Grants.gov gives you after submission.",
      ] },
      es: { title: "Revisa y que tu AOR envíe", steps: [
        "Solo el AOR hace clic en Submit — GovMatch nunca lo hace por ti.",
        "Guarda el número de seguimiento que te da Grants.gov tras enviar.",
      ] },
    },
  ];

  // Map a detected stage id → the journey step the user is currently on.
  var STAGE_TO_STEP = {
    sam_uei: "uei",
    sam_validation: "validation",
    sam_core_data: "core",
    sam_assertions: "assertions",
    sam_reps_certs: "reps",
    sam_poc: "poc",
    sam_workspace: "active",
    grants_register: "grants_account",
    grants_search: "find",
    grants_workspace: "forms",
    grants_submit: "submit",
  };

  function currentStepFor(site, stageId) {
    if (STAGE_TO_STEP[stageId]) return STAGE_TO_STEP[stageId];
    if (site === "login.gov") return "login"; // Login.gov = the account step
    if (site === "sam.gov") return "uei"; // on SAM.gov but no specific stage
    if (site === "grants.gov") return "grants_account";
    return null;
  }

  /* ------------------------------ panel i18n -------------------------------- */

  var UI = {
    en: {
      title: "GovMatch guide",
      journeyLabel: "Your process, start to finish",
      progressFmt: function (done, total) {
        return "Step " + Math.min(done + 1, total) + " of " + total + " · " + done + " done";
      },
      youAreHere: "you're here",
      goTo: "Go to",
      startHere: "Start here",
      showAllSteps: function (n) { return "See all " + n + " steps ▾"; },
      hideSteps: "Show only my current step ▴",
      journeyDoneMsg: "🎉 All milestones checked. Great work!",
      whereLabel: "Where you are",
      nextLabel: "What's next",
      readyLabel: "Have ready",
      sensitiveLabel: "You fill these yourself",
      onPageLabel: "On this page",
      fieldsSummary: function (n, s) {
        return n + (n === 1 ? " field detected" : " fields detected") + (s ? " · " + s + " sensitive" : "");
      },
      fieldsHint: "Tap a field to locate & highlight it on the page.",
      noFields: "No form fields detected on this page yet.",
      reqTag: "required",
      sensTag: "sensitive",
      highlightSensitive: "Highlight sensitive fields",
      pointBtn: "👉 Show me the button",
      clickHere: "Click here",
      typeHere: "Type here",
      disclaimer: function (site) {
        return "General guidance. " + site + " always defines the official steps and requirements.";
      },
      minimize: "Minimize",
      close: "Hide",
      reopen: "GovMatch guide",
    },
    es: {
      title: "Guía GovMatch",
      journeyLabel: "Tu proceso, de principio a fin",
      progressFmt: function (done, total) {
        return "Paso " + Math.min(done + 1, total) + " de " + total + " · " + done + " listos";
      },
      youAreHere: "estás aquí",
      goTo: "Ve a",
      startHere: "Empieza aquí",
      showAllSteps: function (n) { return "Ver los " + n + " pasos ▾"; },
      hideSteps: "Mostrar solo mi paso actual ▴",
      journeyDoneMsg: "🎉 Marcaste todos los pasos. ¡Excelente!",
      whereLabel: "Dónde estás",
      nextLabel: "Qué sigue",
      readyLabel: "Ten a mano",
      sensitiveLabel: "Estos los llenas tú",
      onPageLabel: "En esta página",
      fieldsSummary: function (n, s) {
        return n + (n === 1 ? " campo detectado" : " campos detectados") + (s ? " · " + s + " sensibles" : "");
      },
      fieldsHint: "Toca un campo para ubicarlo y resaltarlo en la página.",
      noFields: "Aún no se detectan campos de formulario en esta página.",
      reqTag: "obligatorio",
      sensTag: "sensible",
      highlightSensitive: "Resaltar campos sensibles",
      pointBtn: "👉 Señalar el botón",
      clickHere: "Haz clic aquí",
      typeHere: "Escribe aquí",
      disclaimer: function (site) {
        return "Guía general. " + site + " siempre define los pasos y requisitos oficiales.";
      },
      minimize: "Minimizar",
      close: "Ocultar",
      reopen: "Guía GovMatch",
    },
  };

  /* --------------------- action targets (from real DOM) --------------------- *
   * Per journey step, how to find the PRIMARY action button on the real page.
   * Curated from the actual SAM.gov / Grants.gov markup (href + visible text).
   * More are added as real page DOMs are confirmed; unmatched steps just skip.
   * ------------------------------------------------------------------------- */
  var STEP_TARGETS = {
    login: [
      // Create-account page (/sign_up/enter_email) — ORDERED sequence:
      //   1) email field, 2) accept Rules-of-Use checkbox (its label), 3) Submit.
      { path: "sign_up/enter_email", sel: "#user_email" },
      { path: "sign_up/enter_email", sel: 'label[for="user_terms_accepted"]' },
      { path: "sign_up/enter_email", text: "enviar" },
      { path: "sign_up/enter_email", text: "submit" },
      // Base sign-in page: point at "Create an account" / "Crear una cuenta".
      { href: "sign_up/enter_email" },
    ],
    uei: [
      // On /entity-registration, after clicking Get Started SAM.gov shows a
      // Terms-of-Use modal; point at its "Agree" button when present. Listed
      // FIRST so it wins over Get Started once the modal is up.
      { path: "/entity-registration", text: "agree" },
      // Page 2 — /entity-registration: the green proceed button
      // <a class="... signin-trigger-btn" href="#">Get Started</a>. Matched by
      // class + text so it beats the hidden carousel "Get Started" link.
      { path: "/entity-registration", cls: "signin-trigger-btn", text: "get started" },
      // Home page: <a href="/entity-registration" ...>Get Started</a>
      { href: "/entity-registration", text: "get started" },
    ],
    active: [{ href: "/content/status-tracker", text: "check entity status" }],
  };

  /* ------------------------------- detection -------------------------------- */

  function siteKey() {
    var h = location.hostname.toLowerCase();
    if (h.indexOf("grants.gov") !== -1) return "grants.gov";
    if (h.indexOf("login.gov") !== -1) return "login.gov";
    if (h.indexOf("sam.gov") !== -1) return "sam.gov";
    return null;
  }

  // Build a lowercase haystack from the page's HEADINGS + title + path only
  // (not the whole body) to avoid false matches from unrelated prose.
  function pageHaystack() {
    var parts = [document.title || "", location.pathname || ""];
    var sel = "h1,h2,h3,legend,[role=heading],.page-title,.breadcrumb,.usa-step-indicator__segment,.wizard-step,.sam-ui-header,mark";
    var nodes = document.querySelectorAll(sel);
    for (var i = 0; i < nodes.length && i < 300; i++) {
      var txt = (nodes[i].textContent || "").trim();
      if (txt && txt.length < 200) parts.push(txt);
    }
    return parts.join("  ").toLowerCase();
  }

  function detectStage(site) {
    var conf = SITES[site];
    if (!conf) return null;
    var hay = pageHaystack();
    var best = null;
    var bestHits = 0;
    conf.stages.forEach(function (stage) {
      var hits = 0;
      stage.sig.forEach(function (kw) {
        if (hay.indexOf(kw) !== -1) hits++;
      });
      if (hits > bestHits) {
        bestHits = hits;
        best = stage;
      }
    });
    return bestHits > 0 ? best : null; // null → show the site overview
  }

  /* ---------------------- live DOM scan (real fields) ----------------------- *
   * Reads the ACTUAL form fields present on the page and maps each to a curated
   * concept from fieldMap.js (labels/name/id — never invented). Returns the real
   * inventory: what fields exist, which are sensitive, which are required.
   * ------------------------------------------------------------------------- */

  function norm(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function fieldConcepts() {
    var m = (typeof window !== "undefined" && window.GOVMATCH_FIELD_MAP) || null;
    return m && Array.isArray(m.concepts) ? m.concepts : [];
  }

  function scanFields() {
    var concepts = fieldConcepts();
    var nodes = document.querySelectorAll("input, textarea, select");
    var out = [];
    var seenEls = [];
    for (var i = 0; i < nodes.length && out.length < 40; i++) {
      var el = nodes[i];
      if (!isFillableDom(el)) continue;
      if (seenEls.indexOf(el) !== -1) continue;
      seenEls.push(el);

      var labelTxt = (labelTextForDom(el) || "").trim();
      var sem = semanticStringDom(el);
      var hay = norm(labelTxt + " " + sem);
      if (!hay) continue;

      var concept = matchConceptDom(concepts, hay);
      var human = labelTxt || el.getAttribute("name") || el.getAttribute("id") || (concept ? concept.id : "field");
      human = human.replace(/\s+/g, " ").trim();
      if (human.length > 60) human = human.slice(0, 57) + "…";

      var sensitive = concept ? !!concept.sensitive : looksSensitive(hay);
      var required =
        el.required ||
        el.getAttribute("aria-required") === "true" ||
        /\*|\brequired\b|\bobligatorio\b/.test(labelTxt.toLowerCase());

      out.push({
        el: el,
        human: human,
        conceptId: concept ? concept.id : null,
        sensitive: sensitive,
        required: !!required,
        guide: concept && concept.guide ? concept.guide[lang] || concept.guide.en : null,
      });
    }
    return out;
  }

  function matchConceptDom(concepts, hay) {
    var best = null;
    var bestScore = 0;
    concepts.forEach(function (c) {
      var kws = (c.labelKeywords || []).concat(c.semanticKeywords || []);
      kws.forEach(function (kw) {
        var nk = norm(kw);
        if (nk && hay.indexOf(nk) !== -1 && nk.length > bestScore) {
          bestScore = nk.length;
          best = c;
        }
      });
    });
    return best;
  }

  // Fallback sensitivity heuristic when no concept matches (never auto-anything;
  // only used to flag "fill this yourself" so we err on the side of caution).
  function looksSensitive(hay) {
    return /\b(ssn|social security|ein|tax id|taxpayer|tin|bank|routing|account number|mpin|password|passcode|date of birth|dob)\b/.test(hay);
  }

  function isVisibleDom(el) {
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    var st = window.getComputedStyle(el);
    return st.display !== "none" && st.visibility !== "hidden" && st.opacity !== "0";
  }

  function isFillableDom(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toLowerCase();
    if (tag === "input") {
      var type = (el.getAttribute("type") || "text").toLowerCase();
      if (["hidden", "submit", "button", "reset", "image"].indexOf(type) !== -1) return false;
    } else if (tag !== "textarea" && tag !== "select") {
      return false;
    }
    return isVisibleDom(el);
  }

  function labelTextForDom(el) {
    if (el.id) {
      var lbl = document.querySelector('label[for="' + cssEscapeDom(el.id) + '"]');
      if (lbl && lbl.textContent) return lbl.textContent;
    }
    var p = el.parentElement;
    var hops = 0;
    while (p && hops < 4) {
      if (p.tagName && p.tagName.toLowerCase() === "label" && p.textContent) return p.textContent;
      p = p.parentElement;
      hops++;
    }
    var aria = el.getAttribute("aria-label");
    if (aria) return aria;
    var by = el.getAttribute("aria-labelledby");
    if (by) {
      var ref = document.getElementById(by);
      if (ref && ref.textContent) return ref.textContent;
    }
    return "";
  }

  function semanticStringDom(el) {
    return [
      el.getAttribute("name"),
      el.getAttribute("id"),
      el.getAttribute("placeholder"),
      el.getAttribute("aria-label"),
    ]
      .filter(Boolean)
      .join(" ");
  }

  function cssEscapeDom(s) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(s);
    return String(s).replace(/([^a-zA-Z0-9_-])/g, "\\$1");
  }

  // Highlight a REAL page element (inline styles → CSP-safe), scroll to it.
  var lastHi = null;
  function highlightOnPage(el, strong) {
    if (lastHi && lastHi.el) restoreEl(lastHi);
    lastHi = {
      el: el,
      outline: el.style.outline,
      offset: el.style.outlineOffset,
      shadow: el.style.boxShadow,
      scroll: el.style.scrollMarginTop,
    };
    el.style.outline = (strong ? "3px" : "3px") + " solid " + (strong ? "#dc2626" : "#2563eb");
    el.style.outlineOffset = "2px";
    el.style.boxShadow = "0 0 0 6px " + (strong ? "rgba(220,38,38,.18)" : "rgba(37,99,235,.18)");
    el.style.scrollMarginTop = "120px";
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {
      /* ignore */
    }
  }
  function restoreEl(hi) {
    try {
      hi.el.style.outline = hi.outline;
      hi.el.style.outlineOffset = hi.offset;
      hi.el.style.boxShadow = hi.shadow;
      hi.el.style.scrollMarginTop = hi.scroll;
    } catch (e) {
      /* ignore */
    }
  }

  function highlightAllSensitive(fields) {
    var sens = fields.filter(function (f) {
      return f.sensitive;
    });
    sens.forEach(function (f, idx) {
      // outline each; keep them all (don't restore between) by not using lastHi.
      f.el.style.outline = "3px solid #dc2626";
      f.el.style.outlineOffset = "2px";
      f.el.style.boxShadow = "0 0 0 6px rgba(220,38,38,.18)";
      if (idx === 0) {
        try {
          f.el.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch (e) {
          /* ignore */
        }
      }
    });
  }

  /* --------------------- point at the real action button -------------------- */

  // Evaluate a matcher against an element. Each of href/text/cls is either
  // unspecified (null) or a boolean of whether it matched.
  function matcherMatch(el, m) {
    var href = (el.getAttribute && el.getAttribute("href")) || "";
    var txt = norm(el.textContent || el.value || "");
    var cls = (el.className || "") + "";
    return {
      href: m.href ? href.indexOf(m.href) !== -1 : null,
      text: m.text ? txt.indexOf(norm(m.text)) !== -1 : null,
      cls: m.cls ? cls.indexOf(m.cls) !== -1 : null,
    };
  }

  function safeQuery(sel) {
    try {
      return document.querySelector(sel);
    } catch (e) {
      return null;
    }
  }

  // Resolve ONE matcher to a visible element. Supports:
  //   sel  — a CSS selector (for form fields/labels), OR
  //   href/text/cls — scanned over clickables (strict pass, then loose).
  function resolveOne(m) {
    if (m.sel) {
      var q = safeQuery(m.sel);
      return q && isVisibleDom(q) ? q : null;
    }
    var nodes = document.querySelectorAll('a, button, [role="button"], input[type="submit"]');
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (!isVisibleDom(el)) continue;
        var r = matcherMatch(el, m);
        var spec = [r.href, r.text, r.cls].filter(function (x) {
          return x !== null;
        });
        if (!spec.length) continue;
        var hit = pass === 0 ? spec.every(Boolean) : spec.some(Boolean);
        if (hit) return el;
      }
    }
    return null;
  }

  // The ORDERED list of real elements to do on this page for a journey step
  // (e.g. Login.gov create-account: email → accept Rules of Use → Submit).
  // Matchers may be scoped by `path`. Returns visible elements in order, deduped.
  function actionTargetsFor(stepId) {
    var matchers = STEP_TARGETS[stepId];
    if (!matchers) return [];
    var path = location.pathname || "";
    var out = [];
    matchers.forEach(function (m) {
      if (m.path && path.indexOf(m.path) === -1) return;
      var el = resolveOne(m);
      if (el && out.indexOf(el) === -1) out.push(el);
    });
    return out;
  }

  // The single primary target (first in the sequence) — for auto-point + sig.
  function findActionTarget(stepId) {
    return actionTargetsFor(stepId)[0] || null;
  }

  // A human label for an element: a field's own <label>, else its visible text.
  function describeEl(el) {
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "select" || tag === "textarea") {
      var l = (labelTextForDom(el) || "").replace(/\s+/g, " ").trim();
      if (l) return l.length > 40 ? l.slice(0, 38) + "…" : l;
    }
    return shortText(el) || (el.getAttribute && el.getAttribute("aria-label")) || "this";
  }

  // "Type here" for fields, "Click here" for buttons/links.
  function pointerLabel(el, u) {
    var tag = (el.tagName || "").toLowerCase();
    var type = (el.getAttribute && (el.getAttribute("type") || "")).toLowerCase();
    var isField =
      (tag === "input" && ["submit", "button", "checkbox", "radio"].indexOf(type) === -1) ||
      tag === "select" ||
      tag === "textarea";
    return (isField ? u.typeHere : u.clickHere) + ": " + describeEl(el);
  }

  var pointer = null; // { el, saved, interval, badge, onScroll, badgeRef }
  function clearPointer() {
    if (!pointer) return;
    if (pointer.interval) clearInterval(pointer.interval);
    if (pointer.el && pointer.saved) {
      pointer.el.style.outline = pointer.saved.outline;
      pointer.el.style.outlineOffset = pointer.saved.offset;
      pointer.el.style.boxShadow = pointer.saved.shadow;
      pointer.el.style.scrollMarginTop = pointer.saved.scroll;
    }
    if (pointer.badge && pointer.badge.parentNode) pointer.badge.parentNode.removeChild(pointer.badge);
    if (pointer.onScroll) {
      window.removeEventListener("scroll", pointer.onScroll, true);
      window.removeEventListener("resize", pointer.onScroll);
    }
    pointer = null;
  }

  // Eye-catching: scroll to the real button, pulse a big ring around it, and
  // float a "👉 Click here: <label>" badge anchored to it. Inline styles only
  // (CSP-safe); animated via setInterval (no injected @keyframes needed).
  function pointToTarget(el, label) {
    clearPointer();
    var saved = {
      outline: el.style.outline,
      offset: el.style.outlineOffset,
      shadow: el.style.boxShadow,
      scroll: el.style.scrollMarginTop,
    };
    el.style.scrollMarginTop = "150px";
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {
      /* ignore */
    }

    var badge = document.createElement("div");
    badge.setAttribute("data-govmatch-pointer", "1");
    badge.style.cssText =
      "position:fixed;z-index:2147483647;background:#dc2626;color:#fff;" +
      "font:800 13px/1.2 system-ui,-apple-system,sans-serif;padding:8px 12px;" +
      "border-radius:10px;box-shadow:0 8px 24px rgba(220,38,38,.45);" +
      "pointer-events:none;white-space:nowrap;max-width:70vw;overflow:hidden;text-overflow:ellipsis;";
    badge.textContent = "👉 " + label;
    (document.body || document.documentElement).appendChild(badge);

    var on = false;
    function paint() {
      on = !on;
      el.style.outline = (on ? "4px solid #dc2626" : "4px solid #f59e0b");
      el.style.outlineOffset = "3px";
      el.style.boxShadow = on ? "0 0 0 10px rgba(220,38,38,.30)" : "0 0 0 6px rgba(245,158,11,.28)";
    }
    paint();
    var interval = setInterval(paint, 560);

    function position() {
      var r = el.getBoundingClientRect();
      var top = r.top - 42;
      if (top < 8) top = Math.min(r.bottom + 10, window.innerHeight - 40);
      var left = Math.max(8, Math.min(r.left, window.innerWidth - 200));
      badge.style.top = top + "px";
      badge.style.left = left + "px";
    }
    position();
    var onScroll = function () {
      position();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);

    var thisBadge = badge;
    pointer = { el: el, saved: saved, interval: interval, badge: badge, onScroll: onScroll };
    // Stop the pulsing after a while, but only if it's still THIS pointer.
    setTimeout(function () {
      if (pointer && pointer.badge === thisBadge) clearPointer();
    }, 14000);
  }

  /* --------------------------------- render --------------------------------- */

  var lang = "en";
  var dismissed = false;
  var lastSignature = "";
  var journeyDone = {}; // { stepId: true }
  var expandedStep = null; // which journey step is expanded in the panel
  var journeyExpanded = false; // show all 12 steps vs. just the current one
  var autoPointedKey = ""; // stepId|pathname we've already auto-pointed for

  function journeyDoneCount() {
    var n = 0;
    for (var k in journeyDone) if (journeyDone[k]) n++;
    return n;
  }

  function saveJourney() {
    var ids = [];
    for (var k in journeyDone) if (journeyDone[k]) ids.push(k);
    try {
      chrome.storage.local.set({ govmatch_journey: ids });
    } catch (e) {
      /* ignore */
    }
  }

  function toggleJourneyStep(id) {
    journeyDone[id] = !journeyDone[id];
    saveJourney();
    lastSignature = "";
    render();
  }

  function setLang(next) {
    lang = next === "es" ? "es" : "en";
    try {
      chrome.storage.local.set({ govmatch_lang: lang });
    } catch (e) {
      /* ignore */
    }
    lastSignature = "";
    render();
  }

  function guidanceFor(site) {
    var conf = SITES[site];
    var stage = detectStage(site);
    var g = stage ? stage.g[lang] : conf.overview[lang];
    return { conf: conf, stageId: stage ? stage.id : "overview", g: g };
  }

  function render() {
    var site = siteKey();
    if (!site) return;
    if (dismissed) {
      renderReopenPill();
      return;
    }

    var info = guidanceFor(site);
    var fields = scanFields();
    var sensCount = fields.filter(function (f) {
      return f.sensitive;
    }).length;

    var currentStep = currentStepFor(site, info.stageId);
    // First render on a page: auto-expand the step you're on so it teaches you.
    if (expandedStep === null) expandedStep = currentStep;

    // The ORDERED action elements for the current step on THIS page (email →
    // terms → Submit, or a single button). The first is the primary target;
    // its signature is part of the render signature so the panel refreshes when
    // the page changes (e.g. a Terms modal swaps the button).
    var actionTargets = currentStep ? actionTargetsFor(currentStep) : [];
    var actionTarget = actionTargets[0] || null;
    var targetSig = actionTargets.length
      ? actionTargets.length + "|" + describeEl(actionTarget)
      : "none";

    // Avoid pointless re-renders (SPA mutations fire constantly). The field
    // inventory + journey state + action target are part of the signature so the
    // panel refreshes when the real page changes or a milestone is checked off.
    var sig =
      lang + "|" + info.stageId + "|" + fields.length + "|" + sensCount +
      "|" + currentStep + "|" + expandedStep + "|" + journeyDoneCount() +
      "|" + journeyExpanded + "|" + targetSig;
    if (sig === lastSignature && document.getElementById(HOST_ID)) return;
    lastSignature = sig;

    var host = ensureHost();
    var root = host.shadowRoot;
    var u = UI[lang];
    var g = info.g;

    clearNode(root);
    root.appendChild(styleEl());

    var panel = div("gm-panel");

    // Current step number (so the sticky header ALWAYS shows which step you're on).
    var stepNum = 0;
    for (var si = 0; si < JOURNEY.length; si++) {
      if (JOURNEY[si].id === currentStep) {
        stepNum = si + 1;
        break;
      }
    }

    // header (sticky — stays visible while the body scrolls)
    var header = div("gm-header");
    var titleWrap = div("gm-title");
    titleWrap.appendChild(textSpan("gm-dot", ""));
    var titleText = stepNum
      ? u.title + " · " + stepNum + "/" + JOURNEY.length
      : u.title + " · " + info.conf.label;
    titleWrap.appendChild(textSpan("gm-title-text", titleText));
    header.appendChild(titleWrap);
    var btns = div("gm-hbtns");
    btns.appendChild(langToggle());
    btns.appendChild(iconBtn("–", u.minimize, function () {
      dismissed = true;
      clearPointer();
      render();
    }));
    header.appendChild(btns);
    panel.appendChild(header);

    // YOUR PROCESS — the full journey from zero, with the current step live.
    panel.appendChild(journeySection(u, currentStep));

    // where
    panel.appendChild(section(u.whereLabel, "gm-where", [g.where]));
    // next
    if (g.next && g.next.length) panel.appendChild(listSection(u.nextLabel, "gm-next", g.next, "➡"));
    // ready
    if (g.ready && g.ready.length) panel.appendChild(listSection(u.readyLabel, "gm-ready", g.ready, "•"));
    // sensitive
    if (g.sensitive && g.sensitive.length) panel.appendChild(listSection(u.sensitiveLabel, "gm-sensitive", g.sensitive, "🔒"));

    // ON THIS PAGE — the live DOM scan of the real fields present.
    panel.appendChild(fieldsSection(u, fields, sensCount));

    // disclaimer
    var disc = div("gm-disc");
    disc.textContent = u.disclaimer(info.conf.label);
    panel.appendChild(disc);

    root.appendChild(panel);

    // Eye-catching: auto-point at the current step's real action button. Keyed
    // by step + path + target, so it re-points when the target changes on the
    // same page (e.g. the Terms modal's "Agree" replaces "Get Started").
    if (currentStep && actionTarget) {
      var pathKey = (currentStep || "") + "|" + (location.pathname || "") + "|" + targetSig;
      if (autoPointedKey !== pathKey) {
        autoPointedKey = pathKey;
        pointToTarget(actionTarget, pointerLabel(actionTarget, u));
      }
    }
  }

  function renderReopenPill() {
    var host = ensureHost();
    var root = host.shadowRoot;
    var sig = "pill|" + lang;
    if (sig === lastSignature && document.getElementById(HOST_ID)) return;
    lastSignature = sig;
    clearNode(root);
    root.appendChild(styleEl());
    var pill = document.createElement("button");
    pill.className = "gm-pill";
    pill.textContent = "🏛️ " + UI[lang].reopen;
    pill.addEventListener("click", function () {
      dismissed = false;
      lastSignature = "";
      render();
    });
    root.appendChild(pill);
  }

  /* ------------------------------ DOM builders ------------------------------ */

  // Trusted-Types-safe clear (government sites may block innerHTML assignment).
  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  // "On this page" — the live inventory of REAL fields, each clickable to locate
  // and highlight it on the page. Facts (labels, count, sensitivity) come from
  // the page's own DOM + the curated concept map; nothing is invented.
  function fieldsSection(u, fields, sensCount) {
    var wrap = div("gm-section gm-onpage");
    wrap.appendChild(textSpan("gm-label", u.onPageLabel));

    if (!fields.length) {
      var empty = div("gm-body");
      empty.textContent = u.noFields;
      wrap.appendChild(empty);
      return wrap;
    }

    var summary = div("gm-fsummary");
    summary.textContent = u.fieldsSummary(fields.length, sensCount);
    wrap.appendChild(summary);

    var hint = div("gm-fhint");
    hint.textContent = u.fieldsHint;
    wrap.appendChild(hint);

    var list = div("gm-fields");
    fields.forEach(function (f) {
      var row = document.createElement("button");
      row.className = "gm-field" + (f.sensitive ? " gm-field-sens" : "");
      row.type = "button";

      var top = div("gm-field-top");
      top.appendChild(textSpan("gm-field-icon", f.sensitive ? "🔒" : "▤"));
      top.appendChild(textSpan("gm-field-name", f.human));
      if (f.required) top.appendChild(tag(u.reqTag, "gm-tag-req"));
      if (f.sensitive) top.appendChild(tag(u.sensTag, "gm-tag-sens"));
      row.appendChild(top);

      if (f.guide) {
        var gd = div("gm-field-guide");
        gd.textContent = f.guide;
        row.appendChild(gd);
      }

      row.addEventListener("click", function () {
        highlightOnPage(f.el, f.sensitive);
      });
      list.appendChild(row);
    });
    wrap.appendChild(list);

    if (sensCount > 0) {
      var allBtn = document.createElement("button");
      allBtn.className = "gm-hi-all";
      allBtn.type = "button";
      allBtn.textContent = "🔒 " + u.highlightSensitive;
      allBtn.addEventListener("click", function () {
        highlightAllSensitive(fields);
      });
      wrap.appendChild(allBtn);
    }

    return wrap;
  }

  function tag(text, cls) {
    var s = document.createElement("span");
    s.className = "gm-tag " + cls;
    s.textContent = text;
    return s;
  }

  function shortText(el) {
    var t = (el.textContent || el.value || "").replace(/\s+/g, " ").trim();
    return t.length > 40 ? t.slice(0, 38) + "…" : t;
  }

  // "Your process" — the full journey checklist. Current step (from detection)
  // is highlighted; each step can be checked off (persists) and expanded to show
  // the plain instructions. Facts/instructions are curated; nothing invented.
  function journeySection(u, currentStep) {
    var wrap = div("gm-section gm-journey");

    var head = div("gm-jhead");
    head.appendChild(textSpan("gm-label", u.journeyLabel));
    head.appendChild(textSpan("gm-jprogress", u.progressFmt(journeyDoneCount(), JOURNEY.length)));
    wrap.appendChild(head);

    // progress bar
    var barWrap = div("gm-jbar");
    var barFill = div("gm-jbar-fill");
    barFill.style.width = Math.round((journeyDoneCount() / JOURNEY.length) * 100) + "%";
    barWrap.appendChild(barFill);
    wrap.appendChild(barWrap);

    // Compact by default: show ONLY the current step (always visible, its detail
    // open). "See all steps" expands the full 12-step list. Keeps the panel small.
    var list = div("gm-jsteps");
    JOURNEY.forEach(function (step, i) {
      var isCurrent = step.id === currentStep;
      if (!journeyExpanded && !isCurrent) return; // collapsed → current step only
      var forceOpen = !journeyExpanded && isCurrent; // always open the current one
      list.appendChild(journeyStepRow(u, step, i, currentStep, forceOpen));
    });
    wrap.appendChild(list);

    // Toggle to reveal / hide the full list.
    var toggle = document.createElement("button");
    toggle.className = "gm-jtoggle";
    toggle.type = "button";
    toggle.textContent = journeyExpanded ? u.hideSteps : u.showAllSteps(JOURNEY.length);
    toggle.addEventListener("click", function () {
      journeyExpanded = !journeyExpanded;
      lastSignature = "";
      render();
    });
    wrap.appendChild(toggle);

    if (journeyDoneCount() === JOURNEY.length) {
      var msg = div("gm-jdone-msg");
      msg.textContent = u.journeyDoneMsg;
      wrap.appendChild(msg);
    }

    return wrap;
  }

  function journeyStepRow(u, step, i, currentStep, forceOpen) {
    var done = !!journeyDone[step.id];
    var isCurrent = step.id === currentStep;
    var isOpen = forceOpen || expandedStep === step.id;
    var loc = step[lang] || step.en;

    var row = div("gm-jstep" + (isCurrent ? " gm-jstep-cur" : "") + (done ? " gm-jstep-done" : ""));

    var top = div("gm-jstep-top");
    var box = document.createElement("button");
    box.className = "gm-jcheck" + (done ? " on" : "");
    box.type = "button";
    box.textContent = done ? "✓" : "";
    box.setAttribute("aria-label", loc.title);
    box.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleJourneyStep(step.id);
    });
    top.appendChild(box);

    var titleBtn = document.createElement("button");
    titleBtn.className = "gm-jtitle";
    titleBtn.type = "button";
    titleBtn.appendChild(textSpan("gm-jnum", i + 1 + "."));
    titleBtn.appendChild(textSpan("gm-jname", loc.title));
    if (isCurrent) titleBtn.appendChild(tag(u.youAreHere, "gm-tag-here"));
    titleBtn.addEventListener("click", function () {
      // In collapsed mode the current step stays open; toggling is for the full list.
      expandedStep = expandedStep === step.id ? "__none__" : step.id;
      lastSignature = "";
      render();
    });
    top.appendChild(titleBtn);
    row.appendChild(top);

    if (isOpen) {
      var detail = div("gm-jdetail");
      var where = div("gm-jwhere");
      where.textContent = u.goTo + " " + step.site + " · " + step.url;
      detail.appendChild(where);
      var ul = document.createElement("ul");
      ul.className = "gm-jlist";
      (loc.steps || []).forEach(function (s) {
        var li = document.createElement("li");
        li.textContent = s;
        ul.appendChild(li);
      });
      detail.appendChild(ul);

      // The ordered "do this here" targets on THIS page. One → a single point
      // button; several → a numbered sequence (e.g. email → terms → Submit).
      var targets = actionTargetsFor(step.id);
      targets.forEach(function (t, ti) {
        var pb = document.createElement("button");
        pb.className = "gm-point";
        pb.type = "button";
        pb.textContent =
          targets.length > 1
            ? "👉 " + (ti + 1) + ") " + describeEl(t)
            : u.pointBtn + " — " + describeEl(t);
        pb.addEventListener("click", function () {
          pointToTarget(t, pointerLabel(t, u));
        });
        detail.appendChild(pb);
      });
      row.appendChild(detail);
    }
    return row;
  }

  function ensureHost() {
    var host = document.getElementById(HOST_ID);
    if (host) return host;
    host = document.createElement("div");
    host.id = HOST_ID;
    host.attachShadow({ mode: "open" });
    (document.body || document.documentElement).appendChild(host);
    return host;
  }

  function div(cls) {
    var d = document.createElement("div");
    d.className = cls;
    return d;
  }

  function textSpan(cls, text) {
    var s = document.createElement("span");
    s.className = cls;
    s.textContent = text;
    return s;
  }

  function iconBtn(label, title, onClick) {
    var b = document.createElement("button");
    b.className = "gm-iconbtn";
    b.textContent = label;
    b.title = title;
    b.setAttribute("aria-label", title);
    b.addEventListener("click", onClick);
    return b;
  }

  function langToggle() {
    var wrap = div("gm-lang");
    ["en", "es"].forEach(function (code) {
      var b = document.createElement("button");
      b.className = "gm-langbtn" + (lang === code ? " on" : "");
      b.type = "button";
      b.textContent = code.toUpperCase();
      b.addEventListener("click", function () {
        setLang(code);
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function section(label, cls, lines) {
    var wrap = div("gm-section " + cls);
    wrap.appendChild(textSpan("gm-label", label));
    var p = div("gm-body");
    p.textContent = lines.join(" ");
    wrap.appendChild(p);
    return wrap;
  }

  function listSection(label, cls, items, bullet) {
    var wrap = div("gm-section " + cls);
    wrap.appendChild(textSpan("gm-label", label));
    var ul = document.createElement("ul");
    ul.className = "gm-list";
    items.forEach(function (it) {
      var li = document.createElement("li");
      li.textContent = bullet + " " + it;
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    return wrap;
  }

  function styleEl() {
    var s = document.createElement("style");
    s.textContent =
      ":host{all:initial;}" +
      ".gm-panel,.gm-pill{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}" +
      ".gm-panel{position:fixed;right:16px;bottom:16px;width:288px;max-width:calc(100vw - 32px);" +
      "max-height:66vh;overflow-y:auto;overflow-x:hidden;background:#fff;color:#0f172a;border:1px solid #e2e8f0;" +
      "border-radius:14px;box-shadow:0 12px 32px rgba(15,23,42,.22);z-index:2147483647;}" +
      ".gm-jtoggle{margin-top:8px;width:100%;cursor:pointer;border:1px dashed #cbd5e1;border-radius:8px;" +
      "background:#f8fafc;color:#334155;font-family:inherit;font-size:11px;font-weight:700;padding:7px;}" +
      ".gm-jtoggle:hover{background:#eef2ff;border-color:#c7d2fe;}" +
      ".gm-header{position:sticky;top:0;z-index:2;display:flex;align-items:center;" +
      "justify-content:space-between;gap:8px;padding:11px 13px;background:#0f172a;" +
      "border-radius:14px 14px 0 0;}" +
      ".gm-title{display:flex;align-items:center;gap:8px;min-width:0;}" +
      ".gm-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;flex:none;}" +
      ".gm-title-text{color:#fff;font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      ".gm-hbtns{display:flex;align-items:center;gap:6px;flex:none;}" +
      ".gm-lang{display:inline-flex;border:1px solid #334155;border-radius:6px;overflow:hidden;}" +
      ".gm-langbtn{border:none;background:transparent;color:#cbd5e1;font-family:inherit;font-weight:800;" +
      "font-size:10px;padding:3px 6px;cursor:pointer;}" +
      ".gm-langbtn.on{background:#2563eb;color:#fff;}" +
      ".gm-iconbtn{width:24px;height:24px;border:none;border-radius:6px;background:#334155;color:#fff;" +
      "font-size:15px;line-height:1;cursor:pointer;}" +
      ".gm-iconbtn:hover{background:#475569;}" +
      ".gm-section{padding:10px 14px 0;}" +
      ".gm-label{display:block;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin-bottom:3px;}" +
      ".gm-body{font-size:13px;line-height:1.4;color:#1e293b;}" +
      ".gm-where .gm-body{font-weight:600;}" +
      ".gm-list{list-style:none;margin:0;padding:0;}" +
      ".gm-list li{font-size:13px;line-height:1.4;color:#1e293b;padding:2px 0;}" +
      ".gm-sensitive .gm-list li{color:#9a3412;}" +
      ".gm-jhead{display:flex;align-items:baseline;justify-content:space-between;gap:8px;}" +
      ".gm-jprogress{font-size:10px;font-weight:700;color:#2563eb;flex:none;}" +
      ".gm-jbar{height:5px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin:2px 0 8px;}" +
      ".gm-jbar-fill{height:100%;background:#22c55e;border-radius:999px;transition:width .3s;}" +
      ".gm-jsteps{display:flex;flex-direction:column;gap:2px;}" +
      ".gm-jstep{border-radius:8px;padding:2px 0;}" +
      ".gm-jstep-cur{background:#eff6ff;}" +
      ".gm-jstep-top{display:flex;align-items:flex-start;gap:7px;padding:4px 6px;}" +
      ".gm-jcheck{flex:none;width:18px;height:18px;margin-top:1px;border:1.5px solid #cbd5e1;border-radius:5px;" +
      "background:#fff;color:#fff;font-size:11px;font-weight:900;line-height:1;cursor:pointer;padding:0;}" +
      ".gm-jcheck.on{background:#22c55e;border-color:#22c55e;}" +
      ".gm-jtitle{flex:1;display:flex;align-items:baseline;gap:5px;flex-wrap:wrap;text-align:left;" +
      "background:none;border:none;cursor:pointer;font-family:inherit;padding:0;}" +
      ".gm-jnum{font-size:11px;font-weight:800;color:#94a3b8;flex:none;}" +
      ".gm-jname{font-size:12px;font-weight:600;color:#1e293b;line-height:1.35;}" +
      ".gm-jstep-done .gm-jname{color:#94a3b8;text-decoration:line-through;}" +
      ".gm-jstep-cur .gm-jname{color:#1e40af;font-weight:700;}" +
      ".gm-tag-here{background:#2563eb;color:#fff;}" +
      ".gm-jdetail{padding:0 6px 8px 31px;}" +
      ".gm-jwhere{font-size:11px;font-weight:700;color:#2563eb;margin-bottom:4px;word-break:break-word;}" +
      ".gm-jlist{list-style:none;margin:0;padding:0;}" +
      ".gm-jlist li{font-size:12px;line-height:1.4;color:#475569;padding:2px 0 2px 12px;position:relative;}" +
      ".gm-jlist li::before{content:'›';position:absolute;left:0;color:#94a3b8;}" +
      ".gm-jdone-msg{margin-top:8px;font-size:12px;font-weight:700;color:#166534;background:#dcfce7;" +
      "border-radius:8px;padding:8px 10px;text-align:center;}" +
      ".gm-point{margin-top:8px;width:100%;cursor:pointer;border:none;border-radius:9px;" +
      "background:#dc2626;color:#fff;font-family:inherit;font-size:12px;font-weight:800;" +
      "padding:9px 10px;box-shadow:0 4px 12px rgba(220,38,38,.35);text-align:left;}" +
      ".gm-point:hover{background:#b91c1c;}" +
      ".gm-fsummary{font-size:12px;font-weight:700;color:#0f172a;margin-bottom:2px;}" +
      ".gm-fhint{font-size:11px;color:#64748b;margin-bottom:7px;}" +
      ".gm-fields{display:flex;flex-direction:column;gap:6px;}" +
      ".gm-field{display:block;width:100%;text-align:left;cursor:pointer;border:1px solid #e2e8f0;" +
      "background:#f8fafc;border-radius:9px;padding:8px 10px;font-family:inherit;}" +
      ".gm-field:hover{background:#eef2ff;border-color:#c7d2fe;}" +
      ".gm-field-sens{background:#fff7ed;border-color:#fed7aa;}" +
      ".gm-field-sens:hover{background:#ffedd5;border-color:#fdba74;}" +
      ".gm-field-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}" +
      ".gm-field-icon{font-size:12px;flex:none;}" +
      ".gm-field-name{font-size:12px;font-weight:700;color:#1e293b;}" +
      ".gm-field-guide{font-size:11px;line-height:1.35;color:#475569;margin-top:4px;}" +
      ".gm-field-sens .gm-field-guide{color:#9a3412;}" +
      ".gm-tag{font-size:9px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;" +
      "border-radius:5px;padding:1px 5px;}" +
      ".gm-tag-req{background:#e0e7ff;color:#3730a3;}" +
      ".gm-tag-sens{background:#fecaca;color:#991b1b;}" +
      ".gm-hi-all{margin-top:8px;width:100%;cursor:pointer;border:none;border-radius:8px;" +
      "background:#9a3412;color:#fff;font-family:inherit;font-size:12px;font-weight:700;padding:8px 10px;}" +
      ".gm-hi-all:hover{background:#7c2d12;}" +
      ".gm-disc{padding:10px 14px 12px;margin-top:6px;font-size:11px;color:#64748b;border-top:1px solid #f1f5f9;}" +
      ".gm-pill{position:fixed;right:16px;bottom:16px;z-index:2147483647;border:none;cursor:pointer;" +
      "background:#0f172a;color:#fff;font-weight:700;font-size:13px;padding:10px 14px;border-radius:999px;" +
      "box-shadow:0 8px 22px rgba(15,23,42,.28);}" +
      ".gm-pill:hover{background:#1e293b;}";
    return s;
  }

  /* ------------------------------- lifecycle -------------------------------- */

  // Popup can ask "where am I?" for its compact summary.
  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (msg && msg.type === "GOVMATCH_WHERE") {
      var site = siteKey();
      if (!site) {
        sendResponse({ ok: false });
        return;
      }
      var info = guidanceFor(site);
      var fields = scanFields().map(function (f) {
        return { human: f.human, sensitive: f.sensitive, required: f.required, conceptId: f.conceptId };
      });
      sendResponse({
        ok: true,
        site: info.conf.label,
        stageId: info.stageId,
        guidance: info.g,
        fields: fields,
      });
    }
  });

  var debounceTimer = null;
  function scheduleRender() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(render, 500);
  }

  function start() {
    chrome.storage.local.get([LANG_KEY, JOURNEY_KEY], function (res) {
      var stored = res && res[LANG_KEY];
      if (stored === "es" || stored === "en") {
        lang = stored; // explicit user choice wins
      } else {
        // No stored preference → follow the browser's language.
        var nav = (typeof navigator !== "undefined" && navigator.language) || "en";
        lang = /^es/i.test(nav) ? "es" : "en";
      }
      var ids = res && Array.isArray(res[JOURNEY_KEY]) ? res[JOURNEY_KEY] : [];
      journeyDone = {};
      ids.forEach(function (id) {
        journeyDone[id] = true;
      });
      render();
    });

    // React to the EN/ES toggle and to journey progress changed in another tab.
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "local") return;
      if (changes[LANG_KEY]) {
        lang = changes[LANG_KEY].newValue === "es" ? "es" : "en";
        lastSignature = "";
        render();
      }
      if (changes[JOURNEY_KEY]) {
        var ids = Array.isArray(changes[JOURNEY_KEY].newValue) ? changes[JOURNEY_KEY].newValue : [];
        journeyDone = {};
        ids.forEach(function (id) {
          journeyDone[id] = true;
        });
        lastSignature = "";
        render();
      }
    });

    // SPA navigation (SAM.gov & Grants.gov Workspace are single-page apps).
    ["pushState", "replaceState"].forEach(function (fn) {
      var orig = history[fn];
      history[fn] = function () {
        var r = orig.apply(this, arguments);
        scheduleRender();
        return r;
      };
    });
    window.addEventListener("popstate", scheduleRender);

    // Content changes within the same URL (wizard steps that swap the DOM).
    try {
      var obs = new MutationObserver(scheduleRender);
      obs.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {
      /* ignore */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
