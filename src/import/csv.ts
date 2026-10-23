import Papa from "papaparse";
import type {
  Finish,
  ImportProblem,
  ImportRow,
  ParsedImport,
} from "../models/collection";
export const MAX_ROWS = 100_000;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const normalizedName = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
const headerKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const aliases: Record<string, string> = {
  name: "name",
  cardname: "name",
  scryfallid: "scryfallId",
  setcode: "setCode",
  set: "setCode",
  setname: "setName",
  collectornumber: "collectorNumber",
  quantity: "quantity",
  count: "quantity",
  foil: "finish",
  finish: "finish",
  language: "language",
  condition: "condition",
  bindername: "binderName",
  binder: "binderName",
  list: "binderName",
  listname: "binderName",
  bindertype: "binderType",
};
const languages: Record<string, string> = {
  english: "en",
  spanish: "es",
  french: "fr",
  german: "de",
  italian: "it",
  portuguese: "pt",
  japanese: "ja",
  korean: "ko",
  russian: "ru",
  "simplified chinese": "zhs",
  "traditional chinese": "zht",
  chinese: "zhs",
};
const conditions: Record<string, string> = {
  "near mint": "nm",
  near_mint: "nm",
  mint: "mint",
  "lightly played": "lp",
  "moderately played": "mp",
  "heavily played": "hp",
  damaged: "dmg",
  poor: "dmg",
};
const finishes: Record<string, Finish> = {
  "": "nonfoil",
  normal: "nonfoil",
  nonfoil: "nonfoil",
  "non-foil": "nonfoil",
  false: "nonfoil",
  no: "nonfoil",
  "0": "nonfoil",
  foil: "foil",
  true: "foil",
  yes: "foil",
  "1": "foil",
  etched: "etched",
  "etched foil": "etched",
  etchedfoil: "etched",
};
export function identifierKey(
  row: Pick<
    ImportRow,
    "scryfallId" | "setCode" | "collectorNumber" | "name" | "setName"
  >,
) {
  if (row.scryfallId) return `id:${row.scryfallId}`;
  if (row.setCode && row.collectorNumber)
    return `print:${row.setCode}:${row.collectorNumber.toLowerCase()}`;
  return `name:${normalizedName(row.name)}:${row.setCode || normalizedName(row.setName)}:${row.collectorNumber.toLowerCase()}`;
}
export function sourceKey(
  row: Pick<
    ImportRow,
    | "scryfallId"
    | "setCode"
    | "setName"
    | "collectorNumber"
    | "name"
    | "finish"
    | "language"
    | "condition"
    | "binderType"
    | "binderName"
  >,
  identity = identifierKey(row),
) {
  return JSON.stringify([
    identity,
    row.finish,
    row.language,
    row.condition,
    row.binderType,
    row.binderName,
  ]);
}
export function parseManaBox(text: string): ParsedImport {
  if (!text.trim())
    throw new Error("This CSV is empty. Choose a ManaBox collection export.");
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
  });
  const errors = parsed.errors.filter(
    (error) => error.code !== "UndetectableDelimiter",
  );
  if (errors.length) throw new Error(`Malformed CSV: ${errors[0].message}`);
  const [headers, ...values] = parsed.data;
  if (!headers?.length || values.length === 0)
    throw new Error(
      "The CSV has no card rows. Include a header and at least one card.",
    );
  if (values.length > MAX_ROWS)
    throw new Error(
      `Please split exports larger than ${MAX_ROWS.toLocaleString()} rows.`,
    );
  if (new Set(headers.map(headerKey)).size !== headers.length)
    throw new Error(
      "The CSV contains duplicate column headings. Give each column a unique name.",
    );
  const fields = headers.map((h) =>
    Object.hasOwn(aliases, headerKey(h)) ? aliases[headerKey(h)] : "",
  );
  if (
    !fields.some((f) => ["name", "scryfallId"].includes(f)) &&
    !(fields.includes("setCode") && fields.includes("collectorNumber"))
  )
    throw new Error(
      "This does not look like a ManaBox CSV. Include Name, Scryfall ID, or Set code + Collector number.",
    );
  // Ambiguous aliases (e.g. both Foil and Finish) cannot silently overwrite a value.
  const present = fields.filter(Boolean);
  if (new Set(present).size !== present.length)
    throw new Error(
      "Multiple columns describe the same field. Keep one Name, Quantity, Finish/Foil, and Set code column.",
    );
  const rows: ImportRow[] = [],
    problems: ImportProblem[] = [];
  const warnings = fields.includes("quantity")
    ? []
    : ["No Quantity column: each row is treated as one copy."];
  values.forEach((cells, index) => {
    const line = index + 2;
    const raw = Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
    if (cells.length > headers.length) {
      let key = "__extra_fields";
      while (Object.hasOwn(raw, key)) key += "_";
      raw[key] = JSON.stringify(cells.slice(headers.length));
    }
    const field = Object.fromEntries(
      fields
        .filter(Boolean)
        .map((f) => [f, cells[fields.indexOf(f)]?.trim() || ""]),
    );
    const lang = (field.language || "en").toLowerCase();
    const condition = (field.condition || "unspecified")
      .toLowerCase()
      .replace(/\s+/g, " ");
    const finishText = (field.finish || "").toLowerCase();
    const row: ImportRow = {
      line,
      raw,
      sourceKey: "",
      name: field.name || "",
      scryfallId: (field.scryfallId || "").toLowerCase(),
      setCode: (field.setCode || "").toLowerCase(),
      setName: field.setName || "",
      collectorNumber: field.collectorNumber || "",
      quantity: fields.includes("quantity") ? Number(field.quantity) : 1,
      finish: Object.hasOwn(finishes, finishText)
        ? finishes[finishText]
        : "nonfoil",
      language: Object.hasOwn(languages, lang) ? languages[lang] : lang,
      condition: Object.hasOwn(conditions, condition)
        ? conditions[condition]
        : condition,
      binderName: field.binderName || "",
      binderType: field.binderType || "",
    };
    row.sourceKey = sourceKey(row);
    let message = "";
    if (cells.length !== headers.length)
      message = "This row has a different number of fields from the header.";
    else if (fields.includes("quantity") && !/^\d+$/.test(field.quantity))
      message = "Quantity must be a whole number of zero or more.";
    else if (
      !Number.isSafeInteger(row.quantity) ||
      row.quantity < 0 ||
      row.quantity > 1_000_000_000
    )
      message = "Quantity is outside the supported range (0–1,000,000,000).";
    else if (!Object.hasOwn(finishes, finishText))
      message = `Unrecognized finish: ${field.finish}. Use normal, foil or etched.`;
    else if (
      !row.scryfallId &&
      !(row.setCode && row.collectorNumber) &&
      !(row.name && (row.setCode || row.setName))
    )
      message =
        "Provide a Scryfall ID, set code + collector number, or exact card name with a set.";
    if (message)
      problems.push({
        line,
        name: row.name,
        message,
        raw,
        sourceKey: row.sourceKey,
      });
    else rows.push(row);
  });
  return { rows, problems, totalRows: values.length, warnings };
}
