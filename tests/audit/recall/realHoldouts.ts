import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parsePublicDeck } from "./archidekt";
import { findCard, fixedCandidates } from "./harness";
import { dnaFixture } from "../../dnaFixtures";
import { reignOfDragonsFixture } from "../../recommendationFixtures";
import { milesFixture } from "../../milesFixture";
import { valgavothFixture } from "../../valgavothFixture";
import { kwainFixture } from "../../kwainFixture";
import { synergyFixture } from "../../synergyFixtures";
import {
  candidateGroups,
  brewCandidates,
  currentDeckModel,
  analysisConfidence,
} from "../../../src/upgrades";
import { deckDnaCache } from "../../../src/dna/engine";
import { isUnclassifiedTrigger } from "../../../src/dna/strategy";
import { legalInDeck } from "../../../src/decks/decks";
import { deckCount } from "../../../src/decks/decks";
const root = new URL("./", import.meta.url);
export function runRealHoldouts() {
  const manifest = JSON.parse(
    readFileSync(new URL("holdouts/manifest.json", root), "utf8"),
  );
  const legacy = [
    reignOfDragonsFixture,
    milesFixture,
    valgavothFixture,
    kwainFixture,
  ].map((make, i) => {
    const f = make();
    return {
      plan: manifest.legacyDecks[i],
      rows: f.deck.entries!.map((e) => ({
        name: e.name,
        quantity: e.quantity,
        commander: e.board === "commander",
      })),
      kind: "previously-evaluated-user-regression",
    };
  });
  const unseen = manifest.decks.map(
    (plan: {
      id: string;
      rawFile: string;
      sha256: string;
      commander: string;
      expectation: string;
    }) => {
      const raw = readFileSync(new URL(plan.rawFile, root));
      if (createHash("sha256").update(raw).digest("hex") !== plan.sha256)
        throw new Error("Holdout snapshot hash changed");
      return {
        plan,
        rows: parsePublicDeck(JSON.parse(raw.toString()), plan.commander).rows,
        kind: "user-selected-unseen-public-holdout",
      };
    },
  );
  return [...legacy, ...unseen].map(({ plan, rows, kind }) => {
    const missing = rows
      .filter((r: { name: string }) => !findCard(r.name))
      .map((r: { name: string }) => r.name);
    if (missing.length)
      throw new Error(
        "Holdout canonical data missing: " +
          JSON.stringify({ id: plan.id, missing }),
      );
    const commander = rows.find((r: { commander: boolean }) => r.commander)!;
    const main = rows.filter((r: { commander: boolean }) => !r.commander);
    const ordered = [commander, ...main];
    const f = dnaFixture(
      findCard(commander.name)!,
      main.map((r: { name: string }) => findCard(r.name)!),
    );
    f.deck.name = plan.commander;
    for (let i = 0; i < ordered.length; i++)
      f.deck.entries![i].quantity = ordered[i].quantity;
    if (deckCount(f.deck) !== 100)
      throw new Error("Holdout is not 100 cards: " + plan.id);
    for (const name of fixedCandidates) {
      const c = findCard(name)!;
      f.state.metadata[c.scryfallId] = c;
      f.state.items.push(
        synergyFixture().owned(c, "holdout:" + c.scryfallId, 1),
      );
    }
    const dna = deckDnaCache.get(f.state, f.deck),
      groups = candidateGroups(f.state, f.deck),
      brew = brewCandidates(f.state, f.deck),
      model = currentDeckModel(f.state, f.deck);
    const top20 = groups
      .map((g) => ({ name: g.card.name, brew: brew.get(g.identity)! }))
      .sort(
        (a, b) =>
          b.brew.score - a.brew.score ||
          b.brew.synergy - a.brew.synergy ||
          a.name.localeCompare(b.name, "en"),
      )
      .slice(0, 20);
    return {
      id: plan.id,
      commander: plan.commander,
      kind,
      expectation: plan.expectation,
      deckCards: 100,
      rawSnapshot: plan.rawFile || plan.snapshots,
      legalOwnedCandidates: groups.length,
      uncertainty: analysisConfidence(f.state, f.deck),
      rolelessNonlands: model.cards
        .filter((c) => !c.fn.isLand && !Object.keys(c.fn.roles).length)
        .map((c) => c.name),
      lowConfidenceCards: model.cards
        .filter((c) => c.fn.confidence === "Low")
        .map((c) => ({ name: c.name, uncertainties: c.fn.uncertainties })),
      unclassifiedAbilities: model.cards.flatMap((c) =>
        (c.fn.conditions || [])
          .filter((x) => !x.understood)
          .map((x) => ({ name: c.name, line: x.line, needs: x.needs })),
      ),
      unclassifiedCommanderAbilities:
        dna.strategyProfile.commanderSynergyTags.filter(isUnclassifiedTrigger),
      missingOracleData: ordered
        .filter((r: { name: string }) => {
          const c = findCard(r.name)!;
          return (
            c.oracleText === undefined &&
            !c.cardFaces?.some((f) => f.oracleText !== undefined)
          );
        })
        .map((r: { name: string }) => r.name),
      offIdentityDeckCards: ordered
        .filter(
          (r: { name: string }) => !legalInDeck(findCard(r.name)!, f.deck),
        )
        .map((r: { name: string }) => r.name),
      lowConfidenceResults: top20
        .filter((c) => c.brew.confidence !== "High")
        .map((c) => ({
          name: c.name,
          confidence: c.brew.confidence,
          negativeEvidence: c.brew.negatives,
        })),
      themes: dna.themes.map((t) => ({
        id: t.id,
        percent: t.percent,
        contributors: t.contributors,
      })),
      corePlan: dna.core,
      top20,
      candidateOwnershipAssumption:
        "Each card in the fixed research pool is represented as owned once; this is not a claim about the deck author’s collection.",
    };
  });
}
