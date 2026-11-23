import { describe, expect, it } from "vitest";
import { importAlarmText, importLimitError, parseSyslogText } from "@/lib";
import { alerts, comparableBundle, dataText, fixture, incidentBundle, runbooks, tag } from "./helpers";

const parse = fixture("parse.json");
const fuzz = fixture<any[]>("fuzz.json");
const limits = fixture<any[]>("limits.json");

describe("syslog parsing matches Python", () => {
  for (const key of ["syslog.txt@0", "syslog.txt@50", "alarmas-demo.txt@0", "alarmas-demo.txt@50"]) {
    it(key, () => {
      const { file, offset, events, invalid } = parse[key];
      const out = parseSyslogText(dataText(file), offset);
      expect(out.invalid).toBe(invalid);
      expect(tag(out.events)).toEqual(events);
    });
  }

  it("pipeline: parsed alarms correlate, remediate and summarise like Python", () => {
    const syslog = parseSyslogText(dataText("syslog.txt")).events;
    const demo = parseSyslogText(dataText("alarmas-demo.txt")).events;
    const rbs = runbooks();
    expect(comparableBundle(incidentBundle(syslog, rbs))).toEqual(comparableBundle(parse.pipeline["syslog.txt"]));
    expect(comparableBundle(incidentBundle(demo, rbs))).toEqual(comparableBundle(parse.pipeline["alarmas-demo.txt"]));
    expect(comparableBundle(incidentBundle([...alerts(), ...demo], rbs))).toEqual(
      comparableBundle(parse.pipeline["alerts+alarmas-demo"]),
    );
  });

  it("the syslog version of the demo gives the same main incident", () => {
    const bundle = incidentBundle(parseSyslogText(dataText("syslog.txt")).events, runbooks());
    const main = bundle.incidents![0].incident as any;
    expect(main.event_count).toBe(44);
    expect(main.ticket_ids).toEqual(["INC-1042", "INC-1043", "INC-1044"]);
  });
});

describe(`random syslog corpus (${fuzz.length} cases) matches Python`, () => {
  const rbs = runbooks();
  it.each(fuzz.map((c, i) => [i, c] as const))("case %i", (_i, c) => {
    expect(importLimitError(c.text)).toBe(c.limit_error);
    const out = parseSyslogText(c.text, c.offset);
    expect(out.invalid).toBe(c.invalid);
    expect(tag(out.events)).toEqual(c.events);
    if (c.pipeline) {
      expect(comparableBundle(incidentBundle(out.events, rbs, true))).toEqual(comparableBundle(c.pipeline));
    }
  });

  it("covers suspicious lines, bad timestamps and floats", () => {
    expect(fuzz.some((c) => c.pipeline && "error" in c.pipeline)).toBe(true);
    expect(fuzz.some((c) => c.invalid > 0)).toBe(true);
    expect(JSON.stringify(fuzz)).toContain('"$float"');
  });
});

describe("import limits match Python", () => {
  it.each(limits.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const text = (c.recipe as [string, number][]).map(([unit, n]) => unit.repeat(n)).join("");
    expect(importLimitError(text)).toBe(c.error);
  });
});

describe("POST /alerts/import checks", () => {
  it("rejects empty, blank and non-string input", () => {
    for (const input of ["", "   \n\t", null, 42, undefined]) {
      expect(importAlarmText(input)).toEqual({
        ok: false,
        error: "paste syslog alarm lines or select a non-empty text file",
      });
    }
  });

  it("rejects text without a supported alarm", () => {
    expect(importAlarmText("hello\n<script>alert(1)</script>")).toEqual({
      ok: false,
      error: "no supported syslog alarms found; expected simulator-style syslog lines",
    });
  });

  it("drops script tags and destructive commands, keeps valid alarms", () => {
    const text = [
      "<134>1 2026-11-02T09:00:00Z MIA-EDGE-02 BGP-5-ADJCHANGE: Te0/0/0/1 bgp_neighbor_state=down ok <script>x</script>",
      "<134>1 2026-11-02T09:01:00Z MIA-EDGE-02 BGP-5-ADJCHANGE: Te0/0/0/1 bgp_neighbor_state=up run rm -rf /",
      "<134>1 2026-11-02T09:02:00Z MIA-EDGE-02 LINK-4-UTILIZATION: Te0/0/0/0 link_utilization_pct=92 fine",
    ].join("\n");
    const result = importAlarmText(text, 50);
    expect(result).toMatchObject({ ok: true, imported: 1, ignored: 2 });
    if (result.ok) expect(result.events[0].event_id).toBe("import-000051");
  });

  it("rejects text over the size limit before parsing", () => {
    expect(importAlarmText("x\n".repeat(5001))).toEqual({ ok: false, error: "Alarm text has too many lines (maximum 5000)." });
  });
});
