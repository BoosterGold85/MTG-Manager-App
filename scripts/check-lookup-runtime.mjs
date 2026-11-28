// Exercise the actual Cloudflare runtime; Node fetch mocks accept unsupported redirect modes.
import console from 'node:console';
const {fetch}=globalThis;
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {build} from 'esbuild';
const dir=await mkdtemp(join(tmpdir(),'mtg-lookup-runtime-'));
let child;
try{
 const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
 await build({entryPoints:[resolve('worker/index.ts')],bundle:true,format:'esm',platform:'browser',outfile:join(dir,'worker.js')});
 await writeFile(join(dir,'probe.js'),`import app from './worker.js';export default {async fetch(request,env){if(new URL(request.url).pathname==='/repro'){try{await fetch('https://api.scryfall.com/cards/collection',{redirect:'error'});return new Response('Unexpected success');}catch(e){return Response.json({message:e.message},{status:502});}}return app.fetch(request,env);}}`);
 const schema=resolve('node_modules/workerd/workerd.capnp');
 await writeFile(join(dir,'config.capnp'),`using W = import ${JSON.stringify(schema)};const config :W.Config = (services=[(name="main",worker=(modules=[(name="probe.js",esModule=embed "probe.js"),(name="worker.js",esModule=embed "worker.js")],compatibilityDate="2025-04-01",globalOutbound="upstream")),(name="upstream",worker=(modules=[(name="upstream.js",esModule="export default {fetch(r){return new URL(r.url).pathname==='/sets'?new Response(null,{status:302,headers:{Location:'https://untrusted.example/'}}):Response.json({object:'list',data:[],not_found:[]});}}")],compatibilityDate="2025-04-01"))],sockets=[(name="http",address="127.0.0.1:${port}",http=(),service="main")]);`);
 child=spawn(resolve('node_modules/.bin/workerd'),['serve','-I','/',join(dir,'config.capnp')],{stdio:['ignore','pipe','pipe']});
 let logs='';child.stderr.on('data',b=>{logs=(logs+b).slice(-8000);});child.on('error',e=>{logs+=String(e);});
 const base=`http://127.0.0.1:${port}`;let ready=false;
 for(let n=0;n<200;n++){try{const r=await fetch(base+'/api/scryfall/health');if(r.ok){ready=true;break;}}catch{/* Starting. */}if(child.exitCode!==null)break;await delay(25);}
 assert(ready,logs||'Runtime did not start');
 const original=await fetch(base+'/repro');assert.equal(original.status,502);assert.match((await original.json()).message,/Invalid redirect value/);
 const fixed=await fetch(base+'/api/scryfall/cards/collection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifiers:[{name:'Sol Ring'}]})});assert.equal(fixed.status,200);assert.equal((await fixed.json()).object,'list');
 const redirect=await fetch(base+'/api/scryfall/sets');assert.equal(redirect.status,502);assert.match((await redirect.json()).details,/was not followed/);
 console.log('PASS: workerd reproduces unsupported redirect:error; actual relay succeeds with manual; redirects remain rejected.');
}finally{if(child&&child.exitCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await exited;}await rm(dir,{recursive:true,force:true});}
