import type { SampleCollectionCard } from "./card";
export interface CollectionSource {
  load: () => Promise<SampleCollectionCard[]>;
}
export type CardMetadata = Omit<
  SampleCollectionCard,
  "id" | "quantity" | "foil" | "tags" | "ownership"
> & { aliases?: string[]; printedLanguage?: string };
export type Finish = "nonfoil" | "foil" | "etched";
export interface CollectionItem {
  id: string;
  scryfallId: string;
  setCode: string;
  collectorNumber: string;
  finish: Finish;
  language: string;
  condition: string;
  binderName: string;
  binderType: string;
  quantityOwned: number;
  quantityAssigned: number;
  quantityUnassigned: number;
  sourceRows: Record<string, string>[];
}
export interface ImportRow {
  line: number;
  name: string;
  scryfallId: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  quantity: number;
  finish: Finish;
  language: string;
  condition: string;
  binderName: string;
  binderType: string;
  raw: Record<string, string>;
  sourceKey: string;
}
export interface ImportProblem {
  line: number;
  name: string;
  message: string;
  raw: Record<string, string>;
  sourceKey: string;
}
export interface ParsedImport {
  rows: ImportRow[];
  problems: ImportProblem[];
  totalRows: number;
  warnings: string[];
}
export interface ImportSummary {
  filename: string;
  importedAt: string;
  totalRows: number;
  recognized: number;
  newRecords: number;
  updated: number;
  unchanged: number;
  duplicates: number;
  problematic: number;
  copies: number;
}
export interface CollectionState {
  schemaVersion: 1;
  revision: number;
  items: CollectionItem[];
  metadata: Record<string, CardMetadata>;
  nameMatches: Record<string, string>;
  unresolved: ImportProblem[];
  lastImport: ImportSummary | null;
}
export interface CollectionRepository {
  load(): Promise<CollectionState | null>;
  save(next: CollectionState, expectedRevision: number): Promise<void>;
}
export interface ImportEntry {
  item: CollectionItem;
  name: string;
  status: "new" | "updated" | "unchanged";
  previousQuantity?: number;
}
export interface ImportPlan {
  baseRevision: number;
  next: CollectionState;
  entries: ImportEntry[];
  problems: ImportProblem[];
  warnings: string[];
  summary: ImportSummary;
}
export const emptyCollection = (): CollectionState => ({
  schemaVersion: 1,
  revision: 0,
  items: [],
  metadata: {},
  nameMatches: {},
  unresolved: [],
  lastImport: null,
});
export function collectionCards(
  state: CollectionState,
): SampleCollectionCard[] {
  return state.items
    .filter((item) => item.quantityOwned > 0)
    .map((item) => {
      const card = state.metadata[item.scryfallId];
      if (!card)
        throw new Error(
          "Saved collection metadata is missing. Your data has not been overwritten.",
        );
      return {
        ...card,
        id: item.id,
        quantity: item.quantityOwned,
        foil: item.finish !== "nonfoil",
        ownership: item,
      };
    });
}
