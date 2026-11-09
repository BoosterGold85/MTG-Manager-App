import {createServer} from 'vite';
import process from 'node:process';
import console from 'node:console';
const server=await createServer({configFile:false,cacheDir:"node_modules/.vite-analyzer-research",optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
try{const {run}=await server.ssrLoadModule('/research/browser-adapter/regressions.ts');console.log(JSON.stringify(run(process.argv[2]),null,2));}finally{await server.close();}
