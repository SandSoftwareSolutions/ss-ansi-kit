export type Style = (text: unknown) => string;

export interface Colors {
  readonly level: 0 | 1 | 2 | 3;
  readonly enabled: boolean;
  bold: Style; dim: Style; italic: Style; underline: Style; inverse: Style; strikethrough: Style;
  black: Style; red: Style; green: Style; yellow: Style; blue: Style; magenta: Style; cyan: Style; white: Style; gray: Style;
  brightRed: Style; brightGreen: Style; brightYellow: Style; brightBlue: Style; brightMagenta: Style; brightCyan: Style;
  bgRed: Style; bgGreen: Style; bgYellow: Style; bgBlue: Style; bgMagenta: Style; bgCyan: Style; bgWhite: Style; bgGray: Style;
  rgb(r: number, g: number, b: number): Style;
  hex(color: string): Style;
  link(url: string, text?: string): string;
}

export function colorLevel(stream?: { isTTY?: boolean }, env?: Record<string, string | undefined>): 0 | 1 | 2 | 3;
export function createColors(options?: { level?: 0 | 1 | 2 | 3 }): Colors;
export function strip(text: unknown): string;
export function width(text: unknown): number;
export function pad(text: string, columns: number, align?: "left" | "right" | "center"): string;
export function truncate(text: string, columns: number, options?: { ellipsis?: string }): string;

export interface TableOptions {
  header?: readonly unknown[];
  align?: readonly ("left" | "right" | "center")[];
  border?: "none" | "simple" | "rounded";
  maxWidth?: number;
  padding?: number;
  gap?: number;
}
export function table(rows: readonly (readonly unknown[])[], options?: TableOptions): string;
export function progressBar(fraction: number, options?: { width?: number; filled?: string; empty?: string; showPercent?: boolean }): string;
export function symbols(options?: { unicode?: boolean }): { ok: string; fail: string; warn: string; info: string; bullet: string; arrow: string; ellipsis: string; line: string };
export function spinnerFrames(options?: { unicode?: boolean }): string[];
export const cursor: { up(n?: number): string; down(n?: number): string; toColumn(n?: number): string; eraseLine: string; hide: string; show: string };
