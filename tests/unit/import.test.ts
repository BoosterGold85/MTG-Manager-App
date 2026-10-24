import { describe, it, expect, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { parseManaBox, identifierKey, MAX_ROWS } from "../../src/import/csv";
import { buildImportPlan } from "../../src/import/plan";
import { ScryfallClient, normalizeCard } from "../../src/import/scryfall";
import type { ResolvedImport } from "../../src/import/scryfall";
import type {
  CardMetadata,
  CollectionState,
} from "../../src/models/collection";
import { collectionCards, emptyCollection } from "../../src/models/collection";
import { IndexedDbCollectionRepository } from "../../src/storage/collectionRepository";
import { filterCards, emptyFilters } from "../../src/utils/filters";
import { sortCards } from "../../src/utils/sorting";
import {
  exportCsv,
  solRow,
  sol,
  forest,
  meren,
  tatyova,
  metadata,
  apiCard,
} from "../importFixtures";
const signal = () => new AbortController().signal;
const quiet = () => {};
async function plan(
  csv: string,
  previous: CollectionState | null = null,
  client = new ScryfallClient(vi.fn(), 0),
  known = metadata,
) {
  const parsed = parseManaBox(csv);
  return buildImportPlan(
    parsed,
    await client.resolve(
      parsed.rows,
      { ...known, ...previous?.metadata },
      previous?.nameMatches || {},
      signal(),
      quiet,
    ),
    previous,
    "ManaBox.csv",
    "2026-01-01T00:00:00Z",
  );
}
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("ManaBox CSV parsing", () => {
  it("accepts a valid export, UTF-8 BOM, CRLF and preserves purchase / unknown fields", () => {
    const parsed = parseManaBox(
      "\uFEFF" +
        exportCsv([
          solRow(2, { "Custom note": 'a, "quoted" note\nsecond line' }),
        ]),
    );
    expect(parsed.totalRows).toBe(1);
    expect(parsed.problems).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      name: "Sol Ring",
      quantity: 2,
      language: "en",
      condition: "nm",
      finish: "nonfoil",
      binderName: "Main binder",
    });
    expect(parsed.rows[0].raw["Purchase price"]).toBe("2.50");
    expect(parsed.rows[0].raw["Custom note"]).toBe(
      'a, "quoted" note\nsecond line',
    );
  });
  it("accepts missing optional fields with explicit defaults", () => {
    const parsed = parseManaBox(
      exportCsv([{ "Scryfall ID": sol.scryfallId, Quantity: 1 }]),
    );
    expect(parsed.rows[0]).toMatchObject({
      name: "",
      language: "en",
      condition: "unspecified",
      binderName: "",
      finish: "nonfoil",
    });
    expect(parsed.problems).toHaveLength(0);
  });
  it("warns when a missing quantity column defaults to one", () => {
    const parsed = parseManaBox(`Scryfall ID\n${sol.scryfallId}`);
    expect(parsed.rows[0].quantity).toBe(1);
    expect(parsed.warnings).toHaveLength(1);
  });
  it.each([
    "",
    'Name,Quantity\n"broken,2',
    "Name,Name\nSol Ring,Sol Ring",
    "Name,Quantity,Count\nSol Ring,1,1",
    "wrong,columns\n1,2",
  ])("rejects malformed or unsupported CSV without a plan: %s", (csv) =>
    expect(() => parseManaBox(csv)).toThrow(),
  );
  it.each(["-1", "1.5", "two", "", "Infinity", "1000000001"])(
    "surfaces invalid quantity %j as a row problem",
    (q) => {
      const parsed = parseManaBox(exportCsv([solRow(1, { Quantity: q })]));
      expect(parsed.rows).toHaveLength(0);
      expect(parsed.problems[0].raw.Quantity).toBe(q);
    },
  );
  it("surfaces unknown finishes, missing identifiers and ragged rows", () => {
    expect(
      parseManaBox(exportCsv([solRow(1, { Foil: "shiny" })])).problems[0]
        .message,
    ).toContain("finish");
    expect(
      parseManaBox("Name,Quantity\nUnknown,1").problems[0].message,
    ).toContain("Provide a Scryfall ID");
    expect(
      parseManaBox("Name,Quantity,Set code\nSol Ring,1").problems[0].message,
    ).toContain("number of fields");
  });
  it("does not accept inherited object keys as finishes or field aliases", () => {
    expect(
      parseManaBox(exportCsv([solRow(1, { Foil: "constructor" })])).problems,
    ).toHaveLength(1);
    expect(() => parseManaBox("constructor,Quantity\nx,1")).toThrow();
  });
});

describe("deterministic synchronization and ownership", () => {
  it("replaces sample ownership with the first real collection and preserves all source fields", async () => {
    const result = await plan(exportCsv([solRow(1)]));
    expect(result.summary).toMatchObject({
      recognized: 1,
      newRecords: 1,
      updated: 0,
      duplicates: 0,
      problematic: 0,
    });
    expect(result.next.items).toHaveLength(1);
    expect(result.next.items[0]).toMatchObject({
      quantityOwned: 1,
      quantityAssigned: 0,
      quantityUnassigned: 1,
    });
    expect(result.next.items[0].sourceRows[0]["Purchase price currency"]).toBe(
      "USD",
    );
  });
  it("aggregates duplicate rows within the file and re-imports identical totals without changes", async () => {
    const csv = exportCsv([solRow(1), solRow(2), solRow(1)]);
    const first = await plan(csv);
    const again = await plan(csv, first.next);
    expect(first.summary).toMatchObject({
      recognized: 3,
      duplicates: 2,
      newRecords: 1,
      copies: 4,
    });
    expect(first.next.items[0].quantityOwned).toBe(4);
    expect(again.summary).toMatchObject({
      newRecords: 0,
      updated: 0,
      unchanged: 1,
    });
    expect(again.next.items).toEqual(first.next.items);
  });
  it("updates one copy to two instead of adding another record", async () => {
    const first = await plan(exportCsv([solRow(1)]));
    const next = await plan(exportCsv([solRow(2)]), first.next);
    expect(next.next.items).toHaveLength(1);
    expect(next.next.items[0].quantityOwned).toBe(2);
    expect(next.summary).toMatchObject({
      newRecords: 0,
      updated: 1,
      unchanged: 0,
    });
    expect(first.next.items[0].quantityOwned).toBe(1);
  });
  it("separates foil, nonfoil and etched copies of the same printing", async () => {
    const result = await plan(
      exportCsv([
        solRow(1),
        solRow(2, { Foil: "foil" }),
        solRow(3, { Foil: "etched" }),
      ]),
    );
    expect(result.next.items.map((i) => [i.finish, i.quantityOwned])).toEqual([
      ["nonfoil", 1],
      ["foil", 2],
      ["etched", 3],
    ]);
  });
  it("separates languages, conditions and binder/list locations without losing purchases", async () => {
    const result = await plan(
      exportCsv([
        solRow(),
        solRow(1, { Language: "Japanese" }),
        solRow(1, { Condition: "Lightly Played" }),
        solRow(1, { "Binder Name": "Trades" }),
      ]),
    );
    expect(result.next.items).toHaveLength(4);
    expect(result.summary.duplicates).toBe(0);
    expect(
      result.next.items.every(
        (i) => i.sourceRows[0]["Purchase price"] === "2.50",
      ),
    ).toBe(true);
  });
  it("separates two printings of the same card", async () => {
    const alternate: CardMetadata = {
      ...sol,
      scryfallId: "00000000-0000-4000-8000-000000000001",
      setCode: "tst",
      collectorNumber: "1",
    };
    const known = { ...metadata, [alternate.scryfallId]: alternate };
    const result = await plan(
      exportCsv([
        solRow(),
        solRow(3, {
          "Set code": "tst",
          "Collector number": "1",
          "Scryfall ID": alternate.scryfallId,
        }),
      ]),
      null,
      new ScryfallClient(vi.fn(), 0),
      known,
    );
    expect(result.next.items).toHaveLength(2);
    expect(result.next.items.map((i) => i.quantityOwned)).toEqual([1, 3]);
  });
  it("keeps omitted records; a zero quantity hides rather than deletes its record", async () => {
    const first = await plan(
      exportCsv([solRow(1), solRow(2, { Foil: "foil" })]),
    );
    const next = await plan(exportCsv([solRow(0)]), first.next);
    expect(next.next.items).toHaveLength(2);
    expect(collectionCards(next.next)).toHaveLength(1);
    expect(collectionCards(next.next)[0].quantity).toBe(2);
  });
  it("keeps assignments consistent and refuses quantities below assigned copies", async () => {
    const first = await plan(exportCsv([solRow(3)]));
    first.next.items[0].quantityAssigned = 1;
    first.next.items[0].quantityUnassigned = 2;
    const updated = await plan(exportCsv([solRow(2)]), first.next);
    expect(updated.next.items[0]).toMatchObject({
      quantityOwned: 2,
      quantityAssigned: 1,
      quantityUnassigned: 1,
    });
    await expect(plan(exportCsv([solRow(0)]), first.next)).rejects.toThrow(
      "assigned quantity",
    );
  });
  it("keeps unresolved original rows durably and replaces issues when the same source row is corrected", async () => {
    const broken = await plan(exportCsv([solRow(1, { Quantity: "bad" })]));
    expect(broken.next.unresolved).toHaveLength(1);
    expect(broken.next.unresolved[0].raw.Quantity).toBe("bad");
    const fixed = await plan(exportCsv([solRow(2)]), broken.next);
    expect(fixed.next.unresolved).toHaveLength(0);
    expect(fixed.next.items[0].quantityOwned).toBe(2);
  });
  it("processes 10,000 rows with deterministic aggregation and stable repeated imports", async () => {
    const csv = exportCsv(Array.from({ length: 10_000 }, () => solRow(1)));
    const first = await plan(csv);
    const again = await plan(csv, first.next);
    expect(first.summary).toMatchObject({
      recognized: 10_000,
      duplicates: 9999,
      newRecords: 1,
      copies: 10_000,
    });
    expect(again.next.items).toEqual(first.next.items);
    expect(again.summary.updated).toBe(0);
  });
  it("bounds unusually large exports before matching", () => {
    const csv =
      "Scryfall ID\n" +
      Array.from({ length: MAX_ROWS + 1 }, () => sol.scryfallId).join("\n");
    expect(() => parseManaBox(csv)).toThrow("split exports");
  });
});

describe("Scryfall matching precedence, ambiguity and cache", () => {
  it("matches by Scryfall ID first and never guesses after an invalid ID", async () => {
    const fetcher = vi.fn();
    const result = await plan(
      exportCsv([solRow(1, { "Scryfall ID": "invalid" })]),
      null,
      new ScryfallClient(fetcher, 0),
    );
    expect(result.problems[0].message).toContain("Invalid Scryfall ID");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("matches a missing ID by exact set and collector number and reuses a canonical cache", async () => {
    const fetcher = vi.fn();
    const client = new ScryfallClient(fetcher, 0);
    const first = await plan(
      exportCsv([solRow(1, { "Scryfall ID": "" })]),
      null,
      client,
    );
    expect(first.next.items[0].scryfallId).toBe(sol.scryfallId);
    expect(fetcher).not.toHaveBeenCalled();
    const again = await plan(
      exportCsv([solRow(2, { "Scryfall ID": "" })]),
      first.next,
      client,
    );
    expect(again.next.items).toHaveLength(1);
    expect(again.next.items[0].quantityOwned).toBe(2);
  });
  it("rejects conflicting identifier/name/printing information rather than silently matching", async () => {
    for (const extra of [
      { "Set code": "wrong" },
      { "Collector number": "999" },
      { Name: "Counterfeit name" },
    ] as Record<string, string | number>[]) {
      const result = await plan(exportCsv([solRow(1, extra)]));
      expect(result.problems).toHaveLength(1);
      expect(result.next.items).toHaveLength(0);
    }
  });
  it("does not treat an incomplete local name cache as proof of a unique printing", async () => {
    const alternate = {
      ...apiCard(sol),
      id: "00000000-0000-4000-8000-000000000002",
      collector_number: "999",
    };
    const fetcher = vi.fn(async () =>
      response({ data: [apiCard(sol), alternate], has_more: false }),
    );
    const result = await plan(
      exportCsv([solRow(1, { "Scryfall ID": "", "Collector number": "" })]),
      null,
      new ScryfallClient(fetcher, 0),
    );
    expect(result.problems[0].message).toContain("Multiple printings");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("accepts only a proven unique exact name + set and persists its resolution cache", async () => {
    const fetcher = vi.fn(async () =>
      response({ data: [apiCard(sol)], has_more: false }),
    );
    const csv = exportCsv([
      solRow(1, { "Scryfall ID": "", "Collector number": "" }),
    ]);
    const first = await plan(csv, null, new ScryfallClient(fetcher, 0));
    expect(first.summary.newRecords).toBe(1);
    expect(Object.values(first.next.nameMatches)).toContain(sol.scryfallId);
    const noRequests = vi.fn();
    const again = await plan(
      csv,
      first.next,
      new ScryfallClient(noRequests, 0),
    );
    expect(again.summary.unchanged).toBe(1);
    expect(noRequests).not.toHaveBeenCalled();
  });
  it("resolves an exact set name when its code is missing", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) =>
      response(
        String(input).endsWith("/sets")
          ? { data: [{ code: sol.setCode, name: sol.setName }] }
          : { data: [apiCard(sol)] },
      ),
    );
    const result = await plan(
      exportCsv([
        solRow(1, {
          "Scryfall ID": "",
          "Set code": "",
          "Collector number": "",
        }),
      ]),
      null,
      new ScryfallClient(fetcher, 0),
    );
    expect(result.summary.newRecords).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("uses batched identifiers (75 maximum) for 1,000 distinct new printings", async () => {
    const records = Array.from({ length: 1000 }, (_, i) => ({
      ...sol,
      scryfallId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      collectorNumber: String(i + 1),
      setCode: "tst",
      name: `Fixture ${i}`,
    }));
    const byId = Object.fromEntries(records.map((c) => [c.scryfallId, c]));
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(init!.body as string) as {
          identifiers: { id: string }[];
        };
        expect(body.identifiers.length).toBeLessThanOrEqual(75);
        return response({
          data: body.identifiers.map((i) => apiCard(byId[i.id])),
        });
      },
    );
    const csv = exportCsv(
      records.map((c) => ({
        Name: c.name,
        "Scryfall ID": c.scryfallId,
        Quantity: 1,
      })),
    );
    const result = await plan(csv, null, new ScryfallClient(fetcher, 0), {});
    expect(fetcher).toHaveBeenCalledTimes(14);
    expect(result.next.items).toHaveLength(1000);
    expect(result.summary.problematic).toBe(0);
  });
  it("retains confirmed unknown cards but interrupts network failures without card errors", async () => {
    const csv = exportCsv([
      solRow(1, { "Scryfall ID": "00000000-0000-4000-8000-000000000099" }),
    ]);
    const unknown = await plan(
      csv,
      null,
      new ScryfallClient(
        vi.fn(async () => response({ data: [], not_found: [{id:"00000000-0000-4000-8000-000000000099"}] })),
        0,
      ),
    );
    expect(unknown.problems[0].message).toContain("No Scryfall printing");
    await expect(plan(
      csv,null,new ScryfallClient(vi.fn(async()=>{throw new TypeError('offline');}),0,{backoffMs:0}),
    )).rejects.toMatchObject({name:'LookupInterrupted',resolvedRows:0,totalRows:1});
  });
  it("normalizes actual color_identity rather than visual colors and supports double-faced artwork", () => {
    const card = {
      ...apiCard(sol),
      color_identity: ["B", "G"] as ("B" | "G")[],
      colors: [],
      oracle_text: undefined,
      image_uris: undefined,
      card_faces: [
        {
          name: "Front",
          image_uris: { normal: "https://cards.scryfall.io/front.jpg" },
          oracle_text: "Front text",
        },
        { name: "Back", oracle_text: "Back text" },
      ],
    };
    const normalized = normalizeCard(
      card as Parameters<typeof normalizeCard>[0],
    );
    expect(normalized.colorIdentity).toEqual(["B", "G"]);
    expect(normalized.imageUrl).toContain("front.jpg");
    expect(normalized.oracleText).toContain("Back text");
  });
  it("rejects incomplete remote metadata", () => {
    expect(() =>
      normalizeCard({
        ...apiCard(sol),
        color_identity: undefined,
      } as unknown as Parameters<typeof normalizeCard>[0]),
    ).toThrow("incomplete metadata");
  });
  it("cancels matching before making requests", async () => {
    const controller = new AbortController();
    controller.abort();
    const client = new ScryfallClient(vi.fn(), 0);
    await expect(
      client.resolve(
        parseManaBox(exportCsv([solRow()])).rows,
        {},
        {},
        controller.signal,
        quiet,
      ),
    ).rejects.toThrow();
  });
});

describe("IndexedDB transactions and binder adapter", () => {
  it("survives repository recreation and repeated import without duplicating inventory", async () => {
    const factory = new IDBFactory(),
      repo = new IndexedDbCollectionRepository("test", factory);
    expect(await repo.load()).toBeNull();
    const first = await plan(exportCsv([solRow(1)]));
    expect(await repo.load()).toBeNull(); // preview does not write
    await repo.save(first.next, first.baseRevision);
    const reopened = new IndexedDbCollectionRepository("test", factory);
    const saved = await reopened.load();
    expect(saved?.items[0].quantityOwned).toBe(1);
    const updated = await plan(exportCsv([solRow(2)]), saved);
    await reopened.save(updated.next, updated.baseRevision);
    expect((await repo.load())?.items).toHaveLength(1);
    expect((await repo.load())?.items[0].quantityOwned).toBe(2);
  });
  it("rejects stale previews from another tab instead of overwriting changes", async () => {
    const repo = new IndexedDbCollectionRepository("stale", new IDBFactory());
    const a = await plan(exportCsv([solRow(1)])),
      b = await plan(exportCsv([solRow(7)]));
    await repo.save(a.next, a.baseRevision);
    await expect(repo.save(b.next, b.baseRevision)).rejects.toThrow(
      "another tab",
    );
    expect((await repo.load())?.items[0].quantityOwned).toBe(1);
  });
  it("refuses inconsistent ownership before any write", async () => {
    const repo = new IndexedDbCollectionRepository("bad", new IDBFactory());
    const first = await plan(exportCsv([solRow(1)]));
    first.next.items[0].quantityUnassigned = 9;
    await expect(repo.save(first.next, 0)).rejects.toThrow("inconsistent");
    expect(await repo.load()).toBeNull();
  });
  it("keeps existing filters, sorts and Commander subset rules working on persisted cards", async () => {
    const parsed = parseManaBox(
      exportCsv(
        [sol, forest, meren, tatyova].map((c) => ({
          Name: c.name,
          "Scryfall ID": c.scryfallId,
          Quantity: 2,
        })),
      ),
    );
    const resolved: ResolvedImport = {
      results: new Map(
        parsed.rows.map((r) => [
          identifierKey(r),
          { card: metadata[r.scryfallId] },
        ]),
      ),
      nameMatches: {},
    };
    const state = buildImportPlan(
      parsed,
      resolved,
      null,
      "collection.csv",
    ).next;
    const cards = collectionCards(state);
    expect(
      filterCards(cards, "", {
        ...emptyFilters,
        commanderColors: ["B", "G"],
      }).map((c) => c.name),
    ).toEqual(["Sol Ring", "Forest", "Meren of Clan Nel Toth"]);
    expect(
      filterCards(cards, "", {
        ...emptyFilters,
        colors: ["G"],
        types: ["Creature"],
      }).map((c) => c.name),
    ).toEqual(["Meren of Clan Nel Toth", "Tatyova, Benthic Druid"]);
    expect(
      filterCards(cards, "sol", {
        ...emptyFilters,
        finish: "nonfoil",
        rarity: sol.rarity,
        set: sol.setCode,
      }).map((c) => c.name),
    ).toEqual(["Sol Ring"]);
    expect(sortCards(cards, "name")[0].name).toBe("Forest");
    expect(sortCards(cards, "mana")[0].name).toBe("Forest");
    expect(cards.every((c) => c.ownership?.quantityUnassigned === 2)).toBe(
      true,
    );
  });
  it("represents an intentionally empty saved collection separately from demo mode", () => {
    expect(collectionCards(emptyCollection())).toEqual([]);
  });
});

it("does not replace an existing total with the good half of a malformed duplicate group", async () => {
  const initial = await plan(exportCsv([solRow(6)]));
  const broken = await plan(
    exportCsv([solRow(2), solRow(1, { Quantity: "broken" })]),
    initial.next,
  );
  expect(broken.next.items[0].quantityOwned).toBe(6);
  expect(broken.summary).toMatchObject({
    recognized: 0,
    updated: 0,
    problematic: 2,
  });
  expect(broken.warnings.join(" ")).toContain("incomplete quantity");
  expect(broken.next.unresolved).toHaveLength(2);
  const fixed = await plan(exportCsv([solRow(2), solRow(1)]), broken.next);
  expect(fixed.next.items[0].quantityOwned).toBe(3);
  expect(fixed.next.unresolved).toHaveLength(0);
});
