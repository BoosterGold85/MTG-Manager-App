import type { DeckImportIssue } from "../models/deck";
export const MAX_DECK_TEXT_BYTES = 1024 * 1024;
export const MAX_DECK_LINES = 5000;
export type DeckSection = "commander" | "main";
export interface DeckTextLine {
  line: number;
  text: string;
  quantity: number;
  name: string;
  setCode?: string;
  collectorNumber?: string;
  section: DeckSection;
  // True when the section heading or an inline marker explicitly names this as a commander.
  explicitCommander: boolean;
}
export interface ParsedDeckText {
  name?: string;
  lines: DeckTextLine[];
  issues: DeckImportIssue[];
  // Whether any explicit commander section/marker was present in the export.
  hasCommanderSection: boolean;
}
type Heading = DeckSection | "sideboard" | "maybeboard" | "companion" | "tokens" | "about";
const headings: [RegExp, Heading][] = [
  [/^(commanders?|command zone|commander zone)$/, "commander"],
  [/^(deck|main|main ?board|main deck|library|mainboard)$/, "main"],
  [/^(side ?board|side)$/, "sideboard"],
  [/^(maybe ?board|maybe|considering|wishlist)$/, "maybeboard"],
  [/^companions?$/, "companion"],
  [/^tokens?$/, "tokens"],
  [/^about$/, "about"],
];
// Category groupings used by grouped text exports; they never change the board.
const categories =
  /^(creatures?|lands?|artifacts?|enchantments?|instants?|sorcer(y|ies)|planeswalkers?|battles?|spells?|other|ramp|removal|draw|card draw|interaction|nonbasic lands?|basic lands?|legendary)$/;
function headingOf(text: string): Heading | "category" | null {
  const cleaned = text
    .replace(/^(\/\/+|#+|=+|-+)\s*/, "")
    .replace(/\s*(=+|-+)$/, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s*:\s*$/, "")
    .replace(/\s+\d+$/, "")
    .trim()
    .toLowerCase();
  for (const [pattern, heading] of headings)
    if (pattern.test(cleaned)) return heading;
  if (categories.test(cleaned)) return "category";
  return null;
}
// Normalizes double-faced/split separators: "Fire / Ice", "Fire///Ice" → "Fire // Ice".
export const normalizeDeckName = (name: string) =>
  name
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/\s*\/{1,3}\s*/g, " // ")
    .replace(/\s+/g, " ")
    .trim();
export function parseDeckText(text: string): ParsedDeckText {
  if (new Blob([text]).size > MAX_DECK_TEXT_BYTES)
    throw new Error("This deck file is too large. Choose a ManaBox deck export.");
  const raw = text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/);
  if (raw.length > MAX_DECK_LINES)
    throw new Error(
      `This deck file has more than ${MAX_DECK_LINES.toLocaleString()} lines. Choose a single deck export.`,
    );
  if (raw.some((l) => l.includes("\u0000")))
    throw new Error("This file is not a text decklist. Choose a ManaBox deck export.");
  const result: ParsedDeckText = { lines: [], issues: [], hasCommanderSection: false };
  let section: Heading = "main";
  raw.forEach((original, index) => {
    const line = index + 1;
    const text = original.trim();
    if (!text) return;
    let body = text;
    let lineSection = section;
    const sideboardPrefix = /^SB:\s*/i.exec(body);
    if (sideboardPrefix) {
      lineSection = "sideboard";
      body = body.slice(sideboardPrefix[0].length);
    }
    const quantity = /^(\d+)\s*[xX]?\s+(.+)$/.exec(body);
    if (!quantity) {
      const heading = headingOf(body);
      if (heading && heading !== "category") {
        section = heading;
        if (heading === "commander") result.hasCommanderSection = true;
        return;
      }
      if (heading === "category" || /^\/\//.test(body)) return;
      if (section === "about") {
        const name = /^name\s+(.+)$/i.exec(body);
        if (name) result.name = name[1].trim();
        return;
      }
      result.issues.push({
        line,
        text,
        reason: /^[-+]?\d/.test(body)
          ? "Malformed quantity. Use a whole number before the card name, e.g. “1 Sol Ring”."
          : "Missing quantity or unrecognized heading. Add a quantity, e.g. “1 Sol Ring”.",
      });
      return;
    }
    const count = Number(quantity[1]);
    if (!Number.isSafeInteger(count) || count < 1 || count > 999) {
      result.issues.push({
        line,
        text,
        reason: "Malformed quantity. Use a whole number from 1 to 999.",
      });
      return;
    }
    if (lineSection === "sideboard" || lineSection === "maybeboard" || lineSection === "companion" || lineSection === "tokens") {
      result.issues.push({
        line,
        text,
        reason: `${lineSection[0].toUpperCase()}${lineSection.slice(1)} row retained but not imported. v0.4.1 imports the Commander and main deck only.`,
      });
      return;
    }
    let rest = quantity[2];
    let marker = false;
    // Inline markers from common exporters: *CMDR*, *F*, [Commander{top}], ^Tag^, #!Commander.
    rest = rest.replace(/\s+\*([A-Za-z]+)\*/g, (_, m: string) => {
      if (/^cmdr$/i.test(m)) marker = true;
      return "";
    });
    rest = rest.replace(/\s+\[([^\]]*)\]/g, (_, m: string) => {
      if (/^commander\b/i.test(m)) marker = true;
      return "";
    });
    rest = rest.replace(/\s+\^[^^]*\^/g, "");
    rest = rest.replace(/\s+#!?([A-Za-z][^#]*)/g, (_, m: string) => {
      if (/^commander\b/i.test(m.trim())) marker = true;
      return "";
    });
    const printing = /^(.*?)\s+\(([A-Za-z0-9]{2,8})\)(?:\s+(\S+))?\s*$/.exec(rest);
    const name = normalizeDeckName(printing ? printing[1] : rest);
    if (!name || /^\(/.test(name)) {
      result.issues.push({ line, text, reason: "Card name is missing." });
      return;
    }
    if (marker) result.hasCommanderSection = true;
    result.lines.push({
      line,
      text,
      quantity: count,
      name,
      ...(printing
        ? {
            setCode: printing[2].toLowerCase(),
            ...(printing[3] ? { collectorNumber: printing[3].toLowerCase() } : {}),
          }
        : {}),
      section: marker ? "commander" : lineSection === "commander" ? "commander" : "main",
      explicitCommander: marker || lineSection === "commander",
    });
  });
  if (!result.lines.length && !result.issues.length)
    throw new Error("This decklist is empty. Choose a ManaBox deck export or paste card lines.");
  return result;
}
