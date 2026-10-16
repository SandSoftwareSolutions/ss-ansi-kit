const ESC = "\u001b";
// CSI sequences (colors, cursor moves) and OSC sequences (titles, hyperlinks).
const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[@-Z\\-_]/g;

/** Removes colors and other terminal control sequences from text. */
export function strip(text) {
  return String(text).replace(ANSI, "");
}

/**
 * How many colors the output can show: 0 (none), 1 (16 colors), 2 (256), 3 (true color).
 * Follows the usual rules: `NO_COLOR` (any value) turns colors off, `FORCE_COLOR` = 0/1/2/3 decides, `TERM=dumb` is none, otherwise a
 * terminal (`stream.isTTY`) gets colors and a pipe or file does not.
 */
export function colorLevel(stream = process.stdout, env = process.env) {
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "") {
    const forced = env.FORCE_COLOR === "true" ? 1 : Number(env.FORCE_COLOR);
    return Number.isInteger(forced) ? Math.max(0, Math.min(3, forced)) : 1;
  }
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") return 0;
  if (!stream?.isTTY || env.TERM === "dumb") return 0;
  if (env.COLORTERM === "truecolor" || env.COLORTERM === "24bit") return 3;
  if (/256/.test(env.TERM ?? "")) return 2;
  return 1;
}

function wrap(open, close, enabled) {
  if (!enabled) return (text) => String(text);
  const o = `${ESC}[${open}m`;
  const c = `${ESC}[${close}m`;
  // Text inside may close the same style (a colored word inside a colored sentence); reopen ours after it.
  return (text) => {
    const s = String(text);
    return s === "" ? s : `${o}${s.includes(c) ? s.split(c).join(`${c}${o}`) : s}${c}`;
  };
}

const STYLES = {
  bold: [1, 22], dim: [2, 22], italic: [3, 23], underline: [4, 24], inverse: [7, 27], strikethrough: [9, 29],
  black: [30, 39], red: [31, 39], green: [32, 39], yellow: [33, 39], blue: [34, 39], magenta: [35, 39], cyan: [36, 39], white: [37, 39], gray: [90, 39],
  brightRed: [91, 39], brightGreen: [92, 39], brightYellow: [93, 39], brightBlue: [94, 39], brightMagenta: [95, 39], brightCyan: [96, 39],
  bgRed: [41, 49], bgGreen: [42, 49], bgYellow: [43, 49], bgBlue: [44, 49], bgMagenta: [45, 49], bgCyan: [46, 49], bgWhite: [47, 49], bgGray: [100, 49]
};

/**
 * Colors and styles that switch themselves off when the output is not a terminal. `const c = createColors();` then `c.red("error")`,
 * `c.bold(c.green("ok") + " done")`. Styles nest correctly. `createColors({ level: 0 })` forces plain text (tests), `level: 3` forces
 * color. `c.hex("#ff8800")("text")` and `c.rgb(255, 136, 0)("text")` give any color, reduced to what the terminal supports.
 */
export function createColors({ level = colorLevel() } = {}) {
  const enabled = level > 0;
  const colors = { level, enabled };
  for (const [name, [open, close]] of Object.entries(STYLES)) colors[name] = wrap(open, close, enabled);
  colors.rgb = (r, g, b) => {
    for (const v of [r, g, b]) if (!Number.isInteger(v) || v < 0 || v > 255) throw new RangeError("ansi-kit: rgb values must be whole numbers from 0 to 255");
    if (level >= 3) return wrap(`38;2;${r};${g};${b}`, 39, true);
    if (level === 2) return wrap(`38;5;${16 + 36 * Math.round((r / 255) * 5) + 6 * Math.round((g / 255) * 5) + Math.round((b / 255) * 5)}`, 39, true);
    if (level === 1) {
      const bright = Math.max(r, g, b) > 170;
      const code = 30 + ((r > 127 ? 1 : 0) | (g > 127 ? 2 : 0) | (b > 127 ? 4 : 0));
      return wrap(bright && code !== 30 ? code + 60 : code, 39, true);
    }
    return (text) => String(text);
  };
  colors.hex = (value) => {
    const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(value);
    if (!m) throw new TypeError(`ansi-kit: "${value}" is not a hex color like #ff8800`);
    const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
    return colors.rgb(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
  };
  colors.link = (url, text = url) => (enabled && level >= 1 ? `${ESC}]8;;${url}${ESC}\\${text}${ESC}]8;;${ESC}\\` : text === url ? url : `${text} (${url})`);
  return colors;
}

const wideRanges = [[0x1100, 0x115f], [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa000, 0xa4cf], [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe30, 0xfe6f], [0xff00, 0xff60], [0xffe0, 0xffe6], [0x20000, 0x3fffd]];

function graphemeWidth(g) {
  const cp = g.codePointAt(0);
  if (cp < 32 || (cp >= 0x7f && cp < 0xa0)) return 0;
  if (/^\p{M}+$/u.test(g)) return 0;
  if (/\p{Extended_Pictographic}/u.test(g) || /\p{Regional_Indicator}/u.test(g)) return 2;
  return wideRanges.some(([a, b]) => cp >= a && cp <= b) ? 2 : 1;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** How many columns the text takes on screen: colors take none, CJK letters and emoji take two, accents and joiners none. */
export function width(text) {
  let total = 0;
  for (const { segment } of segmenter.segment(strip(text))) total += graphemeWidth(segment);
  return total;
}

/** Pads to a visible width: `align` is "left" (default), "right" or "center". Longer text is returned as it is. */
export function pad(text, columns, align = "left") {
  const gap = Math.max(0, columns - width(text));
  if (align === "right") return " ".repeat(gap) + text;
  if (align === "center") return " ".repeat(Math.floor(gap / 2)) + text + " ".repeat(Math.ceil(gap / 2));
  return text + " ".repeat(gap);
}

/** Cuts to a visible width (with `…` by default), keeping colors working: any style that is open at the cut is closed. */
export function truncate(text, columns, { ellipsis = "…" } = {}) {
  if (!Number.isInteger(columns) || columns < 0) throw new RangeError("ansi-kit: columns must be a whole number, 0 or more");
  if (width(text) <= columns) return text;
  const room = Math.max(0, columns - width(ellipsis));
  let out = "";
  let used = 0;
  let open = false;
  const tokens = String(text).split(new RegExp(`(${ANSI.source})`, "g"));
  for (const token of tokens) {
    if (token === "") continue;
    if (new RegExp(`^(?:${ANSI.source})$`).test(token)) {
      out += token;
      open = !/^\u001b\[(?:0|)m$/.test(token);
      continue;
    }
    for (const { segment } of segmenter.segment(token)) {
      const w = graphemeWidth(segment);
      if (used + w > room) return out + (open ? `${ESC}[0m` : "") + ellipsis;
      out += segment;
      used += w;
    }
  }
  return out;
}

const BORDERS = {
  none: null,
  simple: { h: "-", v: "|", tl: "+", tr: "+", bl: "+", br: "+", t: "+", b: "+", l: "+", r: "+", x: "+" },
  rounded: { h: "─", v: "│", tl: "╭", tr: "╮", bl: "╰", br: "╯", t: "┬", b: "┴", l: "├", r: "┤", x: "┼" }
};

/**
 * Lays out rows as an aligned table that copes with colors, wide letters and emoji. `rows` is an array of arrays; `header` is an
 * array of titles. Options: `align` (array of "left" | "right" | "center" per column), `border` ("none" default, "simple", "rounded"),
 * `maxWidth` (the table is narrowed by shortening the widest columns), `padding` (spaces around cells with a border, default 1).
 * Returns text; print it with `console.log`.
 */
export function table(rows, { header, align = [], border = "none", maxWidth, padding = 1, gap = 2 } = {}) {
  if (!Array.isArray(rows)) throw new TypeError("ansi-kit: rows must be an array of arrays");
  if (!(border in BORDERS)) throw new RangeError('ansi-kit: border must be "none", "simple" or "rounded"');
  const all = header ? [header, ...rows] : rows;
  const columns = Math.max(0, ...all.map((r) => r.length));
  const cell = (r, i) => (r[i] === undefined || r[i] === null ? "" : String(r[i]).replace(/\r?\n/g, " "));
  const widths = Array.from({ length: columns }, (_, i) => Math.max(1, ...all.map((r) => width(cell(r, i)))));
  const b = BORDERS[border];
  const overhead = b ? columns * (2 * padding + 1) + 1 : (columns - 1) * gap;
  if (maxWidth !== undefined) {
    let excess = widths.reduce((a, c) => a + c, 0) + overhead - maxWidth;
    while (excess > 0) {
      const widest = widths.indexOf(Math.max(...widths));
      if (widths[widest] <= 4) break;
      widths[widest]--;
      excess--;
    }
  }
  const format = (r) =>
    widths.map((w, i) => pad(truncate(cell(r, i), w), w, align[i] ?? "left"));
  const line = (r) => (b ? `${b.v}${format(r).map((c) => " ".repeat(padding) + c + " ".repeat(padding)).join(b.v)}${b.v}` : format(r).join(" ".repeat(gap)).trimEnd());
  const rule = (left, mid, right) => left + widths.map((w) => b.h.repeat(w + 2 * padding)).join(mid) + right;
  const out = [];
  if (b) out.push(rule(b.tl, b.t, b.tr));
  if (header) {
    out.push(line(header));
    out.push(b ? rule(b.l, b.x, b.r) : widths.map((w) => "─".repeat(w)).join(" ".repeat(gap)));
  }
  for (const r of rows) out.push(line(r));
  if (b) out.push(rule(b.bl, b.b, b.br));
  return out.join("\n");
}

/** `progressBar(0.4)` is `"████████░░░░░░░░░░░░ 40%"`. A fraction from 0 to 1. */
export function progressBar(fraction, { width: size = 20, filled = "█", empty = "░", showPercent = true } = {}) {
  if (!Number.isFinite(fraction)) throw new TypeError("ansi-kit: progressBar needs a number from 0 to 1");
  const f = Math.max(0, Math.min(1, fraction));
  const done = Math.round(f * size);
  return `${filled.repeat(done)}${empty.repeat(size - done)}${showPercent ? ` ${Math.round(f * 100)}%` : ""}`;
}

/** Symbols that fall back to plain ASCII when the terminal cannot show them (`unicode: false`, for old Windows consoles and logs). */
export function symbols({ unicode = process.platform !== "win32" || Boolean(process.env.WT_SESSION) || process.env.TERM_PROGRAM === "vscode" } = {}) {
  return unicode
    ? { ok: "✔", fail: "✖", warn: "⚠", info: "ℹ", bullet: "•", arrow: "→", ellipsis: "…", line: "─" }
    : { ok: "√", fail: "×", warn: "!", info: "i", bullet: "*", arrow: "->", ellipsis: "...", line: "-" };
}

/** Spinner frames to cycle through: `spinnerFrames()[tick % frames.length]`. */
export function spinnerFrames({ unicode = true } = {}) {
  return unicode ? ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] : ["-", "\\", "|", "/"];
}

/** Control sequences for live output: `process.stdout.write(cursor.up(1) + cursor.eraseLine + "new text")`. Only use them when the output is a terminal. */
export const cursor = {
  up: (n = 1) => `${ESC}[${n}A`,
  down: (n = 1) => `${ESC}[${n}B`,
  toColumn: (n = 1) => `${ESC}[${n}G`,
  eraseLine: `${ESC}[2K\r`,
  hide: `${ESC}[?25l`,
  show: `${ESC}[?25h`
};
