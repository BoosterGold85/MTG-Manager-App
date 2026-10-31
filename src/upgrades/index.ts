// Upgrades I Own: one shared factual engine, two independent evaluation modes.
//   Mode 1 (Build Around My Commander): Commander Fit + Build Priority from a Commander Blueprint.
//   Mode 2 (Improve My Current Deck):   Upgrade Value from the best one-for-one swap.
// Derived, read-only and cached per saved revision; nothing here writes a deck or moves a copy.
import { RANKING_VERSION } from "../synergy/deckSpecific";
import type { CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import { candidateScorer, deckDnaCache, deckDnaInput } from "../dna/engine";
import { isUnclassifiedTrigger } from "../dna/strategy";
import { ownedCandidateGroups } from "../synergy/explorer";
import type { OwnedCandidateGroup } from "../synergy/explorer";
import { buildCommanderBlueprint } from "./blueprint";
import type { CommanderBlueprint } from "./blueprint";
import { compareBuild, evaluateForBuild } from "./build";
import type { BuildEvaluation } from "./build";
import { buildDeckModel, compareUpgrade, evaluateUpgrade, simulateSwap } from "./upgrade";
import type { DeckModel, UpgradeEvaluation } from "./upgrade";
import { canonicalInput } from "./inputs";
import { brewContext, evaluateBrew } from "./brew";
import type { BrewContext, BrewResult } from "./brew";
import { deckCardFunction, needLabels } from "./cardFunction";
import type { Need } from "./cardFunction";

export const UPGRADES_VERSION = "0.6.16";
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
const deckKey = (deck: Deck) => `${RANKING_VERSION}:${deck.id}:${deck.modifiedAt}:${JSON.stringify([deck.commanders,deck.entries,deck.assignments])}`;
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
    const supply = currentDeckModel(state, deck).supply;
    return candidateGroups(state, deck)
      .map((group) => ({ ...group, build: evaluateForBuild(blueprint, canonicalInput(state, group.canonical), deckCardFunction(group.canonical, supply)) }))
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
const HEALTH_NEEDS: Need[] = ["ramp", "cardAdvantage", "interaction", "wipes", "protection", "recursion", "tutors", "finishers", "tokens", "sacrificeOutlets", "controlledDiscard", "defense"];
export function deckHealth(state: CollectionState, deck: Deck): DeckHealthRow[] {
  return memo(state, `health:${deckKey(deck)}`, () => {
    const model = currentDeckModel(state, deck);
    const rows: DeckHealthRow[] = HEALTH_NEEDS.filter((need) => model.targets[need] > 0).map((need) => {
      const count = model.totals.roles[need], target = model.targets[need];
      const ratio = count / target;
      return { need, label: needLabels[need], count, target, status: ratio >= 1 ? "Good" : ratio >= 0.75 ? "Slightly Low" : "Low", reasons: model.targetReasons[need] };
    });
    const lands = model.totals.land, landTarget = model.targets.lands;
    rows.push({
      need: "lands",
      label: needLabels.lands,
      count: lands,
      target: landTarget,
      status: lands >= landTarget - 1 && lands <= landTarget + 3 ? "Good" : lands > landTarget + 3 ? "High" : lands >= landTarget - 3 ? "Slightly Low" : "Low",
      reasons: model.targetReasons.lands,
    });
    return rows;
  });
}
/** One candidate's Build evaluation: the same function and blueprint Build Around My Commander uses. */
export function buildFor(state: CollectionState, deck: Deck, candidate: OwnedCandidateGroup["canonical"]): BuildEvaluation {
  const cached = cache.get(state)?.get(`build:${deckKey(deck)}`) as BuildCandidate[] | undefined;
  const known = cached?.find((c) => c.canonical.scryfallId === candidate.scryfallId);
  return known ? known.build : evaluateForBuild(commanderBlueprint(state, deck), canonicalInput(state, candidate), deckCardFunction(candidate, currentDeckModel(state, deck).supply));
}
export type AnalysisNoteKind = "commander-trigger" | "commander-links" | "weak-plan" | "untracked-cards" | "missing-text";
export interface AnalysisNote {
  kind: AnalysisNoteKind;
  message: string;
  /** Card names or Commander ability text the note is about. */
  items: string[];
}
export interface AnalysisConfidence {
  level: "High" | "Medium" | "Low";
  notes: AnalysisNote[];
}
const cardText = (card: { oracleText?: string; cardFaces?: { oracleText?: string }[] }) => card.oracleText || card.cardFaces?.map((f) => f.oracleText || "").join("\n") || "";
/**
 * When the app should say it isn't sure: it can't classify the Commander's ability, few cards connect to the
 * Commander, the plan is thinly supported, several cards do things it doesn't track, or card text is missing.
 * Reads only what the engine already computed; nothing here changes scores.
 */
export function analysisConfidence(state: CollectionState, deck: Deck): AnalysisConfidence {
  return memo(state, `confidence:${deckKey(deck)}`, () => {
    const dna = deckDnaCache.get(state, deck);
    const model = currentDeckModel(state, deck);
    const commanders = model.blueprint.commanders.join(" + ");
    const inputs = new Map(dna.strategyProfile.cards.map((c) => [c.card.identity, c.card]));
    const notes: AnalysisNote[] = [];
    const tags = dna.strategyProfile.commanderSynergyTags.filter((t) => t.controller !== "opponent");
    const unknown = tags.filter(isUnclassifiedTrigger);
    if (unknown.length)
      notes.push({
        kind: "commander-trigger",
        message: `The app couldn't tell what ${commanders} rewards in ${unknown.length === 1 ? "this ability" : "these abilities"}, so Deck DNA and Upgrades may miss cards that feed it.`,
        items: unknown.map((t) => t.evidence.snippet),
      });
    const understood = tags.filter((t) => !t.selfOnly && t.event !== "turn");
    const main = model.cards.filter((c) => !c.commander);
    const linked = main.filter((c) => c.commanderLink >= 0.5).length;
    if (understood.length && main.length >= 30 && linked < 3)
      notes.push({
        kind: "commander-links",
        message: `Only ${linked} ${linked === 1 ? "card connects" : "cards connect"} to ${commanders}'s abilities. Either the deck isn't built around them, or the app is misreading how they work.`,
        items: understood.map((t) => t.evidence.snippet),
      });
    const strategic = dna.themes.filter((t) => dna.core.primary.includes(t.label));
    if (main.length >= 30 && (!strategic.length || strategic[0].percent < 15))
      notes.push({
        kind: "weak-plan",
        message: strategic.length
          ? `The main plan (${strategic[0].label}, ${strategic[0].percent}%) is thinly supported, so What This Deck Does may be a rough guess.`
          : "The app couldn't find a clear plan in this deck, so What This Deck Does is a rough guess.",
        items: [],
      });
    const nonland = main.filter((c) => !c.fn.isLand);
    const untracked = nonland
      .filter((c) => !Object.keys(c.fn.roles).length && !(dna.cards[c.identity]?.connections.length) && cardText(inputs.get(c.identity)!.card).length > 40)
      .map((c) => c.name)
      .sort();
    if (untracked.length >= Math.max(3, Math.ceil(0.08 * nonland.length)))
      notes.push({
        kind: "untracked-cards",
        message: `${untracked.length} cards do things the app doesn't track yet, so they don't count toward Deck Health, DNA or Upgrades.`,
        items: untracked,
      });
    const missing = main.filter((c) => !c.fn.isLand && !cardText(inputs.get(c.identity)!.card).trim()).map((c) => c.name).sort();
    if (missing.length)
      notes.push({
        kind: "missing-text",
        message: `${missing.length} ${missing.length === 1 ? "card has" : "cards have"} no rules text saved, so the app can't analyze ${missing.length === 1 ? "it" : "them"}. Re-importing your collection usually fixes this.`,
        items: missing,
      });
    const level = notes.some((n) => n.kind === "commander-trigger" || (n.kind === "weak-plan" && !strategic.length)) ? "Low" : notes.length ? "Medium" : "High";
    return { level, notes };
  });
}

function brewContextFor(state: CollectionState, deck: Deck): BrewContext {
  return memo(state, `brewContext:${deckKey(deck)}`, () => brewContext(deckDnaCache.get(state, deck), currentDeckModel(state, deck), analysisConfidence(state, deck).level));
}
/** Brew Score for every owned candidate, keyed by candidate identity; computed once per deck revision. */
export function brewCandidates(state: CollectionState, deck: Deck): Map<string, BrewResult> {
  return memo(state, `brew:${deckKey(deck)}`, () => {
    const ctx = brewContextFor(state, deck);
    const score = candidateScorer(state, deck, ctx.dna);
    return new Map(candidateGroups(state, deck).map((g) => [g.identity, evaluateBrew(ctx, g.canonical, score(g.canonical))]));
  });
}
/** One candidate's Brew Score (Card Detail), reusing the batch when it exists. */
export function brewFor(state: CollectionState, deck: Deck, candidate: OwnedCandidateGroup["canonical"], identity: string): BrewResult {
  const known = (cache.get(state)?.get(`brew:${deckKey(deck)}`) as Map<string, BrewResult> | undefined)?.get(identity);
  if (known) return known;
  const ctx = brewContextFor(state, deck);
  return evaluateBrew(ctx, candidate, candidateScorer(state, deck, ctx.dna)(candidate));
}
/** The candidate's deck-relative Synergy ("In This Deck"), measured against the unchanged saved deck. */
export function synergyFor(state: CollectionState, deck: Deck, candidate: OwnedCandidateGroup["canonical"]) {
  return candidateScorer(state, deck, deckDnaCache.get(state, deck))(candidate);
}
