// Ephemeral experimental game-state contracts; never persisted or used by scoring.
import type { CardMetadata } from '../../models/collection';
export const VERSION = 'phase4-browser.2';
export type Zone = 'hand' | 'battlefield' | 'graveyard' | 'library' | 'stack' | 'exile';
export type Color = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';
export type Mana = Record<Color, number>;
export type Status = 'Verified' | 'Conditional' | 'Invalid' | 'Unknown';
export interface Evidence { kind?: 'oracle' | 'rules' | 'printed-cost'; id: string; oracleId: string; line: number; text: string; rule: string }
export interface Selector { type: 'Creature' | 'Artifact' | 'ArtifactOrCreature' | 'ArtifactOrEnchantment' | 'Vehicle' | 'Enchantment' | 'Instant' | 'Sorcery' | 'Permanent' | 'Any'; zone: Zone; controller: 'you' | 'any'; self?: boolean; another?: boolean; maxManaValue?: number; nontoken?: boolean; nonland?: boolean }
export interface TargetRef { instance: string; incarnation: number }
export interface Condition { kind: 'source-counters' | 'control-creature-count' | 'control-power-at-least' | 'unique-name'; minimum: number }
export type Effect =
  | { kind: 'draw-put-back'; draw: number; putBack: number }
  | { kind: 'remove'; target: Selector; destination: 'exile' | 'graveyard'; controllerLifeFromPower?: boolean }
  | { kind: 'entry-copy'; selector: Selector }
  | { kind: 'artifact-tokens'; count: number; subtype: 'Treasure' | 'Clue' | 'Food' }
  | { kind: 'counted-mana'; color: Color; selector: Selector }
  | { kind: 'power-branch'; threshold: number; draw: number; counters: number }
  | { kind: 'blink'; target: Selector; ownerControl?: boolean }
  | { kind: 'copy-permanent'; target: Selector }
  | { kind: 'untap'; target?: Selector; self?: boolean; allCreatures?: boolean }
  | { kind: 'sacrifice'; target: Selector }
  | { kind: 'draw'; count: number }
  | { kind: 'gain-life'; count: number }
  | { kind: 'lose-life'; count: number }
  | { kind: 'damage'; count: number }
  | { kind: 'mana'; symbols: string[]; choose?: boolean }
  | { kind: 'counter'; count: number; recipient: 'self' | 'event' | 'target'; maximum: number; minimum?: number }
  | { kind: 'return'; target: Selector; destination: 'hand' | 'battlefield'; restrictions: string[] }
  | { kind: 'tokens'; count: number; power: number; toughness: number; colors: string[]; types: string[]; keywords?: string[] }
  | { kind: 'entry-branch'; keyword: 'Flying' }
  | { kind: 'copy-spell'; nonlegendary: boolean; thenCounterSelf: boolean }
  | { kind: 'adapt'; count: number }
  | { kind: 'entry-counter-permission'; count: number }
  | { kind: 'discard-choice-draw'; count: number }
  | { kind: 'surveil'; count: number };
export interface Cost { evidence?: Evidence; mana: string; tap?: boolean; removeCounter?: Selector; sacrifice?: Selector; life?: number }
export interface Trigger {
  event: 'enter' | 'counter' | 'cast' | 'gain-life' | 'die';
  subject: Selector;
  minimumPower?: number; maximumPower?: number; matchingPower?: boolean; spellTypes?: string[];
  eventCount: 'each-event' | 'one-or-more';
}
export interface Ability {
  id: string;
  kind: 'triggered' | 'activated' | 'spell' | 'static' | 'permission' | 'replacement';
  evidence: Evidence;
  effects: Effect[];
  effectEvidence?: Evidence[];
  trigger?: Trigger;
  condition?: Condition;
  cost?: Cost;
  static?: 'vehicle-flying' | 'counter-mana' | 'counter-addition' | 'graveyard-cast-prohibition' | 'graveyard-entry-prohibition';
  permission?: 'discarded-this-turn' | 'flashback';
}
export interface CompiledCard {
  key: string;
  oracleId: string;
  name: string;
  types: string[];
  colors: string[];
  manaValue: number;
  manaCost: string;
  castCost?: Cost;
  power: number | null;
  toughness: number | null;
  keywords: string[];
  legendary: boolean;
  abilities: Ability[];
  unsupported: string[];
  deferred: string[];
}
export interface ObjectState {
  instance: string;
  incarnation: number;
  card: CompiledCard;
  baseCard?: CompiledCard;
  zone: Zone;
  controller: 'you' | 'opponent';
  owner: 'you' | 'opponent';
  counters: Record<string, number>;
  tapped: boolean;
  ready: boolean;
  token: boolean;
  discardedTurn?: number;
  ceased?: boolean;
  restrictions: string[];
}
export interface ResourcePayment { kind: 'mana' | 'tap' | 'counter' | 'sacrifice' | 'discard' | 'life'; amount: number; object: TargetRef; ability: string; evidence: Evidence; timing: 'cost' | 'resolution-choice'; mana?: Mana }
export interface ResourceSpend { life?: number; payments?: ResourcePayment[]; mana: Mana; counters: { instance: string; count: number }[]; tapped: string[]; discarded: string[]; sacrificed: string[] }
export interface Payoff { draw: number; recoveredToHand: number; creatures: number; tokens: number; counters: number; life: number; opponentDamage: number; manaGenerated: Mana; loss: boolean }
export interface Event {
  id: string;
  kind: 'put-back' | 'activate' | 'condition' | 'die' | 'enter' | 'counter' | 'remove-counter' | 'cast' | 'gain-life' | 'discard' | 'move' | 'copy' | 'draw' | 'damage' | 'mana';
  subject: string;
  incarnation: number;
  count: number;
  source?: string;
  ability?: string;
  parents: string[];
  participants: string[];
  evidence: Evidence[];
  note: string;
  counterType?: string;
  snapshot?: ObjectState;
}
export interface State {
  objects: ObjectState[];
  mana: Mana | null;
  manaLots: { color: Color; remaining: number; event?: string; source?: string }[];
  turn: number;
  mainPhase: boolean | null;
  stackEmpty: boolean | null;
  priority: boolean | null;
  library: number | null;
  libraryOrder?: (string | null)[];
  unknownHand: number;
  life: number;
  opponentLife: number;
  entryCounters: { source: string; count: number; turn: number }[];
  events: Event[];
  payoff: Payoff;
  spent: ResourceSpend;
  assumptions: string[];
}
export interface Action { kind: 'cast' | 'activate'; instance: string; ability?: string; mayhem?: boolean; counterSource?: string; discard?: string; sacrifice?: string; flashback?: boolean; putBack?: (TargetRef | null)[]; targets?: Record<string, TargetRef[]> }
export interface Check { requirement: string; result: true | false | 'unknown'; role?: 'required' | 'branch'; evidence?: Evidence }
export interface Proof {
  status: Status;
  executable: 'now' | 'unknown' | 'unavailable';
  action: Action;
  checks: Check[];
  prerequisites: string[];
  participants: string[];
  evidence: Evidence[];
  assumptions: string[];
  events: Event[];
  dependencies: string[];
  terminal?: State;
  complete: boolean;
  searchTruncated?: boolean;
  boundTargets?: Record<string, TargetRef[]>;
}
export interface Limits { depth: number; states: number; branches: number; automaticSteps: number; proofs: number }
export interface Discovery {
  proofs: Proof[];
  paths: { actions: Action[]; proof: Proof }[];
  explored: number;
  truncated: boolean;
  reasons: string[];
  rejections: { action: Action; status: Status; prerequisites: string[] }[];
  coverage: { abilities: number; unsupported: { name: string; lines: string[] }[]; deferred: { name: string; lines: string[] }[] };
}
export interface CardPlacement { card: CardMetadata; zone: Zone; id?: string; counters?: Record<string, number>; tapped?: boolean; ready?: boolean; controller?: 'you' | 'opponent'; owner?: 'you' | 'opponent' }
export const emptyMana = (): Mana => ({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
export const DEFAULT_LIMITS: Limits = { depth: 4, states: 2000, branches: 32, automaticSteps: 128, proofs: 50 };
