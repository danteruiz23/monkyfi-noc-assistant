# SPEC — Monkyfi NOC Assistant

> Documento base del proyecto. Lo lee `/prime` al inicio de cada sesión y lo usa `/hand-off` para comparar avances. Va en el repo como `docs/SPEC.md`.
> Versión 0.1 — 22-nov-2026 — Estado: borrador para aprobación de Dante.

## 0. Fuentes
- **No hay un PRD (Product Requirements Document) formal.** Este SPEC se arma con: la ficha del agente en monkyfi.com, el README y el código del repo `danteruiz23/monkyfi-noc-assistant` (último commit 4-nov-2026), y el plan de agentes Monkyfi (demo compartible para la **segunda semana de diciembre de 2026**).
- Sigue el mismo camino que Interconnect IQ, cuya demo web ya está en producción.
- Lo marcado como **[Propuesta]** es sugerencia de Claude y requiere confirmación de Dante.

---

## 1. PRD (Product Requirements Document, documento de requerimientos de producto)

### 1.1 Problema
- Un NOC (Network Operations Center, centro de operaciones de red) recibe cientos de alarmas por turno; muchas son ruido o repeticiones del mismo problema.
- Un solo evento (por ejemplo, un flap de BGP (Border Gateway Protocol)) dispara una cadena de alarmas en varios equipos y varios tickets duplicados.
- El operador pierde tiempo correlacionando a mano, buscando el runbook correcto y redactando el cierre del ticket.

### 1.2 Usuarios
- Operadores y supervisores de NOC de carriers, ISP (Internet Service Provider, proveedor de internet), operadores de cable submarino y data centers.

### 1.3 Capacidades (ficha de monkyfi.com)
1. **Recibe alarmas en vivo** (webhook o syslog).
2. **Correlaciona incidentes:** agrupa las alarmas de una misma causa y fusiona tickets duplicados.
3. **Sugiere la remediación** según los runbooks, con la causa probable y el tiempo de resolución esperado.
4. **Redacta el resumen de cierre** del ticket.
5. **Interfaz de voz opcional:** preguntas habladas y respuestas leídas en voz alta.
6. **Control humano:** recomienda; el equipo del NOC decide y ejecuta.

### 1.4 Requerimientos no funcionales
- **Veracidad:** toda respuesta sale de los eventos y runbooks cargados. Si falta un dato, lo dice. Nunca inventa equipos, clientes, tickets ni cifras.
- **Siempre funciona:** la demo no depende de ninguna clave de IA ni de voz.
- **Seguridad:** el texto de las alarmas y las preguntas se trata como dato, nunca como instrucción. Sin secretos ni datos reales en el repo (privado desde el 21-nov-2026).
- **Guardrails (estándar Monkyfi):** texto fijo para temas ajenos o manipulación, aviso y registro al tercer intento, límites de solicitudes y de tamaño.
- **Idioma:** EN/ES.

---

## 2. Estado actual (repo, 4-nov-2026)
| Pieza | Estado |
|---|---|
| Backend | Python, solo librería estándar, servidor HTTP propio (`backend/app.py`), corre en `localhost:8000`. **No funciona en Vercel tal como está.** |
| Correlación | Determinista (`correlator.py`). Agrupa por ventana de 30 min y cadena causal BGP → saturación → pérdida de paquetes. **Atado a los equipos de la demo** (`MIA-EDGE-02`, `MIA-AGG-01`, `MIA-CORE-01`). |
| Remediación | Determinista (`remediation.py`): elige entre 10 runbooks (`data/runbooks.json`) por palabras clave, con MTTR (Mean Time To Repair, tiempo medio de reparación) antes y después. |
| Resumen de cierre | Determinista (`summarizer.py`). |
| Preguntas | Deterministas (`voice_answer`): saturación, causa, impacto, tickets fusionados, duración, clientes afectados. Filtro por expresiones regulares para temas maliciosos y fuera de alcance. |
| Voz | ElevenLabs en el servidor (texto a voz y voz a texto); dictado en el navegador. |
| IA (LLM, Large Language Model) | **No conectada.** Los prompts de Claude existen solo como plantillas (`prompts.py`). |
| Importar alarmas | Pegar o subir `.txt` en formato syslog del simulador, con límites de tamaño y filtrado de líneas sospechosas. |
| Datos | Sintéticos: 50 eventos (`data/alerts.json`), syslog equivalente, 10 runbooks. Clientes ficticios (ACME Corp, Globex). Incidente principal: 44 eventos, 19.5 min, tickets INC-1042 a INC-1044. |
| Frontend | Una página HTML (`frontend/index.html`). |
| Tests | **No hay tests automáticos.** |

---

## 3. MVP (Minimum Viable Product, producto mínimo viable): demo web para clientes
**Objetivo:** un link público que muestre en 5 minutos cómo 44 alarmas se convierten en un incidente con causa, remediación y cierre. **Fecha objetivo: segunda semana de diciembre de 2026.**

### Dentro del MVP
- App Next.js (TypeScript) en la carpeta `web/` del mismo repo, desplegada en Vercel como proyecto `monkyfi-noc-assistant` (carpeta raíz `web`). El backend Python se mantiene como referencia.
- Lógica determinista portada a TypeScript (`web/lib/`): parser de syslog, correlación, remediación, resumen de cierre y respuestas a preguntas. **Tests de paridad** contra salidas generadas por la versión Python (como Python no tiene tests, primero se generan esas salidas de referencia).
- Pantallas, en EN/ES y con el estilo de monkyfi.com (acento #F5A9B8):
  1. **Panel de incidentes:** lista de incidentes con severidad, equipos, duración y tickets.
  2. **Reproducción en vivo:** botón que reproduce los 50 eventos del simulador en el navegador, acelerado, para ver cómo se forma el incidente.
  3. **Detalle del incidente:** línea de tiempo, cadena causal, clientes afectados y tickets fusionados.
  4. **Remediación:** runbook sugerido, causa probable, MTTR antes y después, marcado "Recomendación: requiere decisión del NOC".
  5. **Resumen de cierre:** borrador editable, copiar y exportar.
  6. **Importar alarmas:** pegar o subir `.txt` (con los mismos límites y filtros de hoy).
  7. **Preguntas:** caja de texto y dictado por voz.
  8. **Recorrido guiado** ("Iniciar demo"): reproducir → incidente → remediación → cierre → pregunta, en 5 pasos.
- **Voz [Propuesta]:** dictado y lectura en voz alta con las funciones del propio navegador, sin costo. ElevenLabs queda opcional por variable de entorno, apagado en el link público.
- **IA [Propuesta]:** respuestas deterministas en el link público, sin clave de IA (igual que Interconnect IQ).
- Guardrails del estándar Monkyfi en la ruta de preguntas (ver §1.4).
- Pie de página: "Demo con datos sintéticos. No conectada a redes reales."
- Guion de demo de 5 minutos (EN y ES) y script de verificación automática (`web/scripts/demo-check.js`, como en Interconnect IQ).

### Fuera del MVP (piloto con cliente)
- Recepción real de alarmas desde el NMS (Network Management System, sistema de gestión de red) del cliente.
- Correlación general, no atada a los equipos de la demo.
- Biblioteca de runbooks por cliente.
- IA para correlación y resúmenes, con citas a los eventos.
- Integración con tickets (ServiceNow/Jira), acceso por usuario y multi-cliente.

---

## 4. Modelos
- **Para construir (Claude Code):** Opus 5.5 en las fases con más riesgo (lógica portada con paridad; preguntas, voz y guardrails); Sonnet 5.5 en las de ejecución (pantallas; despliegue y demo).
- **Para operar:** sin IA en el link público. Proveedor para el piloto: por decidir (§6).

---

## 5. Fases (una sesión de Claude Code cada una)
**Ciclo:** `/prime phase N` → construir → tests → `/hand-off`.

### Bloque A — Demo web (MVP), antes de la segunda semana de diciembre
**Fase 1 — Scaffold y lógica portada · Opus 5.5 · [Propuesta: ~26-nov]**
- Entregables: `web/` con Next.js; datos copiados a `web/data/`; salidas de referencia generadas con Python (`web/test/fixtures/`); parser, correlación, remediación, resumen y respuestas portados a TypeScript; tests de paridad (Vitest).
- Aceptación: `npm run build` pasa; el incidente principal da 44 eventos, 19.5 min y tickets INC-1042 a INC-1044; todas las salidas coinciden con Python; el backend Python sigue funcionando.

**Fase 2 — Pantallas · Sonnet 5.5 · [Propuesta: ~29-nov]**
- Entregables: pantallas 1 a 6 en EN/ES, estilo Monkyfi, reproducción en vivo en el navegador.
- Aceptación: todas cargan en escritorio (1280 px) y móvil (375 px); ningún texto sin traducir.

**Fase 3 — Preguntas, voz y guardrails · Opus 5.5 · [Propuesta: ~3-dic]**
- Entregables: ruta de preguntas en el servidor; dictado y lectura en voz con el navegador; ElevenLabs opcional por variable; guardrails del estándar Monkyfi (textos fijos, aviso y registro al tercer intento, límite de solicitudes, tamaño máximo, contenido pegado como dato); batería de pruebas de guardrails.
- Aceptación: las 6 preguntas de la demo responden bien en EN/ES; una pregunta ajena recibe el texto fijo; sin claves, todo funciona.

**Fase 4 — Demo guiada, despliegue y endurecimiento · Sonnet 5.5 · [Propuesta: ~6-dic]**
- Entregables: recorrido guiado; despliegue en Vercel; `DEMO.md` EN/ES; `demo-check.js`; revisión de seguridad (encabezados, límites, origen de las llamadas, IP (Internet Protocol) leída de los encabezados de Vercel); README.
- Aceptación: `demo-check.js` sin fallos en producción, EN/ES, 1280 y 375 px; actualizar la etapa en el Command Center (de development a testing, con el link).

### Bloque B — Piloto con cliente (después de la demo)
- **Fase 5 — Recepción real de alarmas** (Opus): webhook y syslog desde el NMS del cliente, con autenticación.
- **Fase 6 — Correlación general y runbooks por cliente** (Opus).
- **Fase 7 — IA con citas** (Opus): correlación y resúmenes con el proveedor elegido.
- **Fase 8 — Tickets, acceso y multi-cliente** (Sonnet).

---

## 6. Preguntas abiertas
1. **Link público o con contraseña.** [Propuesta: público, como Interconnect IQ.]
2. **Voz en el link público.** [Propuesta: voz del navegador; ElevenLabs apagado para no gastar créditos.]
3. **Proveedor de IA para el piloto:** el repo tiene plantillas para Claude; Interconnect IQ usa Meta Llama. ¿Cuál usar?
4. **Oferta comercial:** precio del piloto, suscripción y límites (no están definidos para el NOC Assistant).
5. **Primer NMS a integrar** en un piloto (Bloque B).
