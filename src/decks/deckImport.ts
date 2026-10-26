import type { CardMetadata, CollectionItem, CollectionState } from "../models/collection";
import type { Deck, DeckCardAssignment, DeckCommander, DecklistEntry, DeckImportIssue } from "../models/deck";
import type { Color } from "../models/card";
import type { DeckCardLookup, DeckIdentifier } from "../import/scryfall";
import { normalizedName } from "../import/csv";
import { cardIdentity } from "../intelligence/tagger";
import type { DeckSection, DeckTextLine, ParsedDeckText } from "./deckText";
import { commanderEligible, deckUsage, isBasicLand, sameCard } from "./decks";

export interface ResolvedDeckLine {
  line: DeckTextLine;
  card?: CardMetadata;
  // The exact requested printing, when set + collector number resolved to this card.
  printing?: CardMetadata;
  note?: string;
  error?: string;
}
const faceNames = (card: CardMetadata) => [
  card.name,
  card.name.split(" // ")[0],
  ...(card.cardFaces?.map((f) => f.name) || []),
  ...(card.aliases || []),
];
export const namesCard = (card: CardMetadata, name: string) =>
  faceNames(card).some((n) => normalizedName(n) === normalizedName(name));
const printKey = (set: string, number: string) => `${set.toLowerCase()}:${number.toLowerCase()}`;
const printLabel = (line: DeckTextLine) =>
  `${line.setCode!.toUpperCase()}${line.collectorNumber ? ` #${line.collectorNumber}` : ""}`;

// Offline first: saved/bundled canonical metadata, then Scryfall printings, then exact names.
export async function resolveDeckLines(
  parsed: ParsedDeckText,
  known: Record<string, CardMetadata>,
  lookup: DeckCardLookup,
  signal: AbortSignal,
  progress: (message: string) => void = () => {},
): Promise<ResolvedDeckLine[]> {
  const prints = new Map<string, CardMetadata>();
  const byName = new Map<string, CardMetadata[]>();
  for (const card of Object.values(known)) {
    if (card.collectorNumber) {
      const key = printKey(card.setCode, card.collectorNumber);
      const english = !card.printedLanguage || card.printedLanguage === "en";
      if (english || !prints.has(key)) prints.set(key, card);
    }
    for (const n of new Set(faceNames(card).map(normalizedName))) {
      const list = byName.get(n) || [];
      if (!list.some((c) => sameCard(c, card))) list.push(card);
      byName.set(n, list);
    }
  }
  const printFor = new Map<number, CardMetadata | null>();
  const remotePrints: DeckIdentifier[] = [];
  for (const line of parsed.lines)
    if (line.setCode && line.collectorNumber) {
      const card = prints.get(printKey(line.setCode, line.collectorNumber));
      if (card) printFor.set(line.line, card);
      else remotePrints.push({ key: `print:${printKey(line.setCode, line.collectorNumber)}`, set: line.setCode, collector_number: line.collectorNumber });
    }
  if (remotePrints.length) {
    const found = await lookup.lookupDeckCards(remotePrints, signal, progress);
    for (const line of parsed.lines)
      if (line.setCode && line.collectorNumber && !printFor.has(line.line))
        printFor.set(line.line, found.get(`print:${printKey(line.setCode, line.collectorNumber)}`) || null);
  }
  const results: ResolvedDeckLine[] = [];
  const remoteNames: DeckIdentifier[] = [];
  for (const line of parsed.lines) {
    const printing = printFor.get(line.line);
    if (printing && namesCard(printing, line.name)) {
      results.push({ line, card: printing, printing });
      continue;
    }
    const note = line.collectorNumber
      ? printing
        ? `Requested printing ${printLabel(line)} is ${printing.name}, not ${line.name}. Matched by card name instead.`
        : `Requested printing ${printLabel(line)} was not found. Matched by card name instead.`
      : undefined;
    const local = byName.get(normalizedName(line.name)) || [];
    if (local.length > 1)
      results.push({ line, note, error: `Ambiguous name: matches ${local.map((c) => c.name).join(", ")}. Add a set code and collector number.` });
    else if (local.length === 1) results.push({ line, card: local[0], note });
    else {
      results.push({ line, note });
      remoteNames.push({ key: `name:${normalizedName(line.name)}`, name: line.name });
    }
  }
  if (remoteNames.length) {
    const found = await lookup.lookupDeckCards(remoteNames, signal, progress);
    for (const result of results)
      if (!result.card && !result.error) {
        const card = found.get(`name:${normalizedName(result.line.name)}`);
        if (card) result.card = card;
        else
          result.error = result.line.collectorNumber
            ? `Card not recognized. Printing ${printLabel(result.line)} and the name “${result.line.name}” were not found.`
            : `Card not recognized. No card named “${result.line.name}” was found.`;
      }
  }
  return results;
}

// "basic": a Basic-supertype land. Never allocated, never missing, never blocking.
export type OwnershipStatus = "exact" | "alternate" | "allocated" | "missing" | "ambiguous" | "basic";
export interface CopyOption {
  itemId: string;
  setCode: string;
  collectorNumber: string;
  finish: string;
  language: string;
  condition: string;
  owned: number;
  available: number;
  exact: boolean;
}
export interface PreviewEntry {
  key: string;
  name: string;
  card: CardMetadata;
  quantity: number;
  section: DeckSection;
  explicitCommander: boolean;
  lines: number[];
  texts: string[];
  requested?: { setCode: string; collectorNumber?: string };
  notes: string[];
  status: OwnershipStatus;
  owned: number;
  available: number;
  options: CopyOption[];
  usedBy: { deckId: string; deckName: string; quantity: number }[];
  suggested: Record<string, number>;
  eligible: boolean;
}
export interface DeckImportPreview {
  name: string;
  filename?: string;
  entries: PreviewEntry[];
  issues: DeckImportIssue[];
  hasCommanderSection: boolean;
  defaultCommanders: string[];
  candidates: string[];
  warnings: string[];
  metadata: Record<string, CardMetadata>;
}
export interface DeckImportChoices {
  name: string;
  commanders: string[];
  picks: Record<string, Record<string, number>>;
  reviewed: string[];
  allowDuplicateName: boolean;
}

const isExact = (item: CollectionItem, requested?: { setCode: string; collectorNumber?: string }) =>
  !!requested &&
  item.setCode.toLowerCase() === requested.setCode &&
  (!requested.collectorNumber || item.collectorNumber.toLowerCase() === requested.collectorNumber);

export function buildDeckImportPreview(
  parsed: ParsedDeckText,
  resolved: ResolvedDeckLine[],
  state: CollectionState,
  options: { filename?: string; name?: string } = {},
): DeckImportPreview {
  const issues: DeckImportIssue[] = [...parsed.issues];
  const groups = new Map<string, PreviewEntry>();
  const metadata: Record<string, CardMetadata> = {};
  for (const r of resolved) {
    if (!r.card) {
      issues.push({ line: r.line.line, text: r.line.text, reason: r.error || "Card not recognized." });
      continue;
    }
    const card = r.printing || r.card;
    const requested = r.line.setCode
      ? { setCode: r.line.setCode, ...(r.line.collectorNumber ? { collectorNumber: r.line.collectorNumber } : {}) }
      : undefined;
    const key = JSON.stringify([r.line.section, cardIdentity(r.card), requested?.setCode || "", requested?.collectorNumber || ""]);
    const existing = groups.get(key);
    if (!state.metadata[card.scryfallId]) metadata[card.scryfallId] = card;
    if (existing) {
      existing.quantity += r.line.quantity;
      existing.lines.push(r.line.line);
      existing.texts.push(r.line.text);
      if (r.note) existing.notes.push(r.note);
      continue;
    }
    groups.set(key, {
      key: `e${groups.size + 1}`,
      name: r.card.name,
      card,
      quantity: r.line.quantity,
      section: r.line.section,
      explicitCommander: r.line.explicitCommander,
      lines: [r.line.line],
      texts: [r.line.text],
      requested,
      notes: r.note ? [r.note] : [],
      status: "missing",
      owned: 0,
      available: 0,
      options: [],
      usedBy: [],
      suggested: {},
      eligible: commanderEligible({ ...card, id: card.scryfallId, quantity: 1 }),
    });
  }
  // Commanders reserve copies first; each later entry sees only what remains. No copy is taken from a deck.
  const entries = [...groups.values()].sort((a, b) => Number(b.section === "commander") - Number(a.section === "commander"));
  const pool = new Map(state.items.map((i) => [i.id, i.quantityUnassigned]));
  for (const entry of entries) {
    const items = state.items.filter((i) => i.quantityOwned > 0 && state.metadata[i.scryfallId] && sameCard(state.metadata[i.scryfallId], entry.card));
    entry.owned = items.reduce((n, i) => n + i.quantityOwned, 0);
    entry.available = items.reduce((n, i) => n + i.quantityUnassigned, 0);
    entry.options = items.map((i) => ({
      itemId: i.id,
      setCode: i.setCode,
      collectorNumber: i.collectorNumber,
      finish: i.finish,
      language: i.language,
      condition: i.condition,
      owned: i.quantityOwned,
      available: i.quantityUnassigned,
      exact: isExact(i, entry.requested),
    }));
    const usage = new Map<string, { deckId: string; deckName: string; quantity: number }>();
    for (const item of items)
      for (const u of deckUsage(state, item.id)) {
        const current = usage.get(u.deck.id) || { deckId: u.deck.id, deckName: u.deck.name, quantity: 0 };
        current.quantity += u.quantity;
        usage.set(u.deck.id, current);
      }
    entry.usedBy = [...usage.values()];
    // Basic lands keep their card and requested printing but skip quantity/allocation checks entirely.
    if (isBasicLand(entry.card)) {
      entry.status = "basic";
      continue;
    }
    let need = entry.quantity;
    let exactTaken = 0;
    for (const item of items.filter((i) => isExact(i, entry.requested))) {
      const take = Math.min(need, pool.get(item.id) || 0);
      if (take) {
        entry.suggested[item.id] = take;
        pool.set(item.id, pool.get(item.id)! - take);
        need -= take;
        exactTaken += take;
      }
    }
    const others = items.filter((i) => !isExact(i, entry.requested) && (pool.get(i.id) || 0) > 0);
    if (need > 0 && others.length === 1) {
      const take = Math.min(need, pool.get(others[0].id)!);
      entry.suggested[others[0].id] = take;
      pool.set(others[0].id, pool.get(others[0].id)! - take);
      need -= take;
      entry.status = entry.requested ? "alternate" : "exact";
    } else if (need > 0 && others.length > 1) entry.status = "ambiguous";
    else if (exactTaken) entry.status = "exact";
    else entry.status = items.length ? "allocated" : "missing";
  }
  const explicit = entries.filter((e) => e.explicitCommander);
  const warnings: string[] = [];
  let defaultCommanders: string[] = [];
  if (explicit.length) {
    const valid = explicit.filter((e) => e.eligible && e.quantity === 1);
    if (valid.length !== explicit.length)
      warnings.push("The export's Commander section includes a card that canonical metadata does not allow as a commander. Select the commander to continue.");
    else if (explicit.length > 2)
      warnings.push(`The export names ${explicit.length} commanders. MTG Manager can represent at most two (Partner/Background). Nothing was imported; choose up to two.`);
    else defaultCommanders = explicit.map((e) => e.key);
  }
  if (!parsed.lines.length && !issues.length) warnings.push("No card lines were found.");
  return {
    name: (options.name || parsed.name || options.filename?.replace(/\.[^.]+$/, "") || "Imported deck").trim(),
    filename: options.filename,
    entries,
    issues: issues.sort((a, b) => a.line - b.line),
    hasCommanderSection: parsed.hasCommanderSection,
    defaultCommanders,
    candidates: entries.filter((e) => e.eligible && e.quantity === 1).map((e) => e.key),
    warnings,
    metadata,
  };
}

export const initialChoices = (preview: DeckImportPreview): DeckImportChoices => ({
  name: preview.name,
  commanders: [...preview.defaultCommanders],
  picks: Object.fromEntries(preview.entries.map((e) => [e.key, { ...e.suggested }])),
  reviewed: preview.entries.filter((e) => e.status !== "ambiguous").map((e) => e.key),
  allowDuplicateName: false,
});

export const commanderIdentity = (preview: DeckImportPreview, choices: DeckImportChoices): Color[] => [
  ...new Set(preview.entries.filter((e) => choices.commanders.includes(e.key)).flatMap((e) => e.card.colorIdentity)),
];
export function colorConflicts(preview: DeckImportPreview, choices: DeckImportChoices) {
  if (!choices.commanders.length) return [];
  const identity = commanderIdentity(preview, choices);
  return preview.entries.filter((e) => !choices.commanders.includes(e.key) && !e.card.colorIdentity.every((c) => identity.includes(c)));
}
export const picked = (picks: Record<string, number> = {}) => Object.values(picks).reduce((n, q) => n + q, 0);
// Copies the other entries in this preview have already claimed from each printing group.
export function claimed(choices: DeckImportChoices, exceptKey?: string) {
  const totals = new Map<string, number>();
  for (const [key, picks] of Object.entries(choices.picks))
    if (key !== exceptKey) for (const [itemId, q] of Object.entries(picks)) totals.set(itemId, (totals.get(itemId) || 0) + q);
  return totals;
}
export const duplicateName = (state: CollectionState, name: string) =>
  (state.decks || []).some((d) => normalizedName(d.name) === normalizedName(name));

export function deckImportSummary(preview: DeckImportPreview, choices: DeckImportChoices) {
  const conflicts = new Set(colorConflicts(preview, choices).map((e) => e.key));
  const summary = { total: 0, exact: 0, alternate: 0, allocated: 0, missing: 0, review: 0, basic: 0, colorConflicts: conflicts.size, problems: preview.issues.length };
  for (const entry of preview.entries) {
    summary.total += entry.quantity;
    if (entry.status === "basic") {
      summary.basic += entry.quantity;
      continue;
    }
    if (!choices.reviewed.includes(entry.key)) {
      summary.review += entry.quantity;
      continue;
    }
    const picks = conflicts.has(entry.key) ? {} : choices.picks[entry.key] || {};
    let assigned = 0;
    for (const [itemId, q] of Object.entries(picks)) {
      const option = entry.options.find((o) => o.itemId === itemId);
      if (option?.exact || !entry.requested) summary.exact += q;
      else summary.alternate += q;
      assigned += q;
    }
    const rest = entry.quantity - assigned;
    if (entry.owned) summary.allocated += rest;
    else summary.missing += rest;
  }
  return summary;
}

export function blockingIssues(preview: DeckImportPreview, state: CollectionState, choices: DeckImportChoices) {
  const issues: string[] = [];
  if (!preview.entries.length) issues.push("No recognized cards to import.");
  if (!choices.name.trim()) issues.push("Enter a deck name.");
  if (duplicateName(state, choices.name) && !choices.allowDuplicateName)
    issues.push("A deck with this name already exists. Choose Import as new deck or Cancel. Existing decks are never overwritten.");
  if (!choices.commanders.length) issues.push("Select the commander before importing.");
  if (choices.commanders.length > 2)
    issues.push("More than two commanders cannot be represented. Select one commander, or two for Partner/Background.");
  for (const key of choices.commanders) {
    const entry = preview.entries.find((e) => e.key === key);
    if (!entry || !entry.eligible || entry.quantity !== 1) issues.push(`${entry?.name || "This card"} cannot be selected as a commander.`);
  }
  const unresolved = preview.entries.filter((e) => !choices.reviewed.includes(e.key));
  if (unresolved.length) issues.push(`${unresolved.length} card${unresolved.length === 1 ? "" : "s"} need a printing choice.`);
  const totals = claimed(choices);
  for (const entry of preview.entries) {
    const picks = choices.picks[entry.key] || {};
    if (picked(picks) > (choices.commanders.includes(entry.key) ? 1 : entry.quantity)) issues.push(`${entry.name}: more copies selected than the decklist requests.`);
    for (const [itemId, q] of Object.entries(picks))
      if (!Number.isSafeInteger(q) || q < 0 || !entry.options.some((o) => o.itemId === itemId)) issues.push(`${entry.name}: invalid copy selection.`);
  }
  for (const [itemId, q] of totals) {
    const item = state.items.find((i) => i.id === itemId);
    if (!item || q > item.quantityUnassigned)
      issues.push(`${item ? state.metadata[item.scryfallId].name : "A printing"}: not enough available copies. Copies are never taken from another deck.`);
  }
  return [...new Set(issues)];
}

export function finalizeDeckImport(
  preview: DeckImportPreview,
  state: CollectionState,
  choices: DeckImportChoices,
  id: string = crypto.randomUUID(),
  now = new Date().toISOString(),
): { deck: Deck; metadata: Record<string, CardMetadata> } {
  const blocking = blockingIssues(preview, state, choices);
  if (blocking.length) throw new Error(blocking.join(" "));
  const conflicts = new Set(colorConflicts(preview, choices).map((e) => e.key));
  const entries: DecklistEntry[] = [];
  const commanders: DeckCommander[] = [];
  const assignments: DeckCardAssignment[] = [];
  const ordered = [
    ...choices.commanders.map((k) => preview.entries.find((e) => e.key === k)!),
    ...preview.entries.filter((e) => !choices.commanders.includes(e.key)),
  ];
  for (const [index, p] of ordered.entries()) {
    const isCommander = choices.commanders.includes(p.key);
    const entry: DecklistEntry = {
      id: `${id}:${index + 1}`,
      board: isCommander ? "commander" : "main",
      quantity: p.quantity,
      name: p.card.name,
      cardIdentity: cardIdentity(p.card),
      scryfallId: p.card.scryfallId,
      ...(p.requested ? { requestedPrinting: { ...p.requested } } : {}),
      sourceLines: [...p.lines],
      ...(p.status === "basic" ? { basicLand: true } : {}),
    };
    entries.push(entry);
    // Basic lands are tracked in the decklist only; no physical copy is reserved.
    const picks = Object.entries(conflicts.has(p.key) || p.status === "basic" ? {} : choices.picks[p.key] || {}).filter(([, q]) => q > 0);
    if (isCommander) {
      const item = picks[0] && state.items.find((i) => i.id === picks[0][0]);
      commanders.push({
        ...(item ? { itemId: item.id } : {}),
        entryId: entry.id,
        cardIdentity: entry.cardIdentity,
        scryfallId: item ? item.scryfallId : p.card.scryfallId,
        name: p.card.name,
        colorIdentity: [...p.card.colorIdentity],
      });
    } else for (const [itemId, quantity] of picks) assignments.push({ itemId, quantity, entryId: entry.id });
  }
  const sourceIssues = preview.issues.map((i) => ({ ...i }));
  return {
    deck: {
      id,
      name: choices.name.trim(),
      commanders,
      assignments,
      entries,
      importIssues: sourceIssues,
      source: { kind: "manabox-text", ...(preview.filename ? { filename: preview.filename } : {}), importedAt: now },
      createdAt: now,
      modifiedAt: now,
    },
    metadata: preview.metadata,
  };
}

export const issuesText = (issues: DeckImportIssue[]) =>
  issues.map((i) => `${i.text}\t# line ${i.line}: ${i.reason}`).join("\n");
