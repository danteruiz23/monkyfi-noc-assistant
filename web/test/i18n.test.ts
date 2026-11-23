/**
 * Phase 2: EN/ES coverage of every visible text, the Spanish views of the
 * logic output, and the live replay helpers.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  correlate,
  draftSummary,
  importAlarmText,
  parseSyslogText,
  suggest,
  suggestionText,
  type AlertEvent,
} from "@/lib";
import { STRINGS, fmt, hasLogicText, logicText } from "@/lib/i18n";
import {
  alarmMessage,
  alertTypeKey,
  causalChain,
  closureSummary,
  hasSpanishMessage,
  incidentSeverity,
  incidentTitle,
  mttrSaving,
  remediationText,
  severityKey,
} from "@/lib/localize";
import { MAX_GAP_MS, MIN_GAP_MS, REPLAY_SPEEDS, replayDelay, replayLength, replayOrder } from "@/lib/replay";
import { WEB, alerts, dataText, runbooks } from "./helpers";

const sampleEvents = (): AlertEvent[] => parseSyslogText(dataText("alarmas-demo.txt"), 50).events;

describe("UI strings", () => {
  it("have the same keys in EN and ES and none is empty", () => {
    expect(Object.keys(STRINGS.es).sort()).toEqual(Object.keys(STRINGS.en).sort());
    for (const lang of ["en", "es"] as const) {
      for (const [key, value] of Object.entries(STRINGS[lang])) {
        expect(value.trim(), `${lang}.${key}`).not.toBe("");
      }
    }
  });

  it("use the same placeholders in EN and ES", () => {
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(STRINGS.en) as (keyof typeof STRINGS.en)[]) {
      expect(holes(STRINGS.es[key]), key).toEqual(holes(STRINGS.en[key]));
    }
  });

  it("are translated: ES differs from EN except for names, units and samples", () => {
    const same = new Set(["title", "brand", "product", "minutes", "utc", "colTickets", "typeTicket", "impPlaceholder"]);
    for (const key of Object.keys(STRINGS.en) as (keyof typeof STRINGS.en)[]) {
      if (same.has(key)) continue;
      expect(STRINGS.es[key], key).not.toBe(STRINGS.en[key]);
    }
  });

  it("fmt fills placeholders and leaves unknown ones", () => {
    expect(fmt("{n} of {total}", { n: 3, total: 50 })).toBe("3 of 50");
    expect(fmt("{x}", {})).toBe("{x}");
  });
});

const TEXT_ATTRS = new Set(["aria-label", "placeholder", "title", "alt", "label"]);

describe("no hard-coded visible text in components", () => {
  const dir = path.join(WEB, "components");
  const files = readdirSync(dir, { recursive: true, encoding: "utf-8" })
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => path.join(dir, f));

  it("finds the component files", () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it.each(files.map((f) => [path.relative(WEB, f), f]))("%s", (_name, file) => {
    const sf = ts.createSourceFile(file, readFileSync(file, "utf-8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const found: string[] = [];
    const visit = (node: ts.Node) => {
      // JSX text between tags, e.g. <p>Hello</p>, must come from STRINGS.
      if (ts.isJsxText(node) && /\p{L}/u.test(node.text)) found.push(node.text.trim());
      // Text-bearing attributes must not be literal words either.
      if (
        ts.isJsxAttribute(node) &&
        TEXT_ATTRS.has(node.name.getText(sf)) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer) &&
        /\p{L}/u.test(node.initializer.text)
      ) {
        found.push(`${node.name.getText(sf)}="${node.initializer.text}"`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    expect(found).toEqual([]);
  });
});

describe("Spanish views of the logic output", () => {
  const incidents = correlate(alerts());
  const withSample = correlate([...alerts(), ...sampleEvents()]);

  it("every demo and sample alarm message has a Spanish wording", () => {
    for (const e of [...alerts(), ...sampleEvents()]) {
      expect(hasSpanishMessage(e.message), e.message).toBe(true);
      expect(alarmMessage(e.message, "es")).not.toBe(e.message);
      expect(alarmMessage(e.message, "en")).toBe(e.message);
    }
  });

  it("keeps identifiers and numbers in translated messages", () => {
    const msg = "Packet loss 12.0% on MIA-CORE-01 Te0/0/2/0; 2 enterprise customers affected (ACME Corp, Globex)";
    expect(alarmMessage(msg, "es")).toBe(
      "Pérdida de paquetes de 12.0% en MIA-CORE-01 Te0/0/2/0; 2 clientes empresariales afectados (ACME Corp, Globex)",
    );
    expect(alarmMessage("unknown device text", "es")).toBe("unknown device text");
  });

  it("every runbook text and probable cause has a Spanish wording", () => {
    for (const rb of runbooks()) {
      for (const text of [rb.symptom, rb.root_cause, rb.action]) {
        expect(hasLogicText(text), text).toBe(true);
        expect(logicText(text, "es")).not.toBe(text);
      }
    }
    for (const inc of withSample) expect(hasLogicText(inc.probable_cause)).toBe(true);
  });

  it("every import error has a Spanish wording", () => {
    const errors = [
      importAlarmText(""),
      importAlarmText("x".repeat(1024 * 1024 + 1)),
      importAlarmText("a\n".repeat(5001)),
      importAlarmText("x".repeat(4097)),
      importAlarmText("not syslog"),
    ];
    for (const r of errors) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(hasLogicText(r.error), r.error).toBe(true);
    }
  });

  it("translates incident titles; English stays the logic title", () => {
    for (const inc of withSample) {
      expect(incidentTitle(inc, "en")).toBe(inc.title);
      expect(incidentTitle(inc, "es")).not.toBe(inc.title);
    }
    expect(incidentTitle(incidents[0], "es")).toBe(
      "Flap de BGP en MIA-EDGE-02 que deriva en saturación y pérdida de paquetes",
    );
  });

  it("English closure summary and remediation are exactly the parity-tested text", () => {
    for (const inc of withSample) {
      const s = suggest(inc, runbooks());
      expect(closureSummary(inc, s, "en")).toBe(draftSummary(inc, s));
      expect(remediationText(inc, s, "en")).toBe(suggestionText(inc, s));
      expect(remediationText(inc, [], "en")).toBe(suggestionText(inc, []));
    }
  });

  it("Spanish closure summary has the same lines and the same facts", () => {
    for (const inc of incidents) {
      const s = suggest(inc, runbooks());
      const en = closureSummary(inc, s, "en").split("\n");
      const es = closureSummary(inc, s, "es").split("\n");
      expect(es).toHaveLength(en.length);
      // Every number and identifier of each English line appears in the Spanish line.
      const facts = (line: string) => line.match(/[A-Z]{2,}-[\w-]+|\d+(?:\.\d+)?%?|[A-Z][a-z]\d[\w/]*/g) ?? [];
      en.forEach((line, i) => {
        for (const fact of facts(line)) expect(es[i], `line ${i}: ${fact}`).toContain(fact);
      });
    }
    const main = incidents[0];
    const es = closureSummary(main, suggest(main, runbooks()), "es");
    expect(es).toContain("Pérdida de paquetes máxima: 12.0%");
    expect(es).toContain("(19.5 min)");
    expect(es).toContain("Tickets duplicados fusionados: INC-1042, INC-1043, INC-1044");
    expect(es).toContain("Clientes afectados: ACME Corp, Globex");
  });

  it("labels every alarm type and severity in the data", () => {
    for (const e of [...alerts(), ...sampleEvents()]) {
      expect(alertTypeKey(e.alert_type), e.alert_type).not.toBeNull();
      expect(severityKey(e.severity), e.severity).not.toBeNull();
    }
  });
});

describe("detail and remediation helpers", () => {
  const [main, optical] = correlate(alerts());

  it("main incident is critical; causal chain is BGP flap -> saturation -> packet loss", () => {
    expect(incidentSeverity(main)).toBe("critical");
    const chain = causalChain(main);
    expect(chain.map((c) => c.alert_type)).toEqual(["bgp_flap", "link_saturation", "packet_loss"]);
    expect(chain[0].timestamp).toBe("2026-11-04T02:00:30Z");
    expect(chain[1].peak).toBe("97");
    expect(chain[2].peak).toBe("12.0");
  });

  it("optical incident chain is one optical step", () => {
    expect(causalChain(optical).map((c) => c.alert_type)).toEqual(["optical_degradation"]);
  });

  it("MTTR saving is computed from the runbook numbers", () => {
    const [top] = suggest(main, runbooks());
    expect(top.runbook_id).toBe("RB-01");
    expect(mttrSaving(top.mttr_before_min, top.mttr_after_min)).toBe(82);
    expect(mttrSaving(0, 0)).toBe(0);
  });
});

describe("live replay", () => {
  const ordered = replayOrder(alerts());

  it("plays all 50 events in time order and ends with the SPEC incident", () => {
    expect(ordered).toHaveLength(50);
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i - 1].timestamp <= ordered[i].timestamp).toBe(true);
    }
    const [main] = correlate(ordered);
    expect(main.event_count).toBe(44);
    expect(main.ticket_ids).toEqual(["INC-1042", "INC-1043", "INC-1044"]);
  });

  it("every partial replay correlates without errors and grows step by step", () => {
    let last = 0;
    for (let n = 0; n <= ordered.length; n++) {
      const incidents = correlate(ordered.slice(0, n));
      const total = incidents.reduce((sum, inc) => sum + inc.event_count, 0);
      expect(total).toBe(n);
      expect(incidents.length).toBeGreaterThanOrEqual(last);
      last = incidents.length;
    }
    expect(last).toBe(2);
  });

  it("waits are scaled by speed and clamped", () => {
    expect(replayDelay(ordered, 0, 60)).toBe(0);
    for (const speed of REPLAY_SPEEDS) {
      for (let i = 1; i < ordered.length; i++) {
        const d = replayDelay(ordered, i, speed);
        expect(d).toBeGreaterThanOrEqual(MIN_GAP_MS);
        expect(d).toBeLessThanOrEqual(MAX_GAP_MS);
      }
    }
    // The 19.5-minute arc fits in a short demo at every speed.
    expect(replayLength(ordered, 30)).toBeLessThan(60_000);
    expect(replayLength(ordered, 120)).toBeLessThan(replayLength(ordered, 30));
  });
});
