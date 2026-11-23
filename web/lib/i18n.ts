/**
 * Every visible text in the web demo, in English and Spanish.
 * No visible string lives outside this file (test/i18n.test.ts checks it).
 * Placeholders such as {n} are filled with fmt().
 */
export type Lang = "en" | "es";
export const LANGS: Lang[] = ["en", "es"];

export const STRINGS = {
  en: {
    title: "Monkyfi NOC Assistant",
    brand: "Monkyfi",
    product: "NOC Assistant",
    tagline: "Turns a flood of network alarms into one incident, with cause, remediation and closure.",
    language: "Language",
    footer: "Demo with synthetic data. Not connected to real networks.",
    recommendation: "Recommendation: requires a NOC decision",
    humanControl: "The assistant recommends; the NOC team decides and executes.",
    minutes: "min",
    utc: "UTC",
    none: "None",
    noneReported: "None reported",
    noIncident: "No incident to show yet. Start the live replay or import alarms.",
    goReplay: "Go to live replay",
    replayBanner: "Live replay in progress: {n} of {total} alarms received.",

    // Navigation
    navLabel: "Screens",
    navIncidents: "Incidents",
    navReplay: "Live replay",
    navDetail: "Incident detail",
    navRemediation: "Remediation",
    navSummary: "Closure summary",
    navImport: "Import alarms",

    // Severities and alarm types
    sevCritical: "Critical",
    sevMajor: "Major",
    sevMinor: "Minor",
    typeBgpFlap: "BGP flap",
    typeLinkSaturation: "Link saturation",
    typePacketLoss: "Packet loss",
    typeOptical: "Optical degradation",
    typeTicketCreated: "Ticket opened",
    typeTicketUpdated: "Ticket updated",
    typeTicket: "Ticket",

    // 1. Incident panel
    panelTitle: "Incident panel",
    panelIntro: "Every alarm in the current data set, correlated into incidents.",
    statAlarms: "Alarms received",
    statIncidents: "Incidents",
    statTickets: "Tickets received",
    statNoise: "Alarms per incident",
    colSeverity: "Severity",
    colDevices: "Devices",
    colDuration: "Duration",
    colAlarms: "Alarms",
    colTickets: "Tickets",
    colStart: "Start (UTC)",
    openDetail: "Open detail",
    emptyPanel: "No alarms yet. Start the live replay or import alarms.",

    // 2. Live replay
    replayTitle: "Live replay",
    replayIntro:
      "Plays the 50 simulator alarms in your browser, sped up, so you can watch the incident form. Imported alarms are cleared when the replay starts.",
    play: "Play",
    pause: "Pause",
    resume: "Resume",
    restart: "Restart",
    speed: "Speed",
    speedOption: "{n}× faster",
    progress: "{n} of {total} alarms",
    simClock: "Network time (UTC)",
    replayIdle: "Press Play to start the replay.",
    replayPaused: "Replay paused.",
    replayDone: "Replay finished: {alarms} alarms became {incidents} incidents.",
    liveFeed: "Live alarm feed",
    liveIncidents: "Incidents forming",
    feedEmpty: "No alarms received yet.",

    // 3. Incident detail
    detailTitle: "Incident detail",
    selectIncident: "Incident",
    probableCause: "Probable cause",
    window: "Window (UTC)",
    devices: "Devices",
    duration: "Duration",
    events: "Correlated alarms",
    peakLoss: "Peak packet loss",
    peakUtil: "Peak uplink utilization",
    causalChain: "Causal chain",
    chainNote: "Built from the first alarm of each type, in time order.",
    chainImpact: "Customer impact",
    customers: "Affected customers",
    tickets: "Duplicate tickets merged",
    ticketOpened: "Opened",
    ticketUpdated: "Updated",
    timeline: "Timeline",
    timelineCount: "{n} alarms",

    // 4. Remediation
    remTitle: "Remediation",
    remIntro: "Runbook suggestion from the loaded runbooks, matched by keywords in the alarms.",
    runbook: "Suggested runbook",
    alternative: "Alternative runbook",
    symptom: "Symptom",
    rootCause: "Root cause (runbook)",
    action: "Recommended action",
    matched: "Matched keywords",
    score: "{n} of {total} keywords",
    mttr: "MTTR (mean time to repair)",
    mttrBefore: "Before",
    mttrAfter: "With the assistant playbook",
    mttrSaving: "{n}% faster",

    // 5. Closure summary
    sumTitle: "Closure summary",
    sumIntro:
      "Draft built only from the correlated timeline, peak metrics and the runbook suggestion. Edit it before you close the ticket.",
    draftLabel: "Closure summary draft",
    copy: "Copy",
    copied: "Copied to the clipboard.",
    copyFailed: "Could not copy. Select the text and copy it by hand.",
    download: "Export .txt",
    exported: "File exported.",
    restore: "Restore draft",
    edited: "Edited",

    // 6. Import alarms
    impTitle: "Import alarms",
    impIntro:
      "Paste simulator-style syslog alarms or select a .txt file. Alarm text is treated as data, never as instructions.",
    impLimits:
      "Limits: 1 MB, 5000 lines and 4096 characters per line. Lines with HTML, scripts, destructive commands or impossible dates are ignored.",
    impTextLabel: "Syslog alarm lines",
    impPlaceholder: "<134>1 2026-11-02T09:00:00Z MIA-EDGE-02 BGP-5-ADJCHANGE: Te0/0/0/1 bgp_neighbor_state=down …",
    impFile: "Select .txt file",
    impSample: "Load sample alarms",
    impAnalyze: "Analyze alarms",
    impReset: "Reset to demo data",
    impDone: "Imported {n} alarm(s). Ignored lines: {m}.",
    impResult: "The data set now has {alarms} alarms in {incidents} incidents.",
    impBadFile: "Select a .txt file.",
    impReadError: "Could not read the file.",
    impBadDate: "A line has an impossible date or time. Nothing was imported.",
    impFileLoaded: "File loaded: {name}. Press Analyze alarms.",
    impResetDone: "Demo data restored: {n} simulator alarms.",
    impSeeIncidents: "See incidents",

    // 7. Questions (screen) and voice
    navAsk: "Questions",
    askTitle: "Questions",
    askIntro:
      "Ask about the current incident by typing or by voice. Answers come only from the loaded alarms and runbooks; the question is treated as data, never as instructions.",
    askDemoLabel: "Demo questions",
    askQ1: "Which links are saturated?",
    askQ2: "What is the probable cause?",
    askQ3: "What is the impact of the incident?",
    askQ4: "Which tickets were merged?",
    askQ5: "How long did the incident last?",
    askQ6: "Which customers are affected?",
    askInputLabel: "Your question",
    askPlaceholder: "Type a question about the current incident…",
    askCounter: "{n} of {max} characters",
    askSend: "Ask",
    askSending: "Thinking…",
    askClear: "Clear conversation",
    askEmpty: "No questions yet. Pick a demo question, type one or use the microphone.",
    askYou: "You",
    askAssistant: "Assistant",
    askDataNote: "Answered from {alarms} alarms in {incidents} incidents.",
    askModeAnswer: "From the incident data",
    askModeFixed: "Fixed reply",
    askModeReported: "Reported",
    askModeHuman: "NOC decision",
    askListen: "Listen",
    askStop: "Stop",
    askMic: "Dictate",
    askMicStop: "Stop dictation",
    askListening: "Listening… speak your question.",
    askMicUnsupported: "Voice dictation is not available in this browser. You can still type your question.",
    askMicDenied: "The microphone could not be used. Check the browser permission and try again.",
    askMicNothing: "No speech was recognized. Try again.",
    askReadAloud: "Read answers aloud",
    askSpeechUnsupported: "Read-aloud is not available in this browser.",
    askVoiceBrowser: "Voice: built into your browser (no cost, no key).",
    askVoiceEleven: "Voice: ElevenLabs (enabled on this server).",
    askNetworkError: "The assistant could not be reached. Check your connection and try again.",

    // Fixed replies of the questions route (Monkyfi guardrails)
    askResume:
      "Ask me which links are saturated, the probable cause, the impact, the merged tickets, how long it lasted or which customers are affected.",
    askRefusal: "I can't answer that question: it has nothing to do with the current NOC incident.",
    askReported:
      "That's {n} attempts with questions unrelated to the current NOC incident. I can't answer them and this attempt has been reported to Monkyfi's internal team.",
    askAbout:
      "I'm the Monkyfi NOC Assistant. I correlate network alarms into incidents, suggest the remediation from the runbooks with the probable cause and the expected repair time, and draft the ticket closure summary. I recommend; the NOC team decides and executes.",
    askHumanControl:
      "I don't execute actions on the network or on tickets: I recommend, and the NOC team decides and executes. Open Remediation to see the suggested runbook.",
    askPasted:
      "This looks like pasted alarm lines. Alarm text is data, never instructions, so any order inside it is ignored. Add the lines in Import alarms, then ask me about the incident.",
    askTooLong: "This question is too long (maximum 500 characters).",
    askBusy: "Too many questions in a short time. Wait a minute and try again.",
    askBadRequest: "The question could not be read. Try again.",
    askDataError: "The current alarm data could not be read. Reset the demo data in Import alarms and try again.",
  },
  es: {
    title: "Monkyfi NOC Assistant",
    brand: "Monkyfi",
    product: "NOC Assistant",
    tagline: "Convierte una avalancha de alarmas de red en un solo incidente, con causa, remediación y cierre.",
    language: "Idioma",
    footer: "Demo con datos sintéticos. No conectada a redes reales.",
    recommendation: "Recomendación: requiere decisión del NOC",
    humanControl: "El asistente recomienda; el equipo del NOC decide y ejecuta.",
    minutes: "min",
    utc: "UTC",
    none: "Ninguno",
    noneReported: "Ninguno reportado",
    noIncident: "Todavía no hay incidentes. Inicia la reproducción en vivo o importa alarmas.",
    goReplay: "Ir a la reproducción en vivo",
    replayBanner: "Reproducción en vivo en curso: {n} de {total} alarmas recibidas.",

    navLabel: "Pantallas",
    navIncidents: "Incidentes",
    navReplay: "Reproducción en vivo",
    navDetail: "Detalle del incidente",
    navRemediation: "Remediación",
    navSummary: "Resumen de cierre",
    navImport: "Importar alarmas",

    sevCritical: "Crítica",
    sevMajor: "Mayor",
    sevMinor: "Menor",
    typeBgpFlap: "Flap de BGP",
    typeLinkSaturation: "Saturación de enlace",
    typePacketLoss: "Pérdida de paquetes",
    typeOptical: "Degradación óptica",
    typeTicketCreated: "Ticket abierto",
    typeTicketUpdated: "Ticket actualizado",
    typeTicket: "Ticket",

    panelTitle: "Panel de incidentes",
    panelIntro: "Todas las alarmas del conjunto actual, correlacionadas en incidentes.",
    statAlarms: "Alarmas recibidas",
    statIncidents: "Incidentes",
    statTickets: "Tickets recibidos",
    statNoise: "Alarmas por incidente",
    colSeverity: "Severidad",
    colDevices: "Equipos",
    colDuration: "Duración",
    colAlarms: "Alarmas",
    colTickets: "Tickets",
    colStart: "Inicio (UTC)",
    openDetail: "Ver detalle",
    emptyPanel: "Aún no hay alarmas. Inicia la reproducción en vivo o importa alarmas.",

    replayTitle: "Reproducción en vivo",
    replayIntro:
      "Reproduce en tu navegador las 50 alarmas del simulador, aceleradas, para ver cómo se forma el incidente. Las alarmas importadas se borran al iniciar la reproducción.",
    play: "Reproducir",
    pause: "Pausar",
    resume: "Continuar",
    restart: "Reiniciar",
    speed: "Velocidad",
    speedOption: "{n}× más rápido",
    progress: "{n} de {total} alarmas",
    simClock: "Hora de la red (UTC)",
    replayIdle: "Pulsa Reproducir para iniciar la reproducción.",
    replayPaused: "Reproducción en pausa.",
    replayDone: "Reproducción terminada: {alarms} alarmas se convirtieron en {incidents} incidentes.",
    liveFeed: "Alarmas en vivo",
    liveIncidents: "Incidentes en formación",
    feedEmpty: "Todavía no llegan alarmas.",

    detailTitle: "Detalle del incidente",
    selectIncident: "Incidente",
    probableCause: "Causa probable",
    window: "Ventana (UTC)",
    devices: "Equipos",
    duration: "Duración",
    events: "Alarmas correlacionadas",
    peakLoss: "Pérdida de paquetes máxima",
    peakUtil: "Utilización máxima del uplink",
    causalChain: "Cadena causal",
    chainNote: "Armada con la primera alarma de cada tipo, en orden de tiempo.",
    chainImpact: "Impacto en clientes",
    customers: "Clientes afectados",
    tickets: "Tickets duplicados fusionados",
    ticketOpened: "Abierto",
    ticketUpdated: "Actualizado",
    timeline: "Línea de tiempo",
    timelineCount: "{n} alarmas",

    remTitle: "Remediación",
    remIntro: "Runbook sugerido entre los runbooks cargados, elegido por palabras clave de las alarmas.",
    runbook: "Runbook sugerido",
    alternative: "Runbook alternativo",
    symptom: "Síntoma",
    rootCause: "Causa raíz (runbook)",
    action: "Acción recomendada",
    matched: "Palabras clave encontradas",
    score: "{n} de {total} palabras clave",
    mttr: "MTTR (tiempo medio de reparación)",
    mttrBefore: "Antes",
    mttrAfter: "Con el playbook del asistente",
    mttrSaving: "{n}% más rápido",

    sumTitle: "Resumen de cierre",
    sumIntro:
      "Borrador armado solo con la línea de tiempo correlacionada, las métricas máximas y el runbook sugerido. Edítalo antes de cerrar el ticket.",
    draftLabel: "Borrador del resumen de cierre",
    copy: "Copiar",
    copied: "Copiado al portapapeles.",
    copyFailed: "No se pudo copiar. Selecciona el texto y cópialo a mano.",
    download: "Exportar .txt",
    exported: "Archivo exportado.",
    restore: "Restaurar borrador",
    edited: "Editado",

    impTitle: "Importar alarmas",
    impIntro:
      "Pega alarmas syslog del simulador o selecciona un archivo .txt. El texto de las alarmas se trata como dato, nunca como instrucción.",
    impLimits:
      "Límites: 1 MB, 5000 líneas y 4096 caracteres por línea. Se ignoran las líneas con HTML, scripts, comandos destructivos o fechas imposibles.",
    impTextLabel: "Líneas de alarmas syslog",
    impPlaceholder: "<134>1 2026-11-02T09:00:00Z MIA-EDGE-02 BGP-5-ADJCHANGE: Te0/0/0/1 bgp_neighbor_state=down …",
    impFile: "Seleccionar archivo .txt",
    impSample: "Cargar alarmas de ejemplo",
    impAnalyze: "Analizar alarmas",
    impReset: "Volver a los datos de demo",
    impDone: "Se importaron {n} alarma(s). Líneas ignoradas: {m}.",
    impResult: "El conjunto de datos tiene ahora {alarms} alarmas en {incidents} incidentes.",
    impBadFile: "Selecciona un archivo .txt.",
    impReadError: "No se pudo leer el archivo.",
    impBadDate: "Una línea tiene una fecha u hora imposible. No se importó nada.",
    impFileLoaded: "Archivo cargado: {name}. Pulsa Analizar alarmas.",
    impResetDone: "Datos de demo restaurados: {n} alarmas del simulador.",
    impSeeIncidents: "Ver incidentes",

    navAsk: "Preguntas",
    askTitle: "Preguntas",
    askIntro:
      "Pregunta sobre el incidente actual escribiendo o con la voz. Las respuestas salen solo de las alarmas y los runbooks cargados; la pregunta se trata como dato, nunca como instrucción.",
    askDemoLabel: "Preguntas de la demo",
    askQ1: "¿Qué enlaces están saturados?",
    askQ2: "¿Cuál es la causa probable?",
    askQ3: "¿Cuál es el impacto del incidente?",
    askQ4: "¿Qué tickets se fusionaron?",
    askQ5: "¿Cuánto duró el incidente?",
    askQ6: "¿Qué clientes están afectados?",
    askInputLabel: "Tu pregunta",
    askPlaceholder: "Escribe una pregunta sobre el incidente actual…",
    askCounter: "{n} de {max} caracteres",
    askSend: "Preguntar",
    askSending: "Pensando…",
    askClear: "Borrar conversación",
    askEmpty: "Todavía no hay preguntas. Elige una pregunta de la demo, escribe una o usa el micrófono.",
    askYou: "Tú",
    askAssistant: "Asistente",
    askDataNote: "Respondido con {alarms} alarmas en {incidents} incidentes.",
    askModeAnswer: "Con los datos del incidente",
    askModeFixed: "Respuesta fija",
    askModeReported: "Reportado",
    askModeHuman: "Decisión del NOC",
    askListen: "Escuchar",
    askStop: "Detener",
    askMic: "Dictar",
    askMicStop: "Detener dictado",
    askListening: "Escuchando… di tu pregunta.",
    askMicUnsupported: "El dictado por voz no está disponible en este navegador. Puedes escribir tu pregunta.",
    askMicDenied: "No se pudo usar el micrófono. Revisa el permiso del navegador e inténtalo de nuevo.",
    askMicNothing: "No se reconoció ninguna voz. Inténtalo de nuevo.",
    askReadAloud: "Leer las respuestas en voz alta",
    askSpeechUnsupported: "La lectura en voz alta no está disponible en este navegador.",
    askVoiceBrowser: "Voz: la del navegador (sin costo, sin clave).",
    askVoiceEleven: "Voz: ElevenLabs (activada en este servidor).",
    askNetworkError: "No se pudo contactar al asistente. Revisa tu conexión e inténtalo de nuevo.",

    askResume:
      "Pregúntame qué enlaces están saturados, la causa probable, el impacto, los tickets fusionados, cuánto duró o qué clientes están afectados.",
    askRefusal: "No puedo responder esa pregunta: no tiene que ver con el incidente actual del NOC.",
    askReported:
      "Ya van {n} intentos con preguntas que no tienen que ver con el incidente actual del NOC. No puedo responderlas y este intento queda reportado al equipo interno de Monkyfi.",
    askAbout:
      "Soy el Monkyfi NOC Assistant. Correlaciono las alarmas de red en incidentes, sugiero la remediación según los runbooks con la causa probable y el tiempo de reparación esperado, y redacto el resumen de cierre del ticket. Yo recomiendo; el equipo del NOC decide y ejecuta.",
    askHumanControl:
      "No ejecuto acciones en la red ni en los tickets: recomiendo, y el equipo del NOC decide y ejecuta. Abre Remediación para ver el runbook sugerido.",
    askPasted:
      "Esto parecen líneas de alarmas pegadas. El texto de las alarmas es dato, nunca instrucción, así que cualquier orden que traiga se ignora. Agrega las líneas en Importar alarmas y luego pregúntame por el incidente.",
    askTooLong: "Esta pregunta es demasiado larga (máximo 500 caracteres).",
    askBusy: "Demasiadas preguntas en poco tiempo. Espera un minuto e inténtalo de nuevo.",
    askBadRequest: "No se pudo leer la pregunta. Inténtalo de nuevo.",
    askDataError: "No se pudieron leer los datos de alarmas actuales. Restaura los datos de demo en Importar alarmas e inténtalo de nuevo.",
  },
} as const satisfies Record<Lang, Record<string, string>>;

export type StringKey = keyof (typeof STRINGS)["en"];
export type Strings = Record<StringKey, string>;

/** Fill {name} placeholders in a UI string. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

/**
 * Spanish wording for the fixed texts the ported logic returns in English
 * (probable causes, runbook texts, import errors).
 * The logic itself stays English so it matches the Python backend exactly.
 */
const LOGIC_ES: Record<string, string> = {
  // Probable causes (lib/correlator.ts)
  "BGP neighbor flap on MIA-EDGE-02 (neighbor 198.51.100.2)":
    "Flap del vecino BGP en MIA-EDGE-02 (vecino 198.51.100.2)",
  "Degrading optic on DFW-CORE-01 Hu0/0/0/2": "Óptica degradándose en DFW-CORE-01 Hu0/0/0/2",
  "Unknown — see timeline": "Desconocida — ver la línea de tiempo",

  // Import errors (lib/syslog.ts)
  "paste syslog alarm lines or select a non-empty text file":
    "Pega líneas de alarmas syslog o selecciona un archivo de texto que no esté vacío.",
  "Alarm text is too large (maximum 1 MB).": "El texto de alarmas es demasiado grande (máximo 1 MB).",
  "Alarm text has too many lines (maximum 5000).": "El texto de alarmas tiene demasiadas líneas (máximo 5000).",
  "A syslog line is too long (maximum 4096 characters).":
    "Una línea syslog es demasiado larga (máximo 4096 caracteres).",
  "no supported syslog alarms found; expected simulator-style syslog lines":
    "No se encontraron alarmas syslog compatibles; se esperan líneas syslog con el formato del simulador.",

  // Runbooks (data/runbooks.json): symptom, root cause and action
  "BGP neighbor flap after a config change on an edge router":
    "Flap del vecino BGP después de un cambio de configuración en un router de borde",
  "Faulty or untested BGP policy/config change caused session instability.":
    "Un cambio de política o configuración BGP defectuoso o sin probar causó inestabilidad en la sesión.",
  "Roll back the last BGP config change on the edge router, then clear the BGP session and verify prefix counts return to baseline.":
    "Revertir el último cambio de configuración BGP en el router de borde, luego reiniciar la sesión BGP y verificar que la cantidad de prefijos vuelva a la línea base.",
  "BGP neighbor flap with interface errors on the same link":
    "Flap del vecino BGP con errores de interfaz en el mismo enlace",
  "Degraded optic on the BGP peering link.": "Óptica degradada en el enlace de peering BGP.",
  "Clean and reseat the optic; if errors persist, replace the optic and re-test the link.":
    "Limpiar y reinsertar la óptica; si los errores siguen, reemplazar la óptica y volver a probar el enlace.",
  "Uplink saturation after a traffic shift or failover":
    "Saturación del uplink después de un cambio de tráfico o un failover",
  "Traffic failed over onto a single uplink after a neighbor/link loss.":
    "El tráfico pasó a un solo uplink después de perder un vecino o un enlace.",
  "Shift traffic to the alternate uplink via BGP local-preference, and apply QoS policing to bulk traffic classes.":
    "Mover el tráfico al uplink alterno con local-preference de BGP y aplicar policing de QoS a las clases de tráfico masivo.",
  "Packet loss on downstream links following uplink saturation":
    "Pérdida de paquetes en los enlaces aguas abajo tras la saturación del uplink",
  "Congestion on the saturated uplink drops packets under load.":
    "La congestión en el uplink saturado descarta paquetes bajo carga.",
  "Reroute affected prefixes over the alternate path and confirm loss returns below 1% before closing.":
    "Redirigir los prefijos afectados por la ruta alterna y confirmar que la pérdida baje de 1% antes de cerrar.",
  "Optical Rx power steadily degrading on a core link":
    "Potencia óptica Rx degradándose de forma constante en un enlace de core",
  "Dirty or failing optic / bent fiber on the core link.":
    "Óptica sucia o fallando, o fibra doblada, en el enlace de core.",
  "Clean connectors, reseat the optic, and replace it if Rx power stays below -24 dBm.":
    "Limpiar los conectores, reinsertar la óptica y reemplazarla si la potencia Rx sigue por debajo de -24 dBm.",
  "Multiple tickets opened for the same outage by different tools and engineers":
    "Varios tickets abiertos para la misma falla por distintas herramientas e ingenieros",
  "Alert fatigue: several monitoring tools and engineers opened tickets for one incident.":
    "Fatiga de alertas: varias herramientas de monitoreo e ingenieros abrieron tickets para un mismo incidente.",
  "Merge duplicate tickets into the primary incident ticket and keep a single timeline for customer updates.":
    "Fusionar los tickets duplicados en el ticket principal del incidente y mantener una sola línea de tiempo para informar a los clientes.",
  "BGP drops correlated with high CPU on the edge router":
    "Caídas de BGP correlacionadas con CPU alta en el router de borde",
  "Control-plane overload starving the BGP process.":
    "Sobrecarga del plano de control que deja sin recursos al proceso BGP.",
  "Apply control-plane policing and rate-limit non-essential management traffic, then monitor CPU for 15 minutes.":
    "Aplicar policing del plano de control y limitar el tráfico de gestión no esencial; luego vigilar la CPU durante 15 minutos.",
  "Interface errors and flapping after a speed/duplex change":
    "Errores y flapping de interfaz después de un cambio de velocidad o dúplex",
  "Speed/duplex mismatch after a manual interface change.":
    "Velocidad o dúplex desiguales después de un cambio manual en la interfaz.",
  "Set both ends to auto-negotiation (or matching fixed speed/duplex) and clear interface counters.":
    "Poner ambos extremos en autonegociación (o en la misma velocidad y dúplex fijos) y reiniciar los contadores de la interfaz.",
  "Sudden uplink saturation from a single source prefix":
    "Saturación repentina del uplink desde un solo prefijo de origen",
  "Volumetric traffic flood (likely DDoS) toward one destination.":
    "Avalancha de tráfico volumétrico (probable DDoS) hacia un solo destino.",
  "Apply remotely-triggered blackholing (RTBH) for the target prefix or divert traffic to scrubbing.":
    "Aplicar blackholing activado de forma remota (RTBH) para el prefijo atacado o desviar el tráfico a limpieza (scrubbing).",
  "Line-card reset after a power or cooling alarm":
    "Reinicio de una tarjeta de línea después de una alarma de energía o enfriamiento",
  "Power supply or cooling failure resetting a line card.":
    "Falla de la fuente de poder o del enfriamiento que reinicia una tarjeta de línea.",
  "Reseat the line card, verify power feeds and airflow, and replace the faulty PSU if alarms repeat.":
    "Reinsertar la tarjeta de línea, verificar la alimentación y el flujo de aire, y reemplazar la fuente (PSU) defectuosa si las alarmas se repiten.",
};

/** Show a fixed logic text in the chosen language (unknown text is shown as is). */
export function logicText(text: string, lang: Lang): string {
  return lang === "es" ? (LOGIC_ES[text] ?? text) : text;
}

/** True when a Spanish wording exists for this logic text. */
export function hasLogicText(text: string): boolean {
  return Object.prototype.hasOwnProperty.call(LOGIC_ES, text);
}
