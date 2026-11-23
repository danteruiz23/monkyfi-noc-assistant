import { describe, expect, it } from "vitest";
import { parseTimestamp, TimestampError } from "@/lib";
import { PyFloat, parsePyJson, pyFloatRepr, pyRound, pySplitlines, pyStr, pyStrip } from "@/lib/py";
import { fixture, fromBits } from "./helpers";

const numbers = fixture("numbers.json");

describe("Python number formatting", () => {
  it.each(numbers.repr as [string, string][])("repr(%s) == %s", (bits, repr) => {
    expect(pyFloatRepr(fromBits(bits))).toBe(repr);
  });

  it("round(seconds / 60, 1) matches Python for every 15-second step", () => {
    for (const [seconds, expected] of numbers.round_minutes as [number, { $float: string }][]) {
      expect(pyFloatRepr(pyRound(seconds / 60, 1)), `seconds=${seconds}`).toBe(expected.$float);
    }
  });

  it.each(numbers.round_misc as [string, string][])("round(%s, 1) == %s", (bits, repr) => {
    expect(pyFloatRepr(pyRound(fromBits(bits), 1))).toBe(repr);
  });

  it("prints ints, floats and booleans like Python f-strings", () => {
    expect(pyStr(12)).toBe("12");
    expect(pyStr(new PyFloat(12))).toBe("12.0");
    expect(pyStr(true)).toBe("True");
    expect(pyStr(10n ** 30n)).toBe("1000000000000000000000000000000");
  });

  it("parsePyJson keeps the float type of 12.0 and the exact value of big ints", () => {
    const v = parsePyJson<any>('{"a": 12.0, "b": 12, "c": "12.0", "d": -1e3, "e": 123456789012345678901, "f": [0.5]}');
    expect(v.a).toBeInstanceOf(PyFloat);
    expect(pyStr(v.a)).toBe("12.0");
    expect(v.b).toBe(12);
    expect(v.c).toBe("12.0");
    expect(pyStr(v.d)).toBe("-1000.0");
    expect(v.e).toBe(123456789012345678901n);
    expect(pyStr(v.f[0])).toBe("0.5");
  });

  it("splitlines and strip follow Python", () => {
    expect(pySplitlines("a\nb\r\nc\rd\x0be\x1cf\x85g h\n")).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect(pySplitlines("")).toEqual([]);
    expect(pySplitlines("\n")).toEqual([""]);
    expect(pyStrip("\x1c　 x \x85")).toBe("x");
    expect(pyStrip("﻿x")).toBe("﻿x");
  });
});

describe("timestamps (datetime.strptime)", () => {
  it.each(numbers.timestamps as [string, string | null][])("%j -> %j", (ts, expected) => {
    if (expected === null) {
      expect(() => parseTimestamp(ts)).toThrow(TimestampError);
    } else {
      const ms = parseTimestamp(ts);
      const d = new Date(ms);
      const p = (n: number) => String(n).padStart(2, "0");
      const text = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`;
      expect(text).toBe(expected);
    }
  });
});
