/**
 * Small helpers that reproduce Python behaviour the backend depends on.
 *
 * The TypeScript port must give the same text as backend/*.py, character for
 * character. JavaScript differs from Python in a few places that show up in
 * that text, so they are handled here once:
 *
 * - Numbers: Python prints the float 12.0 as "12.0"; JavaScript prints "12".
 *   Floats read from data keep their type through `PyFloat`.
 * - round(x, 1) in Python rounds exact ties to even (round(0.25, 1) == 0.2).
 * - str.splitlines(), str.strip(), str.isspace() and len() use Python's rules.
 * - Python regular expressions treat \w, \b, \s and \d as Unicode classes,
 *   and IGNORECASE has a few extra letter matches (i/ı, s/ſ).
 */

/** A Python float. Keeps 12.0 apart from the int 12 so text matches Python. */
export class PyFloat {
  constructor(readonly value: number) {}
  valueOf(): number {
    return this.value;
  }
  toJSON(): number {
    return this.value;
  }
  toString(): string {
    return pyFloatRepr(this.value);
  }
}

/** A value Python treats as int or float (isinstance(v, (int, float))). */
export type PyNumber = number | bigint | boolean | PyFloat;

export function isPyNumber(v: unknown): v is PyNumber {
  return (
    typeof v === "number" || typeof v === "bigint" || typeof v === "boolean" || v instanceof PyFloat
  );
}

/** Compare two Python numbers with ">" (exact, like Python's int/float compare). */
export function pyGreater(a: PyNumber, b: PyNumber): boolean {
  const x = a instanceof PyFloat ? a.value : a;
  const y = b instanceof PyFloat ? b.value : b;
  return (x as number) > (y as number);
}

/** Python max() over a non-empty list: the first largest item wins. */
export function pyMax<T extends PyNumber>(items: T[]): T {
  let best = items[0];
  for (let i = 1; i < items.length; i++) {
    if (pyGreater(items[i], best)) best = items[i];
  }
  return best;
}

/** repr() of a Python float. */
export function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return "nan";
  if (x === Infinity) return "inf";
  if (x === -Infinity) return "-inf";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const sign = x < 0 ? "-" : "";
  // Shortest round-trip digits, the same digits Python's repr uses.
  const [mant, expPart] = Math.abs(x).toExponential().split("e");
  const digits = mant.replace(".", "");
  const exp = Number(expPart);
  if (exp >= -5 + 1 && exp < 16) {
    // Fixed notation: Python switches to scientific below 1e-4 or from 1e16.
    let out: string;
    if (exp >= 0) {
      const intLen = exp + 1;
      out =
        digits.length <= intLen
          ? digits + "0".repeat(intLen - digits.length) + ".0"
          : digits.slice(0, intLen) + "." + digits.slice(intLen);
    } else {
      out = "0." + "0".repeat(-exp - 1) + digits;
    }
    return sign + out;
  }
  const m = digits.length > 1 ? digits[0] + "." + digits.slice(1) : digits;
  const e = Math.abs(exp).toString().padStart(2, "0");
  return `${sign}${m}e${exp < 0 ? "-" : "+"}${e}`;
}

/** str() of a value as Python's f-strings print it. */
export function pyStr(v: unknown): string {
  if (v instanceof PyFloat) return pyFloatRepr(v.value);
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : pyFloatRepr(v);
  if (v === null || v === undefined) return "None";
  return String(v);
}

/** Python round(x, ndigits) for a float: exact ties go to the even digit. */
export function pyRound(x: number, ndigits: number): number {
  if (!Number.isFinite(x) || Math.abs(x) >= 1e21) return x;
  const abs = Math.abs(x);
  // toFixed(100) is the exact decimal value of the double.
  const exact = abs.toFixed(100);
  const [, frac] = exact.split(".");
  const tail = frac.slice(ndigits);
  let r: number;
  if (tail[0] === "5" && /^0*$/.test(tail.slice(1))) {
    const kept = exact.slice(0, exact.indexOf(".") + 1 + ndigits);
    const lastDigit = Number(kept.replace(".", "").slice(-1));
    r = lastDigit % 2 === 0 ? Number(kept) : Number(abs.toFixed(ndigits));
  } else {
    r = Number(abs.toFixed(ndigits));
  }
  return x < 0 ? -r : r;
}

// ------------------------------------------------------------------ strings

/** Characters Python's str.isspace() (and regex \s) accept. */
export const PY_WS = "\\t\\n\\x0b\\x0c\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const PY_WS_EDGES = new RegExp(`^[${PY_WS}]+|[${PY_WS}]+$`, "gu");
const PY_LINE_BREAK = /\r\n|[\n\r\x0b\x0c\x1c\x1d\x1e\x85\u2028\u2029]/u;

/** str.strip() with no arguments. */
export function pyStrip(s: string): string {
  return s.replace(PY_WS_EDGES, "");
}

/** str.splitlines(): no trailing empty item, same line breaks as Python. */
export function pySplitlines(s: string): string[] {
  if (s === "") return [];
  const parts = s.split(PY_LINE_BREAK);
  if (parts[parts.length - 1] === "") parts.pop();
  return parts;
}

/** len() of a Python str (code points, not UTF-16 units). */
export function pyLen(s: string): number {
  let n = 0;
  for (const _ of s) n++;
  return n;
}

/** Bytes in s.encode("utf-8"). A lone surrogate counts 3 bytes. */
export function utf8Length(s: string): number {
  let n = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    n += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return n;
}

/** Python string ordering (by code point). */
export function pyCompare(a: string, b: string): number {
  const ai = a[Symbol.iterator]();
  const bi = b[Symbol.iterator]();
  for (;;) {
    const x = ai.next();
    const y = bi.next();
    if (x.done || y.done) return x.done && y.done ? 0 : x.done ? -1 : 1;
    const cx = x.value.codePointAt(0)!;
    const cy = y.value.codePointAt(0)!;
    if (cx !== cy) return cx < cy ? -1 : 1;
  }
}

/** sorted(set(items)) for strings. */
export function pySortedUnique(items: string[]): string[] {
  return [...new Set(items)].sort(pyCompare);
}

// ------------------------------------------------------------------- digits

const ND = /^\p{Nd}$/u;

/** int() value of one Unicode decimal digit (Nd digits come in runs of ten). */
export function digitValue(ch: string): number {
  let cp = ch.codePointAt(0)!;
  if (cp >= 0x30 && cp <= 0x39) return cp - 0x30;
  let start = cp;
  while (ND.test(String.fromCodePoint(start - 1))) start--;
  return (cp - start) % 10;
}

/** Replace every Unicode decimal digit with its ASCII digit. */
export function asciiDigits(s: string): string {
  return s.replace(/\p{Nd}/gu, (d) => String(digitValue(d)));
}

/** Python int(s) for a str, or undefined where Python raises ValueError. */
export function pyParseInt(raw: string): number | bigint | undefined {
  const s = pyStrip(raw);
  if (!/^[+-]?\p{Nd}+(?:_\p{Nd}+)*$/u.test(s)) return undefined;
  const ascii = asciiDigits(s).replace(/_/g, "");
  const digits = ascii.replace(/^[+-]/, "");
  if (digits.length > 4300) return undefined; // Python's default int-string limit
  const big = BigInt(ascii);
  const safe = BigInt(Number.MAX_SAFE_INTEGER);
  return big <= safe && big >= -safe ? Number(big) : big;
}

/** Python float(s) for a str, or undefined where Python raises ValueError. */
export function pyParseFloat(raw: string): PyFloat | undefined {
  const s = pyStrip(raw);
  const special = /^([+-]?)(inf|infinity|nan)$/i.exec(s);
  if (special) {
    const neg = special[1] === "-";
    const v = special[2].toLowerCase() === "nan" ? NaN : Infinity;
    return new PyFloat(neg ? -v : v);
  }
  const dp = "\\p{Nd}(?:_?\\p{Nd})*";
  const grammar = new RegExp(`^[+-]?(?:${dp}\\.(?:${dp})?|\\.${dp}|${dp})(?:[eE][+-]?${dp})?$`, "u");
  if (!grammar.test(s)) return undefined;
  return new PyFloat(Number(asciiDigits(s).replace(/_/g, "")));
}

// ---------------------------------------------------------- regular expressions

const W = "[\\p{L}\\p{N}_]";
const BOUNDARY = `(?:(?<=${W})(?!${W})|(?<!${W})(?=${W}))`;

/**
 * Build a JavaScript RegExp from a Python `re` pattern used by the backend.
 * Only \b \w \s \S \d outside character classes are translated, which is all
 * the backend patterns use. Always Unicode mode.
 */
export function pyRegex(source: string, flags = ""): RegExp {
  let out = "";
  let inClass = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === "\\") {
      const n = source[i + 1];
      i++;
      if (!inClass) {
        if (n === "b") { out += BOUNDARY; continue; }
        if (n === "w") { out += W; continue; }
        if (n === "s") { out += `[${PY_WS}]`; continue; }
        if (n === "S") { out += `[^${PY_WS}]`; continue; }
        if (n === "d") { out += "\\p{Nd}"; continue; }
      }
      out += "\\" + n;
      continue;
    }
    if (c === "[" && !inClass) inClass = true;
    else if (c === "]" && inClass) inClass = false;
    out += c;
  }
  return new RegExp(out, flags.includes("u") ? flags : flags + "u");
}

/**
 * Input for a Python IGNORECASE search. Python also matches "ı" and "İ" with
 * "i"; JavaScript does not, so those two letters are mapped first. The result
 * is only used to test for a match, never shown.
 */
export function ignoreCaseInput(s: string): string {
  return s.replace(/[\u0130\u0131]/g, "i");
}

/** The backend's _fold(): lowercase, decompose, drop combining marks. */
export function pyFold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "");
}

// --------------------------------------------------------------------- JSON

/**
 * JSON.parse that keeps Python's int/float split: a number written with a
 * "." or an exponent (12.0, 1e3) becomes a PyFloat, like json.load() makes a
 * float. Integers beyond the safe range become bigint.
 */
export function parsePyJson<T = unknown>(text: string): T {
  let marked = "";
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < n && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      marked += text.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === "-" || (c >= "0" && c <= "9")) {
      const m = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i, i + 400));
      if (m) {
        const tok = m[0];
        if (m[1] !== undefined || m[2] !== undefined) {
          marked += `{"$float":"${tok}"}`;
        } else if (!Number.isSafeInteger(Number(tok))) {
          marked += `{"$int":"${tok}"}`;
        } else {
          marked += tok;
        }
        i += tok.length;
        continue;
      }
    }
    marked += c;
    i++;
  }
  return JSON.parse(marked, (_key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const keys = Object.keys(value);
      if (keys.length === 1 && keys[0] === "$float") return new PyFloat(Number(value.$float));
      if (keys.length === 1 && keys[0] === "$int") return BigInt(value.$int);
    }
    return value;
  }) as T;
}
