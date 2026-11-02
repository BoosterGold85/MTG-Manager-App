import type {Page} from "@playwright/test";
import {test,expect} from "@playwright/test";
import {standardFixture} from "../standardFixture";
import {seed,readState} from "./workspaceHelpers";

async function mockLegality(page:Page,f:ReturnType<typeof standardFixture>,status="legal"){
 await page.route("https://api.scryfall.com/cards/collection",async route=>{
  const ids=(route.request().postDataJSON().identifiers as {id:string}[]).map(i=>i.id);
  await route.fulfill({json:{object:"list",data:ids.map(id=>{const c=f.state.metadata[id];return {object:"card",id,oracle_id:c.oracleId,name:c.name,set:c.setCode,collector_number:c.collectorNumber,cmc:c.manaValue,color_identity:c.colorIdentity,type_line:c.typeLine,rarity:c.rarity,mana_cost:c.manaCost,oracle_text:c.oracleText,image_uris:{normal:c.imageUrl},legalities:{standard:status}};})}});
 });
}
test("Standard compares two-copy changes before one confirmed atomic save",async({page})=>{
 const f=standardFixture();let workers=0;page.on("worker",w=>{if(/\/worker[-.]/.test(w.url()))workers++;});
 await seed(page,f.state,f.deck.name,"Upgrades");
 const panel=page.getByRole("region",{name:"Standard Upgrades",exact:true});
 await expect(panel.getByRole("status")).toContainText("2 eligible owned printings");
 await mockLegality(page,f);
 const before=await readState(page),started=workers;
 await panel.getByRole("searchbox",{name:"Search Standard upgrades"}).fill("reusable blink");
 await panel.getByRole("combobox",{name:"Standard ranking"}).selectOption("brew");
 await expect(panel.locator(".upgrade-card")).toHaveCount(1);expect(workers).toBe(started);
 await panel.getByRole("button",{name:"Compare Test reusable blink",exact:true}).click();
 const dialog=page.getByRole("dialog");
 await dialog.getByRole("combobox",{name:"Replace main-deck entry"}).selectOption("weak");
 await dialog.getByRole("spinbutton",{name:"Copies to change"}).fill("2");
 await expect(dialog.getByText(/Upgrade Value:/)).toBeVisible();
 await expect(dialog).toContainText("main-deck copies 1 → 3");
 expect(await readState(page)).toEqual(before);
 await dialog.getByRole("button",{name:"Confirm Standard change",exact:true}).click();
 await expect(dialog).toHaveCount(0);
 const after=await readState(page),deck=after.decks!.find(d=>d.id===f.deck.id)!;
 expect(deck.entries!.filter(e=>e.board==="main").reduce((n,e)=>n+e.quantity,0)).toBe(60);
 expect(deck.entries!.find(e=>e.id==="blink-main")!.quantity).toBe(3);expect(deck.entries!.find(e=>e.id==="weak")!.quantity).toBe(1);
 expect(deck.entries!.filter(e=>e.board==="sideboard")).toEqual(f.deck.entries!.filter(e=>e.board==="sideboard"));
 expect(after.items.map(i=>i.quantityOwned)).toEqual(before.items.map(i=>i.quantityOwned));
 await page.reload();expect((await readState(page)).decks![0].entries!.find(e=>e.id==="blink-main")!.quantity).toBe(3);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test("allocated copies remain visible but can never be taken from another deck",async({page})=>{
 const f=standardFixture();f.state.items[0].quantityOwned=4;f.state.items[0].quantityAssigned=4;f.state.items[0].quantityUnassigned=0;
 f.state.decks!.push({...f.deck,id:"other",name:"Other deck",entries:[{id:"other-entry",board:"main",quantity:2,name:f.candidate.name,cardIdentity:f.candidate.oracleId!,scryfallId:f.candidate.scryfallId}],assignments:[{itemId:"blink-owned",entryId:"other-entry",quantity:2}]});
 await seed(page,f.state,f.deck.name,"Upgrades");const panel=page.getByRole("region",{name:"Standard Upgrades",exact:true});
 await expect(panel.getByRole("status")).toContainText("2 eligible owned printings");
 const before=await readState(page);await expect(panel).toContainText("Other deck (2)");
 await panel.getByRole("combobox",{name:"Standard availability"}).selectOption("available");await expect(panel.getByRole("button",{name:"Compare Test reusable blink",exact:true})).toHaveCount(0);
 await panel.getByRole("combobox",{name:"Standard availability"}).selectOption("all");
 await panel.getByRole("button",{name:"Compare Test reusable blink",exact:true}).click();
 const dialog=page.getByRole("dialog");await dialog.getByRole("combobox",{name:"Replace main-deck entry"}).selectOption("weak");
 await expect(dialog.getByText(/Upgrade Value:/)).toBeVisible();
 await expect(dialog.getByRole("button",{name:"Confirm Standard change",exact:true})).toBeDisabled();
 await dialog.getByRole("button",{name:"Cancel",exact:true}).click();expect(await readState(page)).toEqual(before);
});
test("unverified candidates require an explicit fresh check without changing ownership",async({page})=>{
 const f=standardFixture();delete f.candidate.legalities;delete f.candidate.legalityCheckedAt;
 let calls=0;await page.route("https://api.scryfall.com/cards/collection",async route=>{
  calls++;const ids=(route.request().postDataJSON().identifiers as {id:string}[]).map(i=>i.id);
  await route.fulfill({json:{object:"list",data:ids.map(id=>{const c=f.state.metadata[id];return {object:"card",id,oracle_id:c.oracleId,name:c.name,set:c.setCode,collector_number:c.collectorNumber,cmc:c.manaValue,color_identity:c.colorIdentity,type_line:c.typeLine,rarity:c.rarity,mana_cost:c.manaCost,oracle_text:c.oracleText,image_uris:{normal:c.imageUrl},legalities:{standard:"legal"}};})}});
 });
 await seed(page,f.state,f.deck.name,"Upgrades");const panel=page.getByRole("region",{name:"Standard Upgrades",exact:true});
 await expect(panel.getByRole("status")).toContainText("1 unverified/stale");
 await expect(panel.getByRole("button",{name:"Compare Test reusable blink",exact:true})).toHaveCount(0);expect(calls).toBe(0);
 const before=await readState(page);await panel.getByRole("button",{name:"Check owned-card legality",exact:true}).click();
 await expect(panel.getByRole("button",{name:"Compare Test reusable blink",exact:true})).toBeVisible();expect(calls).toBe(1);
 const after=await readState(page);expect(after.items).toEqual(before.items);expect(after.decks).toEqual(before.decks);
});
test("large Standard analysis keeps controls responsive and stops on navigation",async({page},testInfo)=>{
 test.setTimeout(60000);
 const {analyze,cardIdentity}=await import("../../src/intelligence/tagger");
 const {synergyFixture}=await import("../synergyFixtures");
 const f=standardFixture();
 for(let i=0;i<3000;i++){
  const card={...f.candidate,name:`Cold Standard probe ${i}`,scryfallId:`cold-standard-${i}`,oracleId:`cold-oracle-${i}`};
  f.state.metadata[card.scryfallId]=card;f.state.items.push(synergyFixture().owned(card,`cold-owned-${i}`,1));f.state.intelligence!.auto[cardIdentity(card)]=analyze(card);
 }
 await seed(page,f.state,f.deck.name,"Cards");let workers=0;page.on("worker",w=>{if(/\/worker[-.]/.test(w.url()))workers++;});
 await page.getByRole("navigation",{name:"Deck sections"}).getByRole("button",{name:"Upgrades",exact:true}).click();
 const panel=page.getByRole("region",{name:"Standard Upgrades",exact:true});await expect(panel.getByRole("status")).toContainText("Analyzing");
 const start=Date.now();await panel.getByRole("searchbox",{name:"Search Standard upgrades"}).fill("Cold Standard",{timeout:2000});
 await panel.getByRole("combobox",{name:"Standard ranking"}).selectOption("brew",{timeout:2000});
 await expect(panel.getByRole("searchbox",{name:"Search Standard upgrades"})).toHaveValue("Cold Standard");
 await page.getByRole("navigation",{name:"Deck sections"}).getByRole("button",{name:"Cards",exact:true}).click({timeout:2000});
 await expect(panel).toHaveCount(0);await expect.poll(()=>page.workers().filter(w=>/\/worker[-.]/.test(w.url())).length).toBe(0);expect(workers).toBe(1);
 await testInfo.attach("standard-worker-responsiveness.json",{body:JSON.stringify({syntheticCandidateIdentities:3000,interactionMs:Date.now()-start,physicalPhone:false}),contentType:"application/json"});
});

test("a newly banned printing fails closed at confirmation without saving",async({page})=>{
 const f=standardFixture();await mockLegality(page,f,"banned");
 await seed(page,f.state,f.deck.name,"Upgrades");
 await page.getByRole("button",{name:"Compare Test reusable blink",exact:true}).click();
 const dialog=page.getByRole("dialog");await dialog.getByRole("combobox",{name:"Replace main-deck entry"}).selectOption("weak");
 await expect(dialog.getByText(/Upgrade Value:/)).toBeVisible();const before=await readState(page);
 await dialog.getByRole("button",{name:"Confirm Standard change",exact:true}).click();
 await expect(dialog.getByRole("alert")).toContainText("not currently verified Standard legal");
 expect(await readState(page)).toEqual(before);
});
test("Standard catalog and review preserve accessibility and mobile layout",async({page},testInfo)=>{
 const {default:AxeBuilder}=await import("@axe-core/playwright");
 const f=standardFixture();await seed(page,f.state,f.deck.name,"Upgrades");
 const panel=page.getByRole("region",{name:"Standard Upgrades",exact:true});await expect(panel.getByRole("status")).toContainText("2 eligible owned printings");
 expect((await new AxeBuilder({page}).include('[aria-label="Standard Upgrades"]').analyze()).violations).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath("standard-upgrades.png"),fullPage:true});
 await panel.getByRole("button",{name:"Compare Test reusable blink",exact:true}).click();const dialog=page.getByRole("dialog");
 await dialog.getByRole("combobox",{name:"Replace main-deck entry"}).selectOption("weak");await expect(dialog.getByText(/Upgrade Value:/)).toBeVisible();
 expect((await new AxeBuilder({page}).include("dialog[open]").analyze()).violations).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath("standard-review.png"),fullPage:true});
});
