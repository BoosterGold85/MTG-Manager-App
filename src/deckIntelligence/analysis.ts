import type { CardMetadata, CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import { deckCoverage, oracleKey } from "./coverage";
import type { CoverageReport } from "./coverage";
import { extractCardFacts } from "../synergy/facts";
import { capabilityRelationship } from "../synergy/capabilities";
import { resourceRelationship, resourceSemantics } from "../synergy/resources";
import { effectConditions, SupplyIndex } from "../upgrades/conditions";
import { deckCardFunction, needLabels } from "../upgrades/cardFunction";
import type { Need } from "../upgrades/cardFunction";
import { stripReminderText } from "../utils/rulesText";

export interface IntelligenceCard { identity: string; card: CardMetadata; quantity: number; entryIds: string[]; complete: boolean }
export type RelationshipStatus = "confirmed" | "conditional" | "thematic" | "unresolved" | "rule-conflict";
export interface SynergyChain {
  id: string; producer: string; consumer: string; status: RelationshipStatus; mechanism: string;
  explanation: string; evidence: { name: string; text: string }[]; restrictions: string[];
  direction: "producer-consumer" | "partners";
}
export interface StrategyGoal { label: string; enablers: string[]; payoffs: string[]; evidence: string[]; confidence: "Moderate" | "Low" }
export const textOf = (card: CardMetadata) => (card.cardFaces?.length ? card.cardFaces.map(f => f.oracleText || "").join("\n") : card.oracleText || "").replace(/[’‘]/g, "'");
const factsOf = (r: IntelligenceCard) => extractCardFacts(r.card);
const land = (r: IntelligenceCard) => /\bLand\b/.test(r.card.cardFaces?.[0]?.typeLine || r.card.typeLine);
export function verifiedMain(coverage: CoverageReport): IntelligenceCard[] {
  const rows = new Map<string, IntelligenceCard>();
  for (const r of coverage.entries) {
    if (r.entry.board === "sideboard" || !r.card || r.oracle !== "available") continue;
    const old = rows.get(r.identity);
    if (old) { old.quantity += r.entry.quantity; old.entryIds.push(r.entry.id); old.complete &&= r.status === "full"; }
    else rows.set(r.identity, { identity: r.identity, card: r.card, quantity: r.entry.quantity, entryIds: [r.entry.id], complete: r.status === "full" });
  }
  return [...rows.values()];
}
const knownConditions = new WeakMap<CardMetadata, ReturnType<typeof effectConditions>>();
function conditions(card: CardMetadata) {
  let result = knownConditions.get(card);
  if (!result) { result = effectConditions(card); knownConditions.set(card, result); }
  return result;
}
function restrictions(card: CardMetadata) {
  const t = textOf(card), list: string[] = [];
  const mana = card.manaCost; if (mana) list.push(`Normal casting cost: ${mana}.`);
  for (const line of t.split("\n")) {
    if (/:/.test(line)) list.push(`Activation costs and restrictions: ${line.split(":")[0]}.`);
    if (/\b(?:only|once|beginning|whenever|when|if|unless|target)\b/i.test(line)) list.push(`Condition / target restriction: ${line}`);
  }
  return list;
}
/** Relationship proof is directional. Shared tags never become confirmed interactions. */
const pairProofs = new WeakMap<CardMetadata, WeakMap<CardMetadata, Map<string, SynergyChain[]>>>();
export function synergyChains(rows: IntelligenceCard[]): SynergyChain[] {
  const out: SynergyChain[] = [];
  const seen = new Set<string>();
  const add = (a: IntelligenceCard, b: IntelligenceCard, status: RelationshipStatus, mechanism: string, explanation: string, evidence: SynergyChain["evidence"], extra: string[] = [], direction: SynergyChain["direction"] = "producer-consumer") => {
    const id = `${a.identity}>${b.identity}:${mechanism}`;
    if (!seen.has(id)) { seen.add(id); out.push({ id, producer: a.identity, consumer: b.identity, status, mechanism, explanation, evidence, direction, restrictions: [...new Set([...extra, ...restrictions(a.card), ...restrictions(b.card)])] }); }
  };
  for (const b of rows) {
    const bf = factsOf(b), mayhem = bf.faces.flatMap(f => f.castFromDiscard).filter(f => f.mechanic === "mayhem");
    for (const a of rows) {
      if (a.identity === b.identity) continue;
      let targets = pairProofs.get(a.card); if (!targets) { targets = new WeakMap(); pairProofs.set(a.card, targets); }
      let variants = targets.get(b.card); if (!variants) { variants = new Map(); targets.set(b.card, variants); }
      const variant = `${a.complete}:${b.complete}`, cached = variants.get(variant);
      if (cached) { for (const c of cached) { const id = `${a.identity}>${b.identity}:${c.mechanism}`; if (!seen.has(id)) { seen.add(id); out.push({ ...c, id, producer: a.identity, consumer: b.identity }); } } continue; }
      const start = out.length;
      const af = factsOf(a);
      const recursion = stripReminderText(textOf(b.card)).split("\n").find(line => /^(?:When [^,]+, )?return target creature card(?: with mana value \d+ or less)? from (?:your|a) graveyard to (?:the battlefield|your hand)(?:\.| under your control\.)/i.test(line));
      const limit = recursion?.match(/with mana value (\d+) or less/i)?.[1];
      if (recursion && (!limit || a.card.manaValue <= Number(limit)) && /\bCreature\b/.test(a.card.cardFaces?.[0]?.typeLine || a.card.typeLine)) add(a, b, "conditional", "Graveyard creature target", `${a.card.name} can be a creature-card target for ${b.card.name} only while in the specified graveyard${limit ? ` and with mana value ${limit} or less` : ""}. Merely controlling it does not make the target available.`, [{ name: a.card.name, text: a.card.typeLine }, { name: b.card.name, text: recursion }], ["The target must remain legal when the spell resolves; moving a card to the graveyard is a separate requirement."]);
      if (mayhem.length) {
        const prohibition = stripReminderText(textOf(a.card)).split("\n").find(line => /^Players can't cast spells from graveyards(?: or libraries)?\./i.test(line));
        if (prohibition) add(a, b, "rule-conflict", "Graveyard casting prohibited", `${a.card.name} prevents casting ${b.card.name} through Mayhem while that prohibition applies. A casting permission cannot override a prohibition.`, [{ name: a.card.name, text: prohibition }, { name: b.card.name, text: mayhem[0].text }], ["The prohibiting effect must be active; this is not a claim that these cards are illegal to include together."]);
        const discards = af.faces.flatMap(f => f.discards).filter(f => f.who === "you" || f.who === "each_player" || f.who === "target_player");
        const choice = stripReminderText(textOf(a.card)).split("\n").find(line => /^You may sacrifice an? (?:artifact|creature|permanent) or discard a card\./i.test(line));
        if (choice) discards.push({ face: a.card.name, text: choice, who: "you", mode: "choice", conditional: true, controller: "you" });
        // Typed discard alone cannot validate restricted selections (e.g. discard a land).
        const unrestricted = discards.find(f => /\bdiscard(?:s)? (?:a card|two cards|three cards|\d+ cards|(?:your|their) hand)\b/i.test(f.text));
        if (unrestricted) add(a, b, "conditional", "Discard → Mayhem", `${a.card.name} can discard ${b.card.name} from your hand, enabling its Mayhem casting permission that turn.`, [{ name: a.card.name, text: unrestricted.text }, { name: b.card.name, text: mayhem[0].text }], [`The Mayhem card itself must be discarded this turn; milling or surveilling it does not qualify.`, `Pay the discard source's costs and the Mayhem cost ${mayhem[0].cost || "shown on the card"}.`, ...(choice ? ["Choose the discard option; sacrificing an artifact instead does not discard the Mayhem card."] : []), "Normal timing rules still apply. A creature normally requires your main phase, an empty stack, and priority.", ...(unrestricted.who === "target_player" ? ["You must be a legal target and choose yourself as the target player."] : []), "The chosen card must still be in your graveyard when you cast it."]);
        else if (discards.length) add(a, b, "unresolved", "Restricted discard → Mayhem", "A discard effect is present, but its selection restrictions are not verified for this Mayhem card.", [{ name: a.card.name, text: discards[0].text }, { name: b.card.name, text: mayhem[0].text }]);
        if (/\bsurveil\b|\bmill\b/i.test(textOf(a.card))) add(a, b, "rule-conflict", "Graveyard placement ≠ discard", `${a.card.name}'s milling or surveilling of ${b.card.name} does not enable Mayhem: moving a card from library to graveyard is not discarding it from hand.`, [{ name: a.card.name, text: textOf(a.card) }, { name: b.card.name, text: mayhem[0].text }]);
      }
      // Existing interpreters validate partner types/targets; a potential relationship remains conditional.
      if (a.complete && b.complete) {
        for (const evidence of capabilityRelationship(a.card, b.card)) {
          const directed = /^(?:Exile and return reuses|Friendly bounce|Copies |Attaches |Enables |After \d+ spell casts)/.test(evidence);
          add(a, b, "conditional", "Mechanical support", evidence, [{ name: a.card.name, text: textOf(a.card) }, { name: b.card.name, text: textOf(b.card) }], ["Requires legal targets, costs, and an appropriate game state; no loop or deterministic win is proven.", ...(directed ? [] : ["This interpreter supplies a partner relationship, not a verified producer/consumer direction."])], directed ? "producer-consumer" : "partners");
        }
        for (const c of conditions(b.card).filter(c => c.understood && !c.commanderOnly && !/mayhem|madness/i.test(c.key))) {
          if (c.supplies(a.card)) add(a, b, "conditional", `Supplies ${c.needs}`, `${a.card.name} can supply ${c.needs} for ${b.card.name}.`, [{ name: a.card.name, text: textOf(a.card) }, { name: b.card.name, text: c.line }], ["Supply is a possible event, not a promise that the condition is met now."]);
        }
      }
      const ra = resourceSemantics(a.card), rb = resourceSemantics(b.card);
      for (const evidence of resourceRelationship(a.card, b.card)) add(a, b, "conditional", "Resource support", evidence, [{ name: a.card.name, text: textOf(a.card) }, { name: b.card.name, text: textOf(b.card) }], [], (ra.foodAccess || ra.lifelink || ra.targetedLife) && rb.lifeObserver ? "producer-consumer" : "partners");
      variants.set(variant, out.slice(start));
    }
  }
  return out;
}
function inferGoals(rows: IntelligenceCard[], chains: SynergyChain[], adequate: boolean): StrategyGoal[] {
  if (!adequate) return [];
  const recipes: [string, (c: SynergyChain) => boolean][] = [
    ["Discard / Mayhem", c => c.mechanism === "Discard → Mayhem"],
    ["Graveyard recursion", c => c.mechanism === "Graveyard creature target"],
    ["Resource engines", c => c.mechanism === "Resource support"],
    ["Triggered abilities and reuse", c => c.status === "conditional" && !["Discard → Mayhem", "Resource support", "Graveyard creature target"].includes(c.mechanism)],
  ];
  return recipes.map(([label, test]) => {
    const links = chains.filter(c => test(c) && c.status === "conditional" && c.direction === "producer-consumer"), ids = new Set(links.flatMap(c => [c.producer, c.consumer]));
    return { label, enablers: [...new Set(links.map(c => rows.find(r => r.identity === c.producer)!.card.name))], payoffs: [...new Set(links.map(c => rows.find(r => r.identity === c.consumer)!.card.name))], evidence: [...new Set(links.map(c => c.explanation))], confidence: ids.size >= 3 && links.length >= 2 ? "Moderate" as const : "Low" as const };
  }).filter(g => g.evidence.length).sort((a, b) => b.enablers.length + b.payoffs.length - a.enablers.length - a.payoffs.length);
}
export function deckIntelligence(state: CollectionState, deck: Deck) {
  const coverage = deckCoverage(state, deck), rows = verifiedMain(coverage), chains = synergyChains(rows);
  const main = coverage.entries.filter(r => r.entry.board !== "sideboard");
  const expectedNonlands = main.filter(r => !r.card || !/\bLand\b/.test(r.card.cardFaces?.[0]?.typeLine || r.card.typeLine));
  const known = expectedNonlands.filter(r => r.oracle === "available").reduce((n, r) => n + r.entry.quantity, 0), expected = expectedNonlands.reduce((n, r) => n + r.entry.quantity, 0);
  // Explanation confidence guard, not a ranking or universal composition target.
  const interpreted = expectedNonlands.filter(r => r.status === "full" || (r.mechanical?.recognized || 0) > 0).reduce((n, r) => n + r.entry.quantity, 0);
  const adequate = expected > 0 && known / expected >= 0.8 && interpreted / expected >= 0.6;
  const goals = inferGoals(rows, chains, adequate);
  const supply = new SupplyIndex(rows.map(r => ({ ...r, commander: false })));
  const roles: Partial<Record<Need, number>> = {};
  for (const r of rows) for (const [role, n] of Object.entries(deckCardFunction(r.card, supply).roles)) roles[role as Need] = (roles[role as Need] || 0) + (n || 0) * r.quantity;
  const lands = rows.filter(land), spells = rows.filter(r => !land(r)), totalSpells = spells.reduce((n, r) => n + r.quantity, 0);
  const curve: Record<string, number> = {};
  for (const r of spells) { const band = r.card.manaValue >= 7 ? "7+" : String(r.card.manaValue); curve[band] = (curve[band] || 0) + r.quantity; }
  const mana: Record<string, number> = {};
  // Only actual producedMana, never color identity as a production claim. Multiple colors may overlap.
  for (const r of lands) for (const color of new Set([...(r.card.producedMana || []), ...factsOf(r).faces.flatMap(f => f.addsMana).filter(f => f.scope === "card" && (f.controller === "you" || f.controller === "each_player")).flatMap(f => f.colors)])) mana[color] = (mana[color] || 0) + r.quantity;
  const weaknesses: string[] = [], strengths: string[] = [];
  if (!adequate) weaknesses.push(`Oracle data is available for ${known}/${expected} intended nonland copies; ${interpreted}/${expected} have interpreted abilities. Strategy inference is withheld until coverage improves.`);
  if (rows.some(r => factsOf(r).typedRoles.includes("mayhem_card")) && !chains.some(c => c.mechanism === "Discard → Mayhem")) weaknesses.push("Mayhem cards have no verified unrestricted self-discard partner here. Mill and surveil cannot fill that gap.");
  for (const goal of goals) {
    const enablers = rows.filter(r => goal.enablers.includes(r.card.name)).reduce((n, r) => n + r.quantity, 0), payoffs = rows.filter(r => goal.payoffs.includes(r.card.name)).reduce((n, r) => n + r.quantity, 0);
    if (payoffs > enablers) weaknesses.push(`${goal.label} has ${payoffs} payoff copies and ${enablers} enabler copies. Review access to the enabling event and repeatability; this is a deck-specific dependency, not a required ratio.`);
  }
  for (const [role, label] of [["interaction", "removal or interaction"], ["cardAdvantage", "card advantage"]] as const) if (!(roles[role] || 0)) weaknesses.push(`No modeled ${label} among the verified main-deck cards. Unsupported or missing data may hide additional effects.`);
  const demand = new Set(spells.flatMap(r => (r.card.manaCost?.match(/\{[WUBRG]\}/g) || []).map(s => s.slice(1, -1))));
  for (const color of demand) if (!mana[color]) weaknesses.push(`No saved land production confirms ${color} mana required by this deck. Unverified producers, nonland mana, and sequencing require review.`);
  const landCount = lands.reduce((n, r) => n + r.quantity, 0);
  const expensive = spells.filter(r => r.card.manaValue >= 5).reduce((n, r) => n + r.quantity, 0);
  if (expensive) weaknesses.push(`${expensive} verified nonland copies cost five or more mana; compare this demand with ${landCount} verified land copies and ${Number(roles.ramp || 0).toFixed(1)} modeled ramp contribution. Alternative costs and timing may change the demand.`);
  if (chains.some(c => c.status === "conditional")) strengths.push(`${new Set(chains.filter(c => c.status === "conditional").flatMap(c => [c.producer, c.consumer])).size} canonical cards participate in evidence-backed conditional relationships.`);
  if (roles.interaction) strengths.push(`Verified main-deck interaction contributes ${roles.interaction.toFixed(1)} role units; these are weighted effects, not independent answers.`);
  const wins = rows.filter(r => /\byou win the game\b|\b(?:each|target) opponent loses the game\b/i.test(stripReminderText(textOf(r.card))));
  const threats = rows.filter(r => (deckCardFunction(r.card, supply).roles.finishers || 0) > 0);
  const supporting = rows.filter(r => !land(r) && !chains.some(c => c.producer === r.identity || c.consumer === r.identity)).flatMap(r => {
    const labels = Object.entries(deckCardFunction(r.card, supply).roles).filter(([, n]) => (n || 0) > 0).map(([role]) => needLabels[role as Need]);
    return labels.length ? [`${r.card.name} (${labels.join(", ")})`] : [];
  });
  return { coverage, rows, chains, goals, adequate, roles, curve, mana, landCount, averageMana: spells.reduce((n, r) => n + r.quantity * r.card.manaValue, 0) / Math.max(1, totalSpells), weaknesses, strengths, wins: wins.map(r => r.card.name), threats: threats.map(r => r.card.name), supporting };
}

/** Explanation-only preview: existing Plan Fit/Brew Score and ranking order are never changed. */
export function explainCandidate(state: CollectionState, deck: Deck, card: CardMetadata, cutId?: string, quantity = 1) {
  const before = deckIntelligence(state, deck), candidate = { identity: oracleKey(card), card, quantity, entryIds: [], complete: false };
  const candidateCoverage = deckCoverage({ ...state, metadata: { ...state.metadata, [card.scryfallId]: card } }, { ...deck, entries: [{ id: "candidate", name: card.name, cardIdentity: candidate.identity, board: "main", scryfallId: card.scryfallId, quantity }] });
  candidate.complete = candidateCoverage.entries[0].status === "full";
  const links = candidateCoverage.entries[0].oracle === "available" ? synergyChains([...before.rows.filter(r => r.identity !== candidate.identity), candidate]).filter(c => c.producer === candidate.identity || c.consumer === candidate.identity) : [];
  if (!cutId || !deck.entries) return { links, before, after: undefined, roleChanges: [], gained: [], lost: [] };
  const entries = deck.entries.map(e => ({ ...e, quantity: e.id === cutId ? e.quantity - quantity : e.quantity })).filter(e => e.quantity > 0);
  entries.push({ id: "candidate-preview", name: card.name, cardIdentity: candidate.identity, board: "main", scryfallId: card.scryfallId, quantity });
  const after = deckIntelligence({ ...state, metadata: { ...state.metadata, [card.scryfallId]: card } }, { ...deck, entries });
  const roleChanges = (Object.keys(needLabels) as Need[]).filter(r => (before.roles[r] || 0) !== (after.roles[r] || 0)).map(r => ({ label: needLabels[r], before: before.roles[r] || 0, after: after.roles[r] || 0 }));
  const usable = (chains: SynergyChain[]) => chains.filter(c => c.status === "conditional" || c.status === "confirmed");
  return { links, before, after, roleChanges, gained: usable(after.chains).filter(c => !before.chains.some(old => old.id === c.id)), lost: usable(before.chains).filter(c => !after.chains.some(next => next.id === c.id)) };
}
