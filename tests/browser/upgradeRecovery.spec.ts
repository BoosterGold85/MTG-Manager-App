import {test,expect} from "@playwright/test";
import {legacyFixture} from "../legacyFixture";
import {standardFixture} from "../standardFixture";
import {seed,readState} from "./workspaceHelpers";
import {analyze,cardIdentity} from "../../src/intelligence/tagger";
import type {CardMetadata} from "../../src/models/collection";
type Fixture=ReturnType<typeof legacyFixture>;
function own(f:Fixture,card:CardMetadata,id=card.scryfallId){
 f.state.metadata[card.scryfallId]=card;
 f.state.items.push({...f.state.items[0],id,scryfallId:card.scryfallId,setCode:card.setCode,collectorNumber:card.collectorNumber || "",quantityOwned:1,quantityAssigned:0,quantityUnassigned:1});
 f.state.intelligence!.auto[cardIdentity(card)]=analyze(card);
}
function raw(c:CardMetadata){return {object:"card",id:c.scryfallId,oracle_id:c.oracleId,name:c.name,set:c.setCode,collector_number:c.collectorNumber,type_line:c.typeLine,cmc:c.manaValue,color_identity:c.colorIdentity,mana_cost:c.manaCost,oracle_text:c.oracleText,rarity:c.rarity,image_uris:{normal:c.imageUrl},legalities:{legacy:"legal",standard:"legal"}};}
for(const format of ["Standard","Legacy"]as const)test(`${format} upgrade images open shared detail with filtered navigation and no writes`,async({page})=>{
 const f=format==="Legacy"?legacyFixture():standardFixture();let calls=0;
 await page.route("**/api/scryfall/**",async route=>{calls++;await route.abort();});
 await seed(page,f.state,f.deck.name,"Upgrades");const panel=page.getByRole("region",{name:`${format} Upgrades`,exact:true});
 await expect(panel.getByRole("status",{name:"Upgrade catalog"})).toContainText("2 eligible owned printings");
 await panel.getByRole("searchbox",{name:`Search ${format} upgrades`}).fill("Test");
 const before=await readState(page);await page.context().setOffline(true);
 await panel.getByRole("button",{name:`View ${f.candidate.name} details`,exact:true}).click();
 const dialog=page.getByRole("dialog");await expect(dialog.getByRole("heading",{name:f.candidate.name,exact:true})).toBeVisible();await expect(dialog.locator(".oracle-text")).toContainText("exile target creature");
 await expect(dialog).toContainText("1 of 2");await dialog.getByRole("button",{name:"Next card",exact:true}).click();await expect(dialog.getByRole("heading",{name:f.weak.name,exact:true})).toBeVisible();
 await dialog.getByRole("button",{name:"Previous card",exact:true}).click();await expect(dialog.getByRole("heading",{name:f.candidate.name,exact:true})).toBeVisible();
 await dialog.getByRole("button",{name:"Close dialog",exact:true}).click();await expect(panel.getByRole("searchbox")).toHaveValue("Test");expect(await readState(page)).toEqual(before);expect(calls).toBe(0);
});
test("interrupted legality keeps successful statuses and retries remaining printings without changing ownership",async({page})=>{
 test.setTimeout(90000);const f=legacyFixture();
 for(let i=0;i<151;i++)own(f,{...f.candidate,scryfallId:`check-${i}`,oracleId:`check-oracle-${i}`,name:`Unchecked owned ${String(i).padStart(3,"0")}`,manaCost:"{1}",colorIdentity:[],typeLine:"Artifact",oracleText:"{T}: Add {C}.",legalityCheckedAt:undefined});
 let fail=true,retrying=false;const firstBatch:string[]=[],retryIds:string[]=[];
 await page.route("**/api/scryfall/cards/collection",async route=>{
  const ids=(route.request().postDataJSON().identifiers as {id:string}[]).map(i=>i.id);
  if(!firstBatch.length)firstBatch.push(...ids);if(retrying)retryIds.push(...ids);
  if(fail&&ids.some(id=>!firstBatch.includes(id))){await route.fulfill({status:503,json:{object:"error",code:"unavailable"}});return;}
  await route.fulfill({json:{data:ids.map(id=>raw(f.state.metadata[id]))}});
 });
 await seed(page,f.state,f.deck.name,"Upgrades");const panel=page.getByRole("region",{name:"Legacy Upgrades",exact:true}),before=await readState(page);
 await panel.getByRole("button",{name:"Check owned-card legality",exact:true}).click();
 await expect(panel.getByRole("alert")).toContainText("paused after 75",{timeout:30000});
 const partial=await readState(page);expect(partial.items).toEqual(before.items);expect(partial.decks).toEqual(before.decks);expect(firstBatch.every(id=>!!partial.metadata[id].legalityCheckedAt)).toBe(true);
 await panel.getByRole("button",{name:"Browse all owned cards",exact:true}).click();await expect(panel.getByRole("combobox",{name:"Legacy browsing scope"})).toHaveValue("owned");
 await panel.getByRole("searchbox").fill("Unchecked owned 100");await panel.getByRole("button",{name:"View Unchecked owned 100 details",exact:true}).click();await expect(page.getByRole("dialog").locator(".oracle-text")).toContainText("Add {C}");await page.getByRole("button",{name:"Close dialog",exact:true}).click();
 await panel.getByRole("searchbox").fill("");fail=false;retrying=true;await panel.getByRole("button",{name:"Retry remaining cards",exact:true}).click();
 await expect(panel.getByRole("status",{name:"Legality check progress"})).toContainText("0 remaining",{timeout:30000});await expect(panel.getByRole("alert")).toHaveCount(0);
 expect(retryIds.length).toBeGreaterThan(0);expect(retryIds.some(id=>firstBatch.includes(id))).toBe(false);
 const after=await readState(page);expect(after.items).toEqual(before.items);expect(after.decks).toEqual(before.decks);expect(Object.keys(after.metadata).every(id=>!!after.metadata[id].legalityCheckedAt)).toBe(true);
});
test("legal browsing includes lands, mana-review and capped cards while unknown/banned cards stay browse-only",async({page})=>{
 const f=legacyFixture();own(f,f.land,"owned-land");own(f,f.bodies[0],"at-limit");
 own(f,{...f.candidate,scryfallId:"blue-owned",oracleId:"blue-owned",name:"Blue owned spell",manaCost:"{U}"});
 own(f,{...f.candidate,scryfallId:"banned-owned",oracleId:"banned-owned",name:"Banned owned spell",legalities:{legacy:"banned"}});
 own(f,{...f.candidate,scryfallId:"unknown-owned",oracleId:"unknown-owned",name:"Unknown owned spell",legalityCheckedAt:undefined});
 await seed(page,f.state,f.deck.name,"Upgrades");const panel=page.getByRole("region",{name:"Legacy Upgrades",exact:true});
 await expect(panel.getByRole("status",{name:"Upgrade catalog"})).toContainText("5 legal owned printings");const before=await readState(page);
 for(const name of [f.land.name,f.bodies[0].name,"Blue owned spell"]){await expect(panel.getByRole("button",{name:`View ${name} details`,exact:true})).toBeVisible();await expect(panel.getByRole("button",{name:`Compare ${name}`,exact:true})).toHaveCount(0);}
 await panel.getByRole("combobox",{name:"Legacy browsing scope"}).selectOption("owned");
 await expect(panel.getByRole("button",{name:"View Banned owned spell details",exact:true})).toBeVisible();await expect(panel.getByRole("button",{name:"Compare Banned owned spell",exact:true})).toHaveCount(0);
 await panel.getByRole("button",{name:"View Unknown owned spell details",exact:true}).click();await expect(page.getByRole("dialog")).toContainText("Legality unverified");await page.getByRole("button",{name:"Close dialog",exact:true}).click();
 await panel.getByRole("combobox",{name:"Legacy browsing scope"}).selectOption("compare");await expect(panel.locator(".upgrade-card")).toHaveCount(2);expect(await readState(page)).toEqual(before);
});
test("more than thirty legal owned cards remain searchable and readable beyond the rendered page",async({page})=>{
 const f=legacyFixture();for(let i=0;i<45;i++)own(f,{...f.candidate,scryfallId:`browse-${i}`,oracleId:`browse-oracle-${i}`,name:`Owned library ${String(i).padStart(3,"0")}`,manaCost:"{U}"});
 await seed(page,f.state,f.deck.name,"Upgrades");const panel=page.getByRole("region",{name:"Legacy Upgrades",exact:true});
 await expect(panel.getByRole("status",{name:"Upgrade catalog"})).toContainText("47 legal owned printings");await expect(panel.locator(".upgrade-card")).toHaveCount(30);
 const before=await readState(page);await panel.getByRole("button",{name:"Show more",exact:true}).click();await expect(panel.locator(".upgrade-card")).toHaveCount(47);
 await panel.getByRole("searchbox").fill("Owned library 044");await expect(panel.locator(".upgrade-card")).toHaveCount(1);
 await panel.getByRole("button",{name:"View Owned library 044 details",exact:true}).click();const dialog=page.getByRole("dialog");await expect(dialog.getByRole("heading",{name:"Owned library 044",exact:true})).toBeVisible();await expect(dialog.getByRole("button",{name:"Next card",exact:true})).toBeDisabled();
 const {default:AxeBuilder}=await import("@axe-core/playwright");expect((await new AxeBuilder({page}).include("dialog[open]").analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await dialog.getByRole("button",{name:"Close dialog",exact:true}).click();expect(await readState(page)).toEqual(before);
});
