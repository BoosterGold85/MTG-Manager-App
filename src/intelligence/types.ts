import type { CardMetadata } from '../models/collection';
export type Category = 'strategy' | 'mechanic' | 'role' | 'resource' | 'payoff' | 'enabler' | 'interaction';
export interface TagDefinition { id: string; label: string; category: Category; description: string; aliases?: string[] }
export interface Evidence { field: string; snippet: string; reason: string; face?: string }
export interface Assignment {
  cardIdentity: string; tagId: string; source: 'rule' | 'derived' | 'manual-add' | 'manual-remove';
  confidence: number; evidence: Evidence[]; rulesetVersion: string;
}
export interface CreatureTypeSignals { own: string[]; referenced: string[]; synergy: string[] }
export interface AutoAnalysis { inputFingerprint?: string; cardIdentity: string; rulesetVersion: string; assignments: Assignment[]; creatureTypes: CreatureTypeSignals }
export interface Override { added: string[]; suppressed: string[]; assignments?: Assignment[] }
export interface IntelligenceState { auto: Record<string, AutoAnalysis>; overrides: Record<string, Override> }
export interface RuleContext { card: CardMetadata; text: string; type: string; field: string; face?: string; keywords: string[] }
export interface Hit { tagId: string; reason: string; snippet: string; source?: 'rule' | 'derived'; confidence?: number; field?: string }
export type Rule = (context: RuleContext) => Hit[];
// Extension boundary only: no remote provider is shipped or called.
export interface IntelligenceProvider { analyze(card: CardMetadata): AutoAnalysis }
export const RULESET_VERSION = '0.3.2';
