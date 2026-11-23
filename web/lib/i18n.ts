/**
 * Every visible text in the web demo, in English and Spanish.
 * Phase 2 adds the screen texts here; no visible string lives outside this file.
 */
export type Lang = "en" | "es";
export const LANGS: Lang[] = ["en", "es"];

export const STRINGS = {
  en: {
    title: "Monkyfi NOC Assistant",
    tagline: "Turns a flood of network alarms into one incident, with cause, remediation and closure.",
    status: "Phase 1: deterministic logic ported from Python. The demo screens arrive in phase 2.",
    mainIncident: "Main incident (synthetic demo data)",
    events: "Correlated alarms",
    duration: "Duration",
    minutes: "min",
    tickets: "Duplicate tickets merged",
    incidents: "Incidents found",
    probableCause: "Probable cause",
    runbook: "Suggested runbook",
    recommendation: "Recommendation: requires a NOC decision",
    footer: "Demo with synthetic data. Not connected to real networks.",
    language: "Language",
  },
  es: {
    title: "Monkyfi NOC Assistant",
    tagline: "Convierte una avalancha de alarmas de red en un solo incidente, con causa, remediación y cierre.",
    status: "Fase 1: lógica determinista portada desde Python. Las pantallas de la demo llegan en la fase 2.",
    mainIncident: "Incidente principal (datos sintéticos de demo)",
    events: "Alarmas correlacionadas",
    duration: "Duración",
    minutes: "min",
    tickets: "Tickets duplicados fusionados",
    incidents: "Incidentes encontrados",
    probableCause: "Causa probable",
    runbook: "Runbook sugerido",
    recommendation: "Recomendación: requiere decisión del NOC",
    footer: "Demo con datos sintéticos. No conectada a redes reales.",
    language: "Idioma",
  },
} as const satisfies Record<Lang, Record<string, string>>;

export type StringKey = keyof (typeof STRINGS)["en"];

/**
 * Spanish wording for the fixed texts the ported logic returns in English.
 * The logic itself stays English so it matches the Python backend exactly.
 */
const LOGIC_ES: Record<string, string> = {
  "BGP neighbor flap on MIA-EDGE-02 (neighbor 198.51.100.2)":
    "Flap del vecino BGP en MIA-EDGE-02 (vecino 198.51.100.2)",
  "Degrading optic on DFW-CORE-01 Hu0/0/0/2": "Óptica degradándose en DFW-CORE-01 Hu0/0/0/2",
  "Unknown — see timeline": "Desconocida — ver la línea de tiempo",
};

/** Show a fixed logic text in the chosen language (unknown text is shown as is). */
export function logicText(text: string, lang: Lang): string {
  return lang === "es" ? (LOGIC_ES[text] ?? text) : text;
}
