// Rules capabilities missing from the event/tag layer. These are Oracle-derived,
// recipient-scoped facts, not scores, card-name exceptions or archetype bonuses.
import { hasSelfEntryAbility } from "../upgrades/abilityScope";
import { counterRecipient, suppliesCounterEvent } from "../upgrades/counterSupply";
import type { CardMetadata } from "../models/collection";
import { stripReminderText } from "../utils/rulesText";

export interface Capabilities {
  text: string;
  ownAnaphoricProtection: boolean;
  recursion: boolean;
  recursionTargets: string[];
  graveyardLandPlay: boolean;
  landUntap: boolean;
  counterReplacement: boolean;
  attach: boolean;
  animateVehicle: boolean;
  crewReduction: boolean;
  friendlyBounce: boolean;
  blink: boolean;
  blinkArtifacts: boolean;
  artifactTapDraw: boolean;
  artifactDeathPayoff: boolean;
  sacrificesArtifact: boolean;
  createsSacrificableArtifact: boolean;
  permanentCopy: boolean;
  copyToken: boolean;
  transformCastThreshold?: number;
  ignoresLegend: boolean;
  evidence: string[];
}
const cache = new WeakMap<CardMetadata, Capabilities>();
export function capabilities(card: CardMetadata): Capabilities {
  const known = cache.get(card);
  if (known) return known;
  const text = stripReminderText((card.cardFaces?.length ? card.cardFaces.map(f => f.oracleText || "").join("\n") : card.oracleText || "").replace(/[’‘]/g, "'"));
  const lines = text.split("\n");
  const matches = (pattern: RegExp) => lines.some(line => !/\b(?:target|each|an?) opponent (?:returns?|puts?|may return)|\ban opponent controls\b/i.test(line) && pattern.test(line));
  const recursion = matches(/\breturn\b[^\n]*\b(?:from (?:your|a) graveyard|(?:to your hand|to the battlefield)[^\n]*(?:from|in) your graveyard)/i) ||
    (/enchant creature card in a graveyard/i.test(text) && /return enchanted creature card to the battlefield under your control/i.test(text)) ||
    (/each player exiles all creature cards from their graveyard/i.test(text) && /puts all cards they exiled this way onto the battlefield/i.test(text));
  const transform = card.cardFaces?.length && /Whenever you cast an instant or sorcery spell[^\n]*counter[^\n]*transform/i.test(card.cardFaces[0].oracleText || "") && /When that mana is spent to cast an instant or sorcery spell, copy that spell/i.test(card.cardFaces[1].oracleText || "") ? text.match(/there are (\w+) or more [^\n]*?counters/) : undefined;
  const threshold = transform ? ({ two:2, three:3, four:4, five:5, six:6 } as Record<string,number>)[transform[1]] || Number(transform[1]) : undefined;
  const result: Capabilities = {
    text,
    ownAnaphoricProtection: /\bcreatures? you control\b[^.\n]*\.\s*Those creatures (?:gain|have)[^.\n]*(?:hexproof|indestructible|shroud|protection from)/i.test(text),
    recursion,
    recursionTargets: /you may play lands? from your graveyard/i.test(text) ? ["Land"] : recursion ? linkedGraveyardReturn(text) ? ["Creature"] : [...new Set(lines.filter(line => /graveyard|return enchanted creature card/i.test(line)).flatMap(line => {
      const returned = line.slice(Math.max(0, line.search(/\breturn\b/i))).split(".")[0];
      const kinds = ["Artifact","Creature","Enchantment","Instant","Sorcery","Land","Permanent","Planeswalker"].filter(type => new RegExp(`\\b${type.toLowerCase()}(?:s| card)?\\b`,"i").test(returned));
      return kinds.length ? kinds : ["Any"];
    }))] : [],
    graveyardLandPlay: matches(/\byou may play lands? from your graveyard\b/i),
    landUntap: matches(/\buntap (?:up to )?(?:(?:one|two|three|four|five|six|seven|\d+) (?:target )?|all (?:of )?(?:the |your )?)lands?(?: you control)?(?:\.|$)/i),
    counterReplacement: matches(/^If[^\n]*\+1\/\+1 counters? (?:would be|would be put|on)[^\n]*(?:instead|twice|double)/i) || matches(/^If (?:one or more counters would be put|an effect would put one or more counters)[^\n]*on (?:an? )?(?:artifact or creature|creature|permanent) you control[^\n]*instead/i),
    attach: matches(/\battach (?:target|any number of|all|an?|each)[^\n]*(?:Equipment|Auras?)[^\n]*\b(?:you control|target creature you control)/i),
    animateVehicle: matches(/\b(?:target|another target|each|other) Vehicles?[^\n]*becomes? (?:an? )?artifact creatures?/i),
    crewReduction: matches(/Vehicles? you control have crew \d+/i),
    friendlyBounce: matches(/\breturn (?:another |target |an? |one )?creature you control to its owner's hand/i),
    blink: matches(/\bexile (?:up to (?:one|two) )?(?:(?:another|other) )?target (?:artifact or creature|creature|permanent)[^\n]*you control[^\n]*return (?:it|that card|them)[^\n]*(?:battlefield|control)/i),
    blinkArtifacts: matches(/\bexile[^\n]*(?:artifact or creature|permanent)[^\n]*you control[^\n]*return/i),
    artifactDeathPayoff: matches(/\bWhen(?:ever)?\b[^,]*artifacts? you control (?:dies?|(?:is|are) put into a graveyard from the battlefield)/i),
    sacrificesArtifact: matches(/^[^:\n]*\b[Ss]acrifice (?:an?|another|any number of) artifacts?[^:\n]*:/) || /\bArtifact\b/.test(card.typeLine.split("—")[0]) && matches(/^[^:\n]*\b[Ss]acrifice (?:this artifact|this permanent)[^:\n]*:/),
    createsSacrificableArtifact: matches(/\bcreate[^\n]*(?:Treasure|Clue|Food|Blood|Map)[^\n]*tokens?/i),
    artifactTapDraw: matches(/Tap (?:two|three|\d+) untapped artifacts you control: Draw/i),
    permanentCopy: matches(/(?:enter[^\n]*as a copy of|become a copy of|create[^\n]*copy of)[^\n]*(?:creature|permanent)/i),
    copyToken: matches(/create[^\n]*tokens?[^\n]*cop(?:y|ies)|create[^\n]*cop(?:y|ies)[^\n]*tokens?/i),
    transformCastThreshold: threshold && Number.isFinite(threshold) ? threshold : undefined,
    ignoresLegend: /(?:isn't|is not|aren't) legendary|legend rule[^\n]*doesn't apply/i.test(text),
    evidence: lines.filter(line => /return|untap|counters? would|attach|crew|becomes? an? artifact creature|copy of|legend rule/i.test(line)),
  };
  cache.set(card, result);
  return result;
}

/** A verified two-card rules relationship. Evidence is bidirectional at the caller;
 * no shared tags or color/rarity/popularity predicates are accepted here. */
const recipientViews=new WeakMap<CardMetadata,{type:string;creature:boolean;artifact:boolean;effect:boolean;etb:boolean;repeat:boolean;equipment:boolean;aura:boolean;vehicle:boolean;crew:boolean;graveSetup:boolean}>();
const counterRecipients=new WeakMap<CardMetadata,CardMetadata>();
function recipientView(card:CardMetadata){
  let known=recipientViews.get(card);if(known)return known;
  const b=capabilities(card),type=(card.cardFaces?.[0]?.typeLine || card.typeLine).split("—")[0];
  const effect=/\b(?:draw|create|return|untap|put|exile|deals?|loses|sacrifice|search)\b/i.test(b.text);
  known={type,creature:/\bCreature\b/.test(type),artifact:/\bArtifact\b/.test(type),effect,etb:hasSelfEntryAbility(card)&&effect,repeat:/\bWhenever\b/i.test(b.text),equipment:/\bEquipment\b/.test(card.typeLine),aura:/\bAura\b/.test(card.typeLine)&&/Enchant (?:creature|permanent)\b/i.test(b.text),vehicle:/\bVehicle\b/.test(card.typeLine),crew:/^Crew \d+/m.test(b.text),graveSetup:/\b(?:sacrifice (?:a|an|this|that|another) land|mill|surveil|discard)\b/i.test(b.text)};
  recipientViews.set(card,known);return known;
}
export function capabilityRelationship(source: CardMetadata, recipient: CardMetadata): string[] {
  const a = capabilities(source);
  if (!(a.blink || a.friendlyBounce || a.permanentCopy || a.attach || a.animateVehicle || a.crewReduction || a.artifactTapDraw || a.artifactDeathPayoff || a.counterReplacement || a.graveyardLandPlay || a.transformCastThreshold)) return [];
  const b = capabilities(recipient);
  const view=recipientView(recipient);
  const {type,creature,artifact,effect,etb}=view;
  const out: string[] = [];
  if (a.blink && (creature || a.blinkArtifacts && artifact) && etb)
    out.push(`Exile and return reuses ${recipient.name}'s own entry effect: ${a.text}`);
  if (a.friendlyBounce && creature && etb)
    out.push(`Friendly bounce can reuse ${recipient.name}'s entry effect after paying to recast it: ${a.text}`);
  if (a.permanentCopy && creature && (!/\bLegendary\b/.test(type) || a.ignoresLegend) && (etb || view.repeat && effect))
    out.push(`Copies ${recipient.name}'s independent ability${a.ignoresLegend ? "; its explicit legend exception preserves extra legendary copies" : ""}: ${a.text}`);
  if (a.attach && (view.equipment || view.aura))
    out.push(`Attaches ${recipient.name} to a legal recipient without paying its equip cost; Aura restrictions still apply: ${a.text}`);
  if ((a.animateVehicle || a.crewReduction) && view.vehicle && view.crew)
    out.push(`Enables ${recipient.name}'s creature/combat use${/becomes crewed/i.test(a.text) ? " after this source is crewed" : ""}: ${a.text}`);
  if (a.transformCastThreshold && /\b(?:Instant|Sorcery)\b/.test(type))
    out.push(`After ${a.transformCastThreshold} spell casts transform it, its mana can copy ${recipient.name}; copying does not cast the spell again: ${a.text}`);
  if (a.artifactDeathPayoff && (b.sacrificesArtifact || b.createsSacrificableArtifact))
    out.push(`Actual artifact sacrifices from ${recipient.name} feed its artifact-to-graveyard trigger; merely being an artifact is not enough: ${a.text}`);
  if (a.artifactTapDraw && artifact)
    out.push(`An untapped ${recipient.name} can help pay the artifact-tap draw cost (not a sacrifice): ${a.text}`);
  let counterRecipientCard=counterRecipients.get(source);
  if(a.counterReplacement&&!counterRecipientCard)counterRecipients.set(source,counterRecipientCard=counterRecipient(source,a.text));
  if (counterRecipientCard && suppliesCounterEvent(recipient, counterRecipientCard, false))
    out.push(`Amplifies the actual counter placements from ${recipient.name}; replacement effects alone do not originate counters: ${a.text}`);
  if (a.graveyardLandPlay && view.graveSetup)
    out.push(`Can replay lands put into your graveyard by ${recipient.name}, within normal land-drop limits: ${a.text}`);
  return out;
}

/** Draw-and-discard selection still emits a draw event, but is not net card gain.
 * This predicate is only for functional roles; it never deletes canonical draw facts. */
export function netCardDraw(text: string): boolean {
  const numbers: Record<string, number> = { a:1, an:1, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, x:2 };
  const amount = (verb: string) => [...text.matchAll(new RegExp(`\\b${verb} (a|an|one|two|three|four|five|six|seven|x|\\d+) (?:additional )?cards?\\b`, "gi"))].reduce((n,m) => n + (numbers[m[1].toLowerCase()] ?? Number(m[1])),0);
  return /\bdraws? (?:cards? equal to|that many cards?|additional cards?)/i.test(text) || amount("draws?") > amount("discard(?:s)?");
}

/** Exile is a staging zone when the same exiled graveyard cards immediately return. */
export function linkedGraveyardReturn(text: string): boolean {
  return /exiles?[^\n]*graveyard[^\n]*(?:puts?|returns?)[^\n]*exiled this way[^\n]*(?:onto|to) the battlefield/i.test(text);
}

/** Coverage overlap, not interchangeable raw counts of artifact and spell recursion. */
export function recursionOverlaps(wanted: string[], provided: string[]): boolean {
  const permanent = new Set(["Artifact","Creature","Enchantment","Land","Planeswalker"]);
  return wanted.length > 0 && provided.length > 0 && (wanted.includes("Any") || provided.includes("Any") || wanted.some(type => provided.includes(type) || permanent.has(type) && provided.includes("Permanent") || type === "Permanent" && provided.some(t => permanent.has(t))));
}
