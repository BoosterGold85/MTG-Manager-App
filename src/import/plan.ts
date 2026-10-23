import type {
  CollectionState,
  ImportEntry,
  ImportPlan,
  ImportProblem,
  ParsedImport,
  CollectionItem,
} from "../models/collection";
import { emptyCollection } from "../models/collection";
import { identifierKey, sourceKey } from "./csv";
import { printingConflict } from "./scryfall";
import type { ResolvedImport } from "./scryfall";
export const inventoryKey = (
  item: Pick<
    CollectionItem,
    | "setCode"
    | "collectorNumber"
    | "finish"
    | "language"
    | "condition"
    | "binderName"
    | "binderType"
  >,
) =>
  JSON.stringify([
    item.setCode.toLowerCase(),
    item.collectorNumber.toLowerCase(),
    item.finish,
    item.language,
    item.condition,
    item.binderType,
    item.binderName,
  ]);
const sortedRows = (rows: Record<string, string>[]) =>
  rows
    .map((raw) =>
      JSON.stringify(
        Object.entries(raw).sort(([a], [b]) => a.localeCompare(b)),
      ),
    )
    .sort();
export function buildImportPlan(
  parsed: ParsedImport,
  resolved: ResolvedImport,
  previous: CollectionState | null,
  filename: string,
  now = new Date().toISOString(),
): ImportPlan {
  const base = previous || emptyCollection();
  const metadata = { ...base.metadata },
    groups = new Map<string, CollectionItem>();
  const problems: ImportProblem[] = [...parsed.problems];
  const matched = new Map<
    string,
    { row: ParsedImport["rows"][number]; aliases: string[] }[]
  >();
  const summary = {
    filename,
    importedAt: now,
    totalRows: parsed.totalRows,
    recognized: 0,
    newRecords: 0,
    updated: 0,
    unchanged: 0,
    duplicates: 0,
    problematic: 0,
    copies: 0,
  };
  for (const row of parsed.rows) {
    const result = resolved.results.get(identifierKey(row));
    const error = result?.card
      ? printingConflict(row, result.card)
      : result?.error || "This row could not be matched. Retry the preview.";
    if (!result?.card || error) {
      problems.push({
        line: row.line,
        name: row.name,
        raw: row.raw,
        sourceKey: row.sourceKey,
        message: error || "Unmatched card.",
      });
      continue;
    }
    const card = result.card;
    const item: CollectionItem = {
      id: "",
      scryfallId: card.scryfallId,
      setCode: card.setCode,
      collectorNumber: card.collectorNumber!,
      finish: row.finish,
      language: row.language,
      condition: row.condition,
      binderName: row.binderName,
      binderType: row.binderType,
      quantityOwned: row.quantity,
      quantityAssigned: 0,
      quantityUnassigned: row.quantity,
      sourceRows: [row.raw],
    };
    item.id = inventoryKey(item);
    const matches = matched.get(item.id) || [];
    matches.push({
      row,
      aliases: [
        row.sourceKey,
        sourceKey(row, `id:${card.scryfallId}`),
        sourceKey(
          row,
          `print:${card.setCode.toLowerCase()}:${card.collectorNumber!.toLowerCase()}`,
        ),
      ],
    });
    matched.set(item.id, matches);
    const group = groups.get(item.id);
    if (group) {
      group.quantityOwned += item.quantityOwned;
      group.quantityUnassigned = group.quantityOwned;
      group.sourceRows.push(row.raw);
      summary.duplicates++;
    } else groups.set(item.id, item);
    metadata[card.scryfallId] = card;
    summary.recognized++;
    summary.copies += row.quantity;
  }
  // Never replace a saved total with only the good half of a problematic group.
  // A broken duplicate quantity must not silently shrink an existing holding.
  const problemKeys = new Set(problems.map((problem) => problem.sourceKey));
  let blockedGroups = 0;
  for (const [id, matches] of matched) {
    if (
      !matches.some((match) =>
        match.aliases.some((key) => problemKeys.has(key)),
      )
    )
      continue;
    const group = groups.get(id)!;
    groups.delete(id);
    blockedGroups++;
    summary.recognized -= matches.length;
    summary.copies -= group.quantityOwned;
    summary.duplicates -= Math.max(0, matches.length - 1);
    for (const { row } of matches)
      problems.push({
        line: row.line,
        name: row.name,
        sourceKey: row.sourceKey,
        raw: row.raw,
        message:
          "Another row for this printing/variant is problematic. Its saved total was kept unchanged; correct the whole group before re-importing.",
      });
  }
  const warnings = [...parsed.warnings];
  if (blockedGroups)
    warnings.push(
      `${blockedGroups} printing/variant group(s) left unchanged to avoid saving an incomplete quantity.`,
    );
  const items = new Map(base.items.map((item) => [item.id, item]));
  const entries: ImportEntry[] = [];
  for (const item of groups.values()) {
    const old = items.get(item.id);
    item.quantityAssigned = old?.quantityAssigned || 0;
    if (
      item.quantityOwned < item.quantityAssigned ||
      !Number.isSafeInteger(item.quantityOwned)
    )
      throw new Error(
        "An imported quantity is invalid or below an assigned quantity. No changes were saved.",
      );
    item.quantityUnassigned = item.quantityOwned - item.quantityAssigned;
    const status = !old
      ? "new"
      : old.quantityOwned !== item.quantityOwned ||
          JSON.stringify(sortedRows(old.sourceRows)) !==
            JSON.stringify(sortedRows(item.sourceRows))
        ? "updated"
        : "unchanged";
    if (status === "new") summary.newRecords++;
    else if (status === "updated") summary.updated++;
    else summary.unchanged++;
    entries.push({
      item,
      name: metadata[item.scryfallId].name,
      status,
      previousQuantity: old?.quantityOwned,
    });
    items.set(item.id, status === "unchanged" ? old! : item);
  }
  const sourceKeys = new Set([
    ...parsed.rows.map((r) => r.sourceKey),
    ...parsed.problems.map((p) => p.sourceKey),
  ]);
  const unresolved = [
    ...base.unresolved.filter((p) => !sourceKeys.has(p.sourceKey)),
    ...problems,
  ];
  summary.problematic = problems.length;
  return {
    baseRevision: base.revision,
    entries,
    problems,
    warnings,
    summary,
    next: {
      schemaVersion: 1,
      revision: base.revision + 1,
      items: [...items.values()],
      metadata,
      nameMatches: { ...base.nameMatches, ...resolved.nameMatches },
      unresolved,
      lastImport: summary,
    },
  };
}
