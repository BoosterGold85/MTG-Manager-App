import type { CardMetadata } from '../../models/collection';
import type { Mana, Zone } from './model';
import type { AnalyzerResult } from './analyze';
export const ANALYZER_VERSION = '0.6.26-experimental.2';
export const ANALYZER_BOUNDS = Object.freeze({ cards: 500, bytes: 1024 * 1024, selected: 3, timeoutMs: 8000, depth: 3, states: 200, branches: 12, proofs: 12, automaticSteps: 48 });
export interface AnalyzerRequest { id: string; revision: string; version: string; cards: CardMetadata[]; copies?: Record<string, number>; selected: { id: string; zone: Zone }[]; mana: Mana; library: number; removeId?: string; mode?: 'catalog' | 'scenario' | 'deck-candidates' }
export type AnalyzerResponse = { id: string; revision: string; version: string; result: AnalyzerResult } | { id: string; revision: string; version: string; error: string };
export function byteSize(value: unknown): number { return new TextEncoder().encode(JSON.stringify(value)).byteLength; }
