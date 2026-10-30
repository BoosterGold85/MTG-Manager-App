/** Offline adapter for public deck snapshots, not a production collection/deck importer. */
export interface CapturedDeckRow {
  name: string;
  quantity: number;
  commander: boolean;
  sourceRowIds: (string | number)[];
}
interface PublicDeck {
  cards: {
    id?: string | number;
    quantity: number;
    categories?: string[];
    card?: { oracleCard?: { name?: string } };
  }[];
  categories?: { name: string; includedInDeck?: boolean }[];
}
const nameKey = (name: string) =>
  name
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .normalize("NFKC")
    .trim()
    .toLowerCase();
export function parsePublicDeck(raw: unknown, expectedCommander: string) {
  if (
    !raw ||
    typeof raw !== "object" ||
    !Array.isArray((raw as PublicDeck).cards)
  )
    throw new Error("Public export has no cards array");
  const deck = raw as PublicDeck;
  const included = new Map(
    (deck.categories || [])
      .filter((c) => typeof c.includedInDeck === "boolean")
      .map((c) => [nameKey(c.name), c.includedInDeck!]),
  );
  const excluded = /^(?:sideboard|maybeboard|considering|tokens)$/;
  const isExcluded = (category: string) =>
    included.get(category) === false ||
    (!included.has(category) && excluded.test(category));
  const rows: CapturedDeckRow[] = [];
  for (const row of deck.cards) {
    if (!Number.isInteger(row.quantity) || row.quantity <= 0)
      throw new Error("Invalid card quantity");
    const categories = (row.categories || []).map(nameKey);
    const markedCommander = categories.includes("commander");
    const yes =
      markedCommander || categories.some((c) => included.get(c) === true);
    const no = categories.length > 0 && categories.every((c) => isExcluded(c));
    if (!yes && !no)
      throw new Error(
        "Unknown board/category; verify this export before evaluation",
      );
    if (categories.some((c) => isExcluded(c))) continue;
    if (no && !yes) continue;
    const name = row.card?.oracleCard?.name;
    if (typeof name !== "string" || !name.trim())
      throw new Error("Card row is missing its Oracle name");
    if (markedCommander && nameKey(name) !== nameKey(expectedCommander))
      throw new Error(
        "Export commander differs from preregistered expectation or needs multiple commanders",
      );
    rows.push({
      name,
      quantity: row.quantity,
      commander: markedCommander,
      sourceRowIds: row.id === undefined ? [] : [row.id],
    });
  }
  if (
    rows.filter((r) => r.commander).length !== 1 ||
    rows.find((r) => r.commander)!.quantity !== 1
  )
    throw new Error(
      "Exactly one explicit commander is required for this holdout",
    );
  const total = rows.reduce((n, r) => n + r.quantity, 0);
  if (total !== 100)
    throw new Error(
      `Expected 100 main-deck cards including commander; got ${total}`,
    );
  return { commander: rows.find((r) => r.commander)!.name, total, rows };
}
