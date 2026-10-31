import { computeRecommendations } from "./recommendationProtocol";
import type { AnalysisRequest, AnalysisResponse } from "./recommendationProtocol";
self.onmessage=(event:MessageEvent<AnalysisRequest>)=>{
 const request=event.data;
 try {
  const response:AnalysisResponse={id:request.id,revision:request.revision,result:computeRecommendations(request)};
  self.postMessage(response);
 }catch{
  const response:AnalysisResponse={id:request.id,revision:request.revision,error:"MTG Manager could not finish this analysis. Retry to analyze your deck again."};
  self.postMessage(response);
 }
};
