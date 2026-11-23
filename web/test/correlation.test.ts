import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { correlate, draftSummary, pyFloatRepr, suggest } from "@/lib";
import { WEB, alerts, comparableBundle, dataText, fixture, incidentBundle, runbooks } from "./helpers";

const py = fixture("incidents.json");

describe("main demo incident (SPEC acceptance)", () => {
  it("gives 44 events, 19.5 minutes and tickets INC-1042 to INC-1044", () => {
    const [main, second] = correlate(alerts());
    expect(main.event_count).toBe(44);
    expect(main.events).toHaveLength(44);
    expect(pyFloatRepr(main.duration_minutes)).toBe("19.5");
    expect(main.ticket_ids).toEqual(["INC-1042", "INC-1043", "INC-1044"]);
    expect(main.start).toBe("2026-11-04T02:00:30Z");
    expect(main.end).toBe("2026-11-04T02:20:00Z");
    expect(second.primary_device).toBe("DFW-CORE-01");
    expect(second.event_count).toBe(6);
  });

  it("reads 50 synthetic events and 10 runbooks", () => {
    expect(alerts()).toHaveLength(50);
    expect(runbooks()).toHaveLength(10);
  });

  it("does not change the input events", () => {
    const events = alerts();
    const before = JSON.stringify(events);
    const ids = events.map((e) => e.event_id);
    correlate(events);
    expect(events.map((e) => e.event_id)).toEqual(ids);
    expect(JSON.stringify(events)).toBe(before);
  });

  it("puts 12.0 (a Python float) in the summary exactly as Python does", () => {
    const [main] = correlate(alerts());
    const summary = draftSummary(main, suggest(main, runbooks()));
    expect(summary).toContain("Peak packet loss: 12.0%");
    expect(summary).toContain("(19.5 min)");
  });
});

describe("parity with Python: correlation, remediation, summary", () => {
  const cases: [string, () => ReturnType<typeof incidentBundle>][] = [
    ["alerts", () => incidentBundle(alerts(), runbooks())],
    ["alerts_no_runbooks", () => incidentBundle(alerts(), [])],
    ["alerts_reversed", () => incidentBundle([...alerts()].reverse(), runbooks())],
    ["empty", () => incidentBundle([], runbooks())],
  ];
  it.each(cases)("%s", (name, run) => {
    expect(comparableBundle(run())).toEqual(comparableBundle(py[name]));
  });

  it("summaries match Python character for character", () => {
    const ts = incidentBundle(alerts(), runbooks()).incidents!;
    const expected = py.alerts.incidents as { summary: string }[];
    expect(ts.map((b) => b.summary)).toEqual(expected.map((b) => b.summary));
  });
});

describe("demo data copies", () => {
  it.each(["alerts.json", "runbooks.json", "syslog.txt", "alarmas-demo.txt"])(
    "web/data/%s is identical to data/%s",
    (name) => {
      const original = readFileSync(path.join(WEB, "..", "data", name), "utf-8");
      expect(dataText(name)).toBe(original);
    },
  );
});

describe("EN/ES texts", () => {
  it("every UI string exists in both languages and is not empty", async () => {
    const { STRINGS, logicText } = await import("@/lib/i18n");
    expect(Object.keys(STRINGS.es).sort()).toEqual(Object.keys(STRINGS.en).sort());
    for (const lang of ["en", "es"] as const) {
      for (const value of Object.values(STRINGS[lang])) expect(value.trim()).not.toBe("");
    }
    for (const inc of correlate(alerts())) {
      expect(logicText(inc.probable_cause, "es")).not.toBe(inc.probable_cause);
    }
  });
});
