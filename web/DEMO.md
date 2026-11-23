# Monkyfi NOC Assistant — 5-minute demo script / Guion de demo de 5 minutos

[English](#english) · [Español](#español)

All data in this demo is synthetic (fictional devices, tickets and customers such as
ACME Corp and Globex). The demo needs no AI key and no ElevenLabs key.

Todos los datos de esta demo son sintéticos (equipos, tickets y clientes ficticios como
ACME Corp y Globex). La demo no necesita clave de IA ni de ElevenLabs.

---

## English

### Before the call (5 minutes)

1. Run the automatic check against the live link (from `web/`):
   ```bash
   node scripts/demo-check.js --url https://<your-demo-link>
   ```
   Every line must say `PASS`. It takes about 2 minutes on the live link.
2. Open the link in **Chrome or Edge** (voice dictation works there; Safari also works, Firefox has no dictation).
3. Click **Dictate** on the Questions screen once and allow the microphone, so the permission prompt does not appear during the call.
4. Pick the language of the audience with **EN / ES** (top right). The tour follows the language.
5. Shortcut: `https://<your-demo-link>/#tour` opens the app with the guided demo already running.

### The script

| Time | Screen | What you do | What you say |
|---|---|---|---|
| 0:00 | Incidents | Nothing yet. | "A NOC gets hundreds of alarms per shift. Many are noise or repeats of the same problem. One BGP flap can fire alarms on several devices and open several tickets. Let me show you what the assistant does with that." |
| 0:30 | **Start demo** → Step 1, Live replay | Click **Start demo**. Let the replay run for about 15 seconds. | "These are 50 alarms from our simulator, replayed in real time order, sped up. Watch: a BGP flap on MIA-EDGE-02, then link saturation, then packet loss on other devices. And three tickets get opened for the same problem." |
| 1:15 | Step 2, Incident detail | Click **Next**. Point at the causal chain and the merged tickets. | "The assistant groups 44 alarms into one incident: probable cause, causal chain BGP flap → saturation → packet loss, affected customers, and the three duplicate tickets merged into one. 19.5 minutes from first to last alarm." |
| 2:15 | Step 3, Remediation | Click **Next**. Point at the MTTR bars and the decision note. | "It matches the incident against the runbooks and suggests the right one, with the expected time to repair, before and after. It is a recommendation. The NOC team decides and executes. The assistant never touches the network." |
| 3:00 | Step 4, Closure summary | Click **Next**. Edit one word in the draft, then click **Copy**. | "The closure summary is drafted for you, from the same facts. Your engineer edits it and pastes it into the ticket, instead of writing it from scratch." |
| 3:45 | Step 5, Questions | Click **Next**. The demo asks "What is the probable cause?" for you. Then click **Dictate** and say "Which customers are affected?". | "You can ask in plain language, typed or spoken. Every answer comes only from the alarms and runbooks loaded. If it doesn't know, it says so." |
| 4:15 | Questions | Type "What's the weather in Miami?" | "And it stays on topic. Off-topic questions or attempts to manipulate it get a fixed reply. The third attempt is reported to our team." |
| 4:30 | **Finish** | Click **Finish**. | "Today this runs on synthetic data. In a pilot, we connect it to your NMS by webhook or syslog, load your runbooks and your ticketing tool. What would you want it to answer first in your NOC?" |

### Likely questions

- **"Is this AI?"** The public demo is deterministic on purpose: the same alarms always give the same answer, with no AI key. In a pilot we add AI for correlation and summaries, always with citations to the alarms.
- **"Can it act on the network?"** No. It recommends; the NOC decides and executes. Commands like "reboot MIA-EDGE-02" get that answer.
- **"Can I try my own alarms?"** Yes, on **Import alarms**: paste syslog lines or upload a `.txt` (simulator format, 1 MB max). Use synthetic or anonymized lines only.

### If something goes wrong

- **No internet / link down:** run it locally: `cd web && npm ci && npm run build && npm start`, then open `http://localhost:3000/#tour`.
- **The microphone does not work:** type the question. Voice is optional.
- **"Too many questions":** wait one minute (limit of 20 questions per minute per visitor).
- **You want to start over:** reload the page, or click **Start demo** again.

---

## Español

### Antes de la llamada (5 minutos)

1. Corre la verificación automática contra el link en vivo (desde `web/`):
   ```bash
   node scripts/demo-check.js --url https://<tu-link-de-demo>
   ```
   Todas las líneas deben decir `PASS`. Tarda unos 2 minutos contra el link en vivo.
2. Abre el link en **Chrome o Edge** (ahí funciona el dictado por voz; Safari también, Firefox no tiene dictado).
3. Pulsa **Dictar** una vez en la pantalla Preguntas y permite el micrófono, para que el permiso no aparezca durante la llamada.
4. Elige el idioma de la audiencia con **EN / ES** (arriba a la derecha). El recorrido sigue el idioma.
5. Atajo: `https://<tu-link-de-demo>/#tour` abre la app con la demo guiada ya en marcha.

### El guion

| Tiempo | Pantalla | Qué haces | Qué dices |
|---|---|---|---|
| 0:00 | Incidentes | Nada todavía. | "Un NOC recibe cientos de alarmas por turno. Muchas son ruido o repeticiones del mismo problema. Un solo flap de BGP dispara alarmas en varios equipos y abre varios tickets. Les muestro qué hace el asistente con eso." |
| 0:30 | **Iniciar demo** → Paso 1, Reproducción en vivo | Pulsa **Iniciar demo**. Deja correr la reproducción unos 15 segundos. | "Son 50 alarmas de nuestro simulador, reproducidas en el orden real, aceleradas. Miren: un flap de BGP en MIA-EDGE-02, luego saturación del enlace, luego pérdida de paquetes en otros equipos. Y se abren tres tickets para el mismo problema." |
| 1:15 | Paso 2, Detalle del incidente | Pulsa **Siguiente**. Señala la cadena causal y los tickets fusionados. | "El asistente agrupa 44 alarmas en un solo incidente: causa probable, cadena causal flap de BGP → saturación → pérdida de paquetes, clientes afectados, y los tres tickets duplicados fusionados en uno. 19.5 minutos de la primera a la última alarma." |
| 2:15 | Paso 3, Remediación | Pulsa **Siguiente**. Señala las barras de MTTR y la nota de decisión. | "Compara el incidente con los runbooks y sugiere el correcto, con el tiempo de reparación esperado, antes y después. Es una recomendación. El equipo del NOC decide y ejecuta. El asistente nunca toca la red." |
| 3:00 | Paso 4, Resumen de cierre | Pulsa **Siguiente**. Edita una palabra del borrador y pulsa **Copiar**. | "El resumen de cierre queda redactado con los mismos datos. Tu ingeniero lo edita y lo pega en el ticket, en vez de escribirlo desde cero." |
| 3:45 | Paso 5, Preguntas | Pulsa **Siguiente**. La demo pregunta "¿Cuál es la causa probable?" por ti. Luego pulsa **Dictar** y di "¿Qué clientes están afectados?". | "Pueden preguntar en lenguaje natural, escribiendo o con la voz. Cada respuesta sale solo de las alarmas y los runbooks cargados. Si no sabe algo, lo dice." |
| 4:15 | Preguntas | Escribe "¿Qué tiempo hace en Miami?" | "Y no se sale del tema. Las preguntas ajenas o los intentos de manipularlo reciben una respuesta fija. Al tercer intento, se reporta a nuestro equipo." |
| 4:30 | **Terminar** | Pulsa **Terminar**. | "Hoy esto corre con datos sintéticos. En un piloto lo conectamos a su NMS por webhook o syslog, cargamos sus runbooks y su herramienta de tickets. ¿Qué le gustaría que respondiera primero en su NOC?" |

### Preguntas probables

- **"¿Esto es IA?"** La demo pública es determinista a propósito: las mismas alarmas siempre dan la misma respuesta, sin clave de IA. En un piloto agregamos IA para la correlación y los resúmenes, siempre con citas a las alarmas.
- **"¿Puede actuar sobre la red?"** No. Recomienda; el NOC decide y ejecuta. Órdenes como "reinicia MIA-EDGE-02" reciben esa respuesta.
- **"¿Puedo probar con mis alarmas?"** Sí, en **Importar alarmas**: pega líneas de syslog o sube un `.txt` (formato del simulador, máximo 1 MB). Usa solo líneas sintéticas o anonimizadas.

### Si algo falla

- **Sin internet o link caído:** córrelo en local: `cd web && npm ci && npm run build && npm start`, y abre `http://localhost:3000/#tour`.
- **El micrófono no funciona:** escribe la pregunta. La voz es opcional.
- **"Demasiadas preguntas":** espera un minuto (límite de 20 preguntas por minuto por visitante).
- **Quieres empezar de nuevo:** recarga la página o pulsa **Iniciar demo** otra vez.
