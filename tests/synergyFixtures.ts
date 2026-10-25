import { dnaFixture, dragons, lathliss, plainCommander } from "./dnaFixtures";
import type { CardMetadata, CollectionItem } from "../src/models/collection";
import { cardIdentity } from "../src/intelligence/tagger";
export function synergyFixture() {
  const f = dnaFixture(lathliss, dragons.slice(1));
  const candidate = {
    ...dragons[0],
    colorIdentity: ["R"] as CardMetadata["colorIdentity"],
  };
  const alternate = {
    ...candidate,
    scryfallId: "66666666-0000-4000-8000-000000000002",
    setCode: "alt",
    collectorNumber: "2",
  };
  const utility = {
    ...candidate,
    name: "Quiet Owned Card",
    oracleId: "quiet-owned",
    scryfallId: "66666666-0000-4000-8000-000000000003",
    typeLine: "Artifact",
    oracleText: "",
    keywords: [],
    colorIdentity: [],
  };
  const blue = {
    ...utility,
    name: "Blue Excluded",
    oracleId: "blue-excluded",
    scryfallId: "66666666-0000-4000-8000-000000000004",
    colorIdentity: ["U"] as CardMetadata["colorIdentity"],
  };
  const zero = {
    ...utility,
    name: "Zero Owned",
    oracleId: "zero-owned",
    scryfallId: "66666666-0000-4000-8000-000000000005",
  };
  f.deck.commanders[0].colorIdentity = ["R"];
  const owned = (
    card: CardMetadata,
    id: string,
    quantityOwned: number,
    quantityAssigned = 0,
  ): CollectionItem => ({
    id,
    scryfallId: card.scryfallId,
    setCode: card.setCode,
    collectorNumber: card.collectorNumber!,
    finish: "nonfoil",
    language: "en",
    condition: "nm",
    binderName: "Main",
    binderType: "binder",
    quantityOwned,
    quantityAssigned,
    quantityUnassigned: Math.max(0, quantityOwned - quantityAssigned),
    sourceRows: [],
  });
  const other = {
    ...f.deck,
    id: "other-deck",
    name: "Miirym",
    entries: undefined,
    commanders: [
      {
        scryfallId: plainCommander.scryfallId,
        name: plainCommander.name,
        colorIdentity: plainCommander.colorIdentity,
        cardIdentity: cardIdentity(plainCommander),
      },
    ],
    assignments: [{ itemId: "utvara-owned", quantity: 1 }],
  };
  f.state.metadata = {
    ...f.state.metadata,
    ...Object.fromEntries(
      [candidate, alternate, utility, blue, zero, plainCommander].map((c) => [
        c.scryfallId,
        c,
      ]),
    ),
  };
  f.state.items = [
    owned(candidate, "utvara-owned", 1, 1),
    { ...owned(alternate, "utvara-foil", 2), finish: "foil" },
    owned(utility, "quiet-owned", 1),
    owned(blue, "blue-owned", 1),
    owned(zero, "zero-owned", 0),
  ];
  f.state.decks = [f.deck, other];
  return { ...f, candidate, alternate, utility, blue, zero, owned };
}
