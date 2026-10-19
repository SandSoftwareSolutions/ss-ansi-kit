# @sandsoftwaresolutions/ansi-kit

[![CI](https://github.com/SandSoftwareSolutions/ss-ansi-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/SandSoftwareSolutions/ss-ansi-kit/actions/workflows/ci.yml)

Colors, tables, progress bars and symbols for command line programs that behave well: colors switch off in pipes and with `NO_COLOR`, tables line up even with colors, Chinese letters and emoji, and long text is cut without breaking colors. No dependencies.

## Install

```bash
npm install @sandsoftwaresolutions/ansi-kit
```

## Usage

```js
import { createColors, table, progressBar, symbols, truncate, width, strip } from "@sandsoftwaresolutions/ansi-kit";

const c = createColors();                       // colors on in a terminal, off in a pipe or with NO_COLOR
const s = symbols();

console.log(`${s.ok} ${c.green("built")} in ${c.bold("1.2s")}`);
console.log(c.red(`error: ${c.bold("config.json")} is missing`));   // nested styles work

console.log(table(
  [["Kaj", c.green("ok"), 3], ["Piet", c.red("fail"), 12]],
  { header: ["Name", "State", "Items"], border: "rounded", align: ["left", "left", "right"] }
));
// ╭──────┬───────┬───────╮
// │ Name │ State │ Items │
// ├──────┼───────┼───────┤
// │ Kaj  │ ok    │     3 │
// │ Piet │ fail  │    12 │
// ╰──────┴───────┴───────╯

console.log(progressBar(0.62));                 // ████████████░░░░░░░░ 62%
console.log(truncate(longLine, process.stdout.columns - 1));
```

## Good behaviour built in

- **Colors follow the rules:** `NO_COLOR` turns them off, `FORCE_COLOR=1|2|3` forces them, `TERM=dumb` and pipes get none, and `COLORTERM=truecolor` unlocks `c.hex("#ff8800")` (reduced to 256 or 16 colors on simpler terminals). `createColors({ level: 0 })` is plain text, handy in tests.
- **Styles nest:** a colored word inside a colored sentence does not end the sentence's color early.
- **Width counts what you see:** `width()` ignores color codes, counts CJK letters and emoji as two columns and accents as none. `pad`, `truncate` and `table` use it, so columns line up. `truncate` closes any style that is open at the cut.
- **Tables:** `border: "none" | "simple" | "rounded"`, per-column `align`, and `maxWidth` to narrow the widest columns with an ellipsis. Cells with line breaks are flattened.
- **Symbols** (`ok`, `fail`, `warn`, `info`, `arrow`...) fall back to ASCII on old Windows consoles; `spinnerFrames()` and `cursor` help with live output.
- `strip(text)` removes colors, cursor moves and links, for log files and for comparing output in tests.
- `c.link(url, text)` makes a clickable link in terminals that support it and `text (url)` elsewhere. It throws if the URL contains a control character, because that could close the link early and let the rest be read as terminal commands. Text you print that comes from users can still contain escape sequences: run it through `strip()` first.
- `width()` counts emoji (and anything followed by U+FE0F) as two columns and `©`, `✔`, `★`, `❤` as one, which is how terminals draw them; zero-width characters count as none. Tabs in table cells become spaces. `FORCE_COLOR=false` means no colors. `truncate` also closes an open hyperlink and never returns more than `columns` wide, even when the ellipsis does not fit.
