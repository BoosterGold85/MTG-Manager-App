import {analyze} from './analyze';
import type {AnalyzerRequest} from './analyze';
self.onmessage=(event:MessageEvent<AnalyzerRequest>)=>{try{self.postMessage({id:event.data.id,revision:event.data.revision,result:analyze(event.data)});}catch(error){self.postMessage({id:event.data?.id,revision:event.data?.revision,error:error instanceof Error?error.message:'Analysis failed.'});}};
