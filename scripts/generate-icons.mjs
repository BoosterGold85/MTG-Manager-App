// Maintainer-only asset generation. Production builds use the committed outputs.
import { Buffer } from 'node:buffer';
import process from 'node:process';
import console from 'node:console';
import { URL } from 'node:url';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const tokens=await readFile(new URL('../src/styles/tokens.css',import.meta.url),'utf8');
function color(name) {
 const value=tokens.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
 if(!value) throw Error(`Missing icon color ${name}`);return value;
}
const background=color('--color-obsidian-olive'),gold=color('--color-antique-gold');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${background}"/><path d="M256 80 416 256 256 432 96 256Z" fill="none" stroke="${gold}" stroke-width="22" stroke-linejoin="round"/></svg>\n`;
const output=new URL('../public/icons/',import.meta.url);await mkdir(output,{recursive:true});
await writeFile(new URL('../public/favicon.svg',import.meta.url),svg);
await writeFile(new URL('app-icon.svg',output),svg);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
const buffers=new Map();
try {
 for(const size of [16,32,48,180,192,512,1024]) {
  const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  const bytes=await page.screenshot({path:new URL(`icon-${size}.png`,output).pathname});buffers.set(size,bytes);await page.close();
 }
} finally {await browser.close();}
// Modern ICO: three PNG-compressed frames, no imaging dependency required.
const sizes=[16,32,48],header=Buffer.alloc(6);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
let offset=6+16*sizes.length;const directory=[],images=[];
for(const size of sizes) {
 const bytes=buffers.get(size),entry=Buffer.alloc(16);entry[0]=size;entry[1]=size;entry.writeUInt16LE(1,4);entry.writeUInt16LE(32,6);entry.writeUInt32LE(bytes.length,8);entry.writeUInt32LE(offset,12);offset+=bytes.length;directory.push(entry);images.push(bytes);
}
await writeFile(new URL('../public/favicon.ico',import.meta.url),Buffer.concat([header,...directory,...images]));
const manifest={id:'/',name:'MTG Manager',short_name:'MTG Manager',description:'Your collection, beautifully kept. A premium digital Magic binder.',lang:'en',start_url:'/',scope:'/',display:'standalone',background_color:background,theme_color:background,icons:[
 {src:'/icons/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},
 {src:'/icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},
 {src:'/icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'},
]};
await writeFile(new URL('../public/manifest.webmanifest',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
const htmlPath=new URL('../index.html',import.meta.url);let html=await readFile(htmlPath,'utf8');
html=html.replace(/(<meta name="theme-color" content=")[^"]+("\s*\/>)/,`$1${background}$2`);await writeFile(htmlPath,html);
console.log('Generated SVG, ICO, 16/32/48/180/192/512/1024 PNGs and matching manifest from brand tokens.');
