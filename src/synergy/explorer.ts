import type { CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import type { SampleCollectionCard } from "../models/card";
import { collectionCards } from "../models/collection";
import { candidateScorer, deckDnaCache, deckDnaInput } from "../dna/engine";
import type { CardSynergy } from "../dna/engine";
import { deckUsage, legalInDeck } from "../decks/decks";
import { normalizedName } from "../import/csv";
export interface SynergyCandidate {
  identity: string;
  card: SampleCollectionCard;
  printings: SampleCollectionCard[];
  owned: number;
  available: number;
  usage: { id: string; name: string; quantity: number }[];
  synergy: CardSynergy;
}
// Derived read-only view. Availability affects ordering, never the theme-fit score.
export function exploreSynergy(
  state: CollectionState,
  deck: Deck,
): SynergyCandidate[] {
  const dna = deckDnaCache.get(state, deck),
    score = candidateScorer(state, deck, dna);
  const input = deckDnaInput(state, deck);
  const names = new Set(input.cards.map((c) => normalizedName(c.card.name)));
  const identities = new Set(input.cards.map((c) => c.identity));
  const oracleByName = new Map(
    Object.values(state.metadata)
      .filter((c) => c.oracleId)
      .map((c) => [normalizedName(c.name), c.oracleId!]),
  );
  const groups = new Map<string, SampleCollectionCard[]>();
  for (const card of collectionCards(state)) {
    const identity =
      card.oracleId ||
      oracleByName.get(normalizedName(card.name)) ||
      `name:${normalizedName(card.name)}`;
    if (
      !legalInDeck(card, deck) ||
      identities.has(identity) ||
      names.has(normalizedName(card.name))
    )
      continue;
    const group = groups.get(identity) || [];
    group.push(card);
    groups.set(identity, group);
  }
  return [...groups]
    .map(([identity, printings]) => {
      printings.sort(
        (a, b) =>
          Number(b.ownership!.quantityUnassigned > 0) -
            Number(a.ownership!.quantityUnassigned > 0) ||
          a.id.localeCompare(b.id, "en"),
      );
      const usage = new Map<
        string,
        { id: string; name: string; quantity: number }
      >();
      for (const card of printings)
        for (const u of deckUsage(state, card.id)) {
          const previous = usage.get(u.deck.id);
          usage.set(u.deck.id, {
            id: u.deck.id,
            name: u.deck.name,
            quantity: (previous?.quantity || 0) + u.quantity,
          });
        }
      // Display an available physical printing, but score stable canonical evidence independently.
      const completeness = (c: SampleCollectionCard) =>
        (c.oracleText?.length || 0) +
        (c.cardFaces?.length || 0) * 100 +
        (c.keywords?.length || 0) * 10;
      const canonical = [...printings].sort(
        (a, b) =>
          completeness(b) - completeness(a) ||
          a.scryfallId.localeCompare(b.scryfallId, "en"),
      )[0];
      const card = printings[0];
      return {
        identity,
        card,
        printings,
        owned: printings.reduce((n, c) => n + c.ownership!.quantityOwned, 0),
        available: printings.reduce(
          (n, c) => n + c.ownership!.quantityUnassigned,
          0,
        ),
        usage: [...usage.values()].sort((a, b) =>
          a.name.localeCompare(b.name, "en"),
        ),
        synergy: score({
          ...canonical,
          oracleId:
            oracleByName.get(normalizedName(canonical.name)) ||
            canonical.oracleId,
        }),
      };
    })
    .sort(
      (a, b) =>
        b.synergy.score - a.synergy.score ||
        ({ High: 3, Medium: 2, Low: 1 }[b.synergy.recommendation?.confidence || "Low"] - { High: 3, Medium: 2, Low: 1 }[a.synergy.recommendation?.confidence || "Low"]) ||
        (b.synergy.recommendation?.commander.score || 0) - (a.synergy.recommendation?.commander.score || 0) ||
        (b.synergy.recommendation?.roleNeedSeverity || 0) - (a.synergy.recommendation?.roleNeedSeverity || 0) ||
        (b.synergy.recommendation?.efficiency || 0) - (a.synergy.recommendation?.efficiency || 0) ||
        Number(b.available > 0) - Number(a.available > 0) ||
        a.card.name.localeCompare(b.card.name, "en") ||
        a.identity.localeCompare(b.identity, "en"),
    );
}
