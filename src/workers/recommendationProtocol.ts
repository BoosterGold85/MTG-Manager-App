import type { CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import { RULESET_VERSION } from "../intelligence/types";
import { RANKING_VERSION } from "../synergy/deckSpecific";
import { analysisConfidence, brewCandidates, buildAroundCommander, improveCurrentDeck, commanderBlueprint } from "../upgrades";
export interface AnalysisRequest {
  id: number;
  revision: string;
  semanticVersion: string;
  rankingVersion: string;
  mode: "build" | "improve";
  includeRelationships: boolean;
  state: CollectionState;
  deck: Deck;
}
/** Pure analysis only: no repository, network client or ownership writer. */
export function computeRecommendations(request: AnalysisRequest) {
  if(request.semanticVersion!==RULESET_VERSION || request.rankingVersion!==RANKING_VERSION)throw new Error("Analysis version mismatch; reload the app.");
  const {state,deck,mode}=request;
  return {
    blueprint: commanderBlueprint(state,deck),
    candidates: mode==="build"?buildAroundCommander(state,deck):improveCurrentDeck(state,deck),
    relationships: request.includeRelationships?brewCandidates(state,deck):null,
    confidence: request.includeRelationships?analysisConfidence(state,deck).level:"High" as const,
  };
}
export type AnalysisResult=ReturnType<typeof computeRecommendations>;
export type AnalysisResponse={id:number;revision:string;result:AnalysisResult}|{id:number;revision:string;error:string};
