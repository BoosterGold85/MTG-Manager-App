// Upgrades I Own: one shared factual engine, two independent evaluation modes.
//   Mode 1 (Build Around My Commander): Commander Fit + Build Priority from a Commander Blueprint.
//   Mode 2 (Improve My Current Deck):   Upgrade Value from the best one-for-one swap.
// Derived, read-only and cached per saved revision; nothing here writes a deck or moves a copy.
import type { CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import { candidateScorer, deckDnaCache, deckDnaInput } from "../dna/engine";
import { ownedCandidateGroups } from "../synergy/explorer";
import type { OwnedCandidateGroup } from "../synergy/explorer";
import { buildCommanderBlueprint } from "./blueprint";
import type { CommanderBlueprint } from "./blueprint";
import { compareBuild, evaluateForBuild } from "./build";
import type { BuildEvaluation } from "./build";
import { buildDeckModel, compareUpgrade, evaluateUpgrade, simulateSwap } from "./upgrade";
import type { DeckModel, UpgradeEvaluation } from "./upgrade";
import { canonicalInput } from "./inputs";
import { needLabels } from "./cardFunction";
import type { Need } from "./cardFunction";

export const UPGRADES_VERSION = "0.6.6";
/** A deck needs most of its 99 before "Improve My Current Deck" can simulate meaningful swaps. */
export const MIN_CURRENT_DECK_CARDS = 60;
export interface BuildCandidate extends OwnedCandidateGroup {
  build: BuildEvaluation;
}
export interface UpgradeCandidate extends OwnedCandidateGroup {
  upgrade: UpgradeEvaluation;
  build: BuildEvaluation;
}
const cache = new WeakMap<CollectionState, Map<string, unknown>>();
function memo<T>(state: CollectionState, key: string, compute: () => T): T {
  let entries = cache.get(state);
  if (!entries) cache.set(state, (entries = new Map()));
  if (!entries.has(key)) entries.set(key, compute());
  return entries.get(key) as T;
}
const deckKey = (deck: Deck) => `${deck.id}:${deck.modifiedAt}:${JSON.stringify(deck.commanders.map((c) => c.scryfallId))}`;
export function commanderBlueprint(state: CollectionState, deck: Deck): CommanderBlueprint {
  return memo(state, `blueprint:${deckKey(deck)}`, () =>
    buildCommanderBlueprint(deckDnaInput(state, deck).cards.filter((c) => c.commander)),
  );
}
export const mainDeckCount = (deck: Deck) =>
  deck.entries ? deck.entries.filter((e) => e.board === "main").reduce((n, e) => n + e.quantity, 0) : deck.assignments.reduce((n, a) => n + a.quantity, 0);
/** Owned, legal, deck-playable candidates not already in the deck (shared by both goals and the Saved view). */
export function candidateGroups(state: CollectionState, deck: Deck): OwnedCandidateGroup[] {
  return memo(state, `groups:${deckKey(deck)}`, () => ownedCandidateGroups(state, deck));
}
export function buildAroundCommander(state: CollectionState, deck: Deck): BuildCandidate[] {
  return memo(state, `build:${deckKey(deck)}`, () => {
    const blueprint = commanderBlueprint(state, deck);
    return candidateGroups(state, deck)
      .map((group) => ({ ...group, build: evaluateForBuild(blueprint, canonicalInput(state, group.canonical)) }))
      .sort((a, b) => compareBuild(a.build, b.build));
  });
}
export function currentDeckModel(state: CollectionState, deck: Deck): DeckModel {
  return memo(state, `model:${deckKey(deck)}`, () => buildDeckModel(deckDnaCache.get(state, deck), commanderBlueprint(state, deck)));
}
export function improveCurrentDeck(state: CollectionState, deck: Deck): UpgradeCandidate[] {
  return memo(state, `upgrade:${deckKey(deck)}`, () => {
    const dna = deckDnaCache.get(state, deck),
      score = candidateScorer(state, deck, dna),
      model = currentDeckModel(state, deck),
      builds = new Map(buildAroundCommander(state, deck).map((c) => [c.identity, c.build]));
    return candidateGroups(state, deck)
      .map((group) => ({
        ...group,
        upgrade: evaluateUpgrade(model, group.canonical, group.identity, score(group.canonical).recommendation),
        build: builds.get(group.identity)!,
      }))
      .sort((a, b) => compareUpgrade(a.upgrade, b.upgrade));
  });
}
export function compareSwap(state: CollectionState, deck: Deck, candidate: OwnedCandidateGroup["canonical"], cutIdentity: string) {
  const dna = deckDnaCache.get(state, deck);
  return simulateSwap(currentDeckModel(state, deck), candidate, candidateScorer(state, deck, dna)(candidate).recommendation, cutIdentity);
}
/** One candidate's Upgrade Value, without evaluating the whole collection (Card Detail from Build mode). */
export function upgradeFor(state: CollectionState, deck: Deck, candidate: OwnedCandidateGroup["canonical"], identity: string): UpgradeEvaluation {
  const cached = cache.get(state)?.get(`upgrade:${deckKey(deck)}`) as UpgradeCandidate[] | undefined;
  const known = cached?.find((c) => c.identity === identity);
  if (known) return known.upgrade;
  const dna = deckDnaCache.get(state, deck);
  return evaluateUpgrade(currentDeckModel(state, deck), candidate, identity, candidateScorer(state, deck, dna)(candidate).recommendation);
}
export type HealthStatus = "Good" | "Slightly Low" | "Low" | "High";
export interface DeckHealthRow {
  need: Need;
  label: string;
  /** Exact engine count (fractional for partial roles such as single-mode protection). */
  count: number;
  target: number;
  status: HealthStatus;
  reasons: string[];
}
// Deck Health reads the same card functions, totals and Commander Blueprint targets as Upgrade Value: one source of truth.
const HEALTH_NEEDS: Need[] = ["ramp", "cardAdvantage", "interaction", "wipes", "protection", "recursion", "tutors", "finishers", "tokens", "sacrificeOutlets", "controlledDiscard"];
export function deckHealth(state: CollectionState, deck: Deck): DeckHealthRow[] {
  return memo(state, `health:${deckKey(deck)}`, () => {
    const model = currentDeckModel(state, deck);
    const needs = model.blueprint.needs;
    const rows: DeckHealthRow[] = HEALTH_NEEDS.filter((need) => model.targets[need] > 0).map((need) => {
      const count = model.totals.roles[need], target = model.targets[need];
      const ratio = count / target;
      return { need, label: needLabels[need], count, target, status: ratio >= 1 ? "Good" : ratio >= 0.75 ? "Slightly Low" : "Low", reasons: needs[need].reasons };
    });
    const lands = model.totals.land, landTarget = model.targets.lands;
    rows.push({
      need: "lands",
      label: needLabels.lands,
      count: lands,
      target: landTarget,
      status: lands >= landTarget - 1 && lands <= landTarget + 3 ? "Good" : lands > landTarget + 3 ? "High" : lands >= landTarget - 3 ? "Slightly Low" : "Low",
      reasons: needs.lands.reasons,
    });
    return rows;
  });
}
/** One candidate's Build evaluation: the same function and blueprint Build Around My Commander uses. */
export function buildFor(state: CollectionState, deck: Deck, candidate: OwnedCandidateGroup["canonical"]): BuildEvaluation {
  const cached = cache.get(state)?.get(`build:${deckKey(deck)}`) as BuildCandidate[] | undefined;
  const known = cached?.find((c) => c.canonical.scryfallId === candidate.scryfallId);
  return known ? known.build : evaluateForBuild(commanderBlueprint(state, deck), canonicalInput(state, candidate));
}
