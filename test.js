import assert from "node:assert/strict";
import { test } from "node:test";

import { colorLevel, createColors, cursor, pad, progressBar, spinnerFrames, strip, symbols, table, truncate, width } from "./src/index.js";

const tty = { isTTY: true };
const pipe = { isTTY: false };

test("color level follows NO_COLOR, FORCE_COLOR, the terminal and TERM", () => {
  assert.equal(colorLevel(pipe, {}), 0);
  assert.equal(colorLevel(tty, {}), 1);
  assert.equal(colorLevel(tty, { TERM: "xterm-256color" }), 2);
  assert.equal(colorLevel(tty, { COLORTERM: "truecolor" }), 3);
  assert.equal(colorLevel(tty, { NO_COLOR: "1" }), 0);
  assert.equal(colorLevel(tty, { NO_COLOR: "" }), 1); // empty means unset, per no-color.org
  assert.equal(colorLevel(tty, { TERM: "dumb" }), 0);
  assert.equal(colorLevel(pipe, { FORCE_COLOR: "1" }), 1);
  assert.equal(colorLevel(pipe, { FORCE_COLOR: "3" }), 3);
  assert.equal(colorLevel(tty, { FORCE_COLOR: "0" }), 0);
  assert.equal(colorLevel(tty, { FORCE_COLOR: "true" }), 1);
  assert.equal(colorLevel(tty, { NO_COLOR: "1", FORCE_COLOR: "2" }), 2);
  assert.equal(colorLevel(undefined, {}), 0);
});

test("styles wrap text and switch off completely when colors are off", () => {
  const on = createColors({ level: 1 });
  assert.equal(on.red("x"), "\u001b[31mx\u001b[39m");
  assert.equal(on.bold("x"), "\u001b[1mx\u001b[22m");
  assert.equal(on.red(""), "");
  assert.equal(on.red(5), "\u001b[31m5\u001b[39m");
  const off = createColors({ level: 0 });
  assert.equal(off.red("x"), "x");
  assert.equal(off.enabled, false);
  assert.equal(off.hex("#fff")("x"), "x");
});

test("styles nest: the outer style continues after an inner one ends", () => {
  const c = createColors({ level: 1 });
  const text = c.red(`a ${c.green("b")} c`);
  assert.equal(text, "\u001b[31ma \u001b[32mb\u001b[39m\u001b[31m c\u001b[39m");
  assert.equal(strip(text), "a b c");
  assert.equal(strip(c.bold(c.underline(c.red("deep")))), "deep");
});

test("rgb and hex are reduced to what the terminal can show", () => {
  assert.equal(createColors({ level: 3 }).rgb(255, 136, 0)("x"), "\u001b[38;2;255;136;0mx\u001b[39m");
  assert.equal(createColors({ level: 3 }).hex("#f80")("x"), createColors({ level: 3 }).hex("ff8800")("x"));
  assert.equal(createColors({ level: 2 }).rgb(255, 0, 0)("x"), "\u001b[38;5;196mx\u001b[39m");
  assert.match(createColors({ level: 1 }).rgb(255, 0, 0)("x"), /^\u001b\[(31|91)mx\u001b\[39m$/);
  assert.throws(() => createColors({ level: 3 }).rgb(256, 0, 0), RangeError);
  assert.throws(() => createColors({ level: 3 }).hex("red"), TypeError);
});

test("links use the terminal hyperlink sequence, or fall back to plain text", () => {
  assert.equal(createColors({ level: 1 }).link("https://example.com", "site"), "\u001b]8;;https://example.com\u001b\\site\u001b]8;;\u001b\\");
  assert.equal(createColors({ level: 0 }).link("https://example.com", "site"), "site (https://example.com)");
  assert.equal(createColors({ level: 0 }).link("https://example.com"), "https://example.com");
  assert.equal(strip(createColors({ level: 1 }).link("https://example.com", "site")), "site");
});

test("strip removes colors, cursor moves and links", () => {
  assert.equal(strip("\u001b[1;31mred\u001b[0m \u001b[2K\u001b[1Aup \u001b]0;title\u0007end"), "red up end");
  assert.equal(strip("plain"), "plain");
  assert.equal(strip(5), "5");
});

test("width counts what is seen", () => {
  assert.equal(width("hello"), 5);
  assert.equal(width("\u001b[31mred\u001b[39m"), 3);
  assert.equal(width("日本語"), 6);
  assert.equal(width("😀"), 2);
  assert.equal(width("👨‍👩‍👧‍👦"), 2);
  assert.equal(width("é"), 1);
  assert.equal(width("é"), 1);
  assert.equal(width(""), 0);
  assert.equal(width("a\tb"), 2); // control characters take no room
});

test("pad and truncate work on visible width and keep colors working", () => {
  assert.equal(pad("ab", 5), "ab   ");
  assert.equal(pad("ab", 5, "right"), "   ab");
  assert.equal(pad("ab", 5, "center"), " ab  ");
  assert.equal(pad("toolong", 3), "toolong");
  assert.equal(pad("日本", 6), "日本  ");
  assert.equal(width(pad("\u001b[31mab\u001b[39m", 5)), 5);
  assert.equal(truncate("hello world", 8), "hello w…");
  assert.equal(truncate("short", 8), "short");
  assert.equal(truncate("日本語です", 5), "日本…");
  assert.equal(truncate("hello world", 8, { ellipsis: "..." }), "hello...");
  const cut = truncate("\u001b[31mhello world\u001b[39m", 6);
  assert.equal(strip(cut), "hello…");
  assert.ok(cut.includes("\u001b[0m"), "an open style must be closed at the cut");
  assert.throws(() => truncate("x", -1), RangeError);
});

test("tables line up with colors, wide letters and uneven rows", () => {
  const c = createColors({ level: 1 });
  const out = table([["Kaj", c.green("ok"), "日本"], ["Piet", "fail"], []], { header: ["Name", "State", "Note"], align: ["left", "right"] });
  const lines = out.split("\n").map(strip);
  assert.equal(lines[0], "Name  State  Note");
  assert.equal(lines[1], "────  ─────  ────");
  assert.equal(lines[2], "Kaj      ok  日本");
  assert.equal(lines[3], "Piet   fail");
  assert.equal(lines.length, 5);
});

test("bordered tables", () => {
  const out = table([["a", "bb"], ["ccc", "d"]], { header: ["x", "y"], border: "rounded" });
  assert.equal(out, ["╭─────┬────╮", "│ x   │ y  │", "├─────┼────┤", "│ a   │ bb │", "│ ccc │ d  │", "╰─────┴────╯"].join("\n"));
  const simple = table([["a"]], { border: "simple" });
  assert.equal(simple, "+---+\n| a |\n+---+");
  assert.throws(() => table([], { border: "double" }), RangeError);
  assert.throws(() => table("x"), TypeError);
  assert.equal(table([]), "");
});

test("maxWidth narrows the widest columns", () => {
  const out = table([["a".repeat(30), "b"], ["c", "d".repeat(10)]], { maxWidth: 20 });
  for (const line of out.split("\n")) assert.ok(width(line) <= 20, line);
  assert.match(out, /…/);
});

test("progress bar, symbols, spinner, cursor", () => {
  assert.equal(progressBar(0.4), "████████░░░░░░░░░░░░ 40%");
  assert.equal(progressBar(0, { width: 4, showPercent: false }), "░░░░");
  assert.equal(progressBar(2, { width: 4 }), "████ 100%");
  assert.equal(progressBar(-1, { width: 4 }), "░░░░ 0%");
  assert.equal(progressBar(0.5, { width: 4, filled: "#", empty: "." }), "##.. 50%");
  assert.throws(() => progressBar(NaN), TypeError);
  assert.equal(symbols({ unicode: true }).ok, "✔");
  assert.equal(symbols({ unicode: false }).ok, "√");
  assert.equal(symbols({ unicode: false }).arrow, "->");
  assert.equal(spinnerFrames().length, 10);
  assert.deepEqual(spinnerFrames({ unicode: false }), ["-", "\\", "|", "/"]);
  assert.equal(cursor.up(2), "\u001b[2A");
  assert.equal(cursor.eraseLine, "\u001b[2K\r");
});
