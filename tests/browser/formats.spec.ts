import { test,expect } from "@playwright/test";
import { emptyCollection } from "../../src/models/collection";
import { metadata,sol } from "../importFixtures";
import { synergyFixture } from "../synergyFixtures";
import { writeState,readState,section } from "./workspaceHelpers";
import type { Page } from "@playwright/test";
async function setup(page:Page){
 const state={...emptyCollection(),revision:1,metadata:structuredClone(metadata)};
 state.items.push(synergyFixture().owned(state.metadata[sol.scryfallId],"format-ring",6));
 await page.goto("/");await expect(page.locator(".card-tile")).toHaveCount(32);
 await writeState(page,state);await page.reload();
 await page.getByRole("navigation").filter({visible:true}).getByRole("button",{name:"Decks",exact:true}).click();
 return state;
}
for(const format of ["standard","legacy"]as const)test(`${format} import preserves main/sideboard and ownership without a commander`,async({page})=>{
 await setup(page);
 await page.getByRole("button",{name:"Import Deck",exact:true}).click();
 await page.getByLabel("Deck format",{exact:true}).selectOption(format);
 await page.getByRole("button",{name:"Paste decklist text",exact:true}).click();
 await page.getByRole("textbox",{name:"Decklist text"}).fill("Deck\n56 Forest\n4 Sol Ring\nSideboard\n1 Sol Ring\n14 Forest");
 await page.getByRole("button",{name:"Preview import",exact:true}).click();
 await expect(page.getByRole("textbox",{name:"Deck name",exact:true})).toBeVisible();
 await page.getByRole("textbox",{name:"Deck name",exact:true}).fill(`${format} test`);
 await expect(page.getByRole("region",{name:"Commander selection"})).toHaveCount(0);
 await page.getByRole("button",{name:"Confirm import",exact:true}).click();
 await expect(page.getByRole("heading",{name:`${format} test`,exact:true})).toBeVisible();
 await expect(page.locator(".deck-header-status")).toContainText("60 cards");
 await expect(page.locator(".deck-header-status")).toContainText("15 sideboard");
 const saved=await readState(page),deck=saved.decks!.find(d=>d.name===`${format} test`)!;
 expect(deck.format).toBe(format);expect(deck.commanders).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 expect(saved.items[0].quantityOwned).toBe(6);expect(saved.items[0].quantityAssigned).toBe(5);
 await expect(page.getByRole("region",{name:"Format legality"})).toContainText("5 copies across main deck and sideboard");
 await section(page,"Cards");await page.getByLabel("Board",{exact:true}).selectOption("sideboard");
 await expect(page.locator(".deck-owned-grid article")).toHaveCount(2);
 await expect(page.locator(".deck-owned-grid")).toContainText("Sideboard");
 // Explicit fresh lookup uses saved canonical IDs and changes metadata only.
 await section(page,"Overview");
 await page.route("**/api/scryfall/cards/collection",async route=>{
  const ids=(route.request().postDataJSON().identifiers as {id:string}[]).map(i=>i.id);
  await route.fulfill({json:{object:"list",data:ids.map(id=>{const c=metadata[id];return {object:"card",id,oracle_id:c.oracleId,name:c.name,set:c.setCode,collector_number:c.collectorNumber,cmc:c.manaValue,color_identity:c.colorIdentity,type_line:c.typeLine,rarity:c.rarity,oracle_text:c.oracleText,image_uris:{normal:c.imageUrl},legalities:{standard:c.name==="Sol Ring"?"not_legal":"legal",legacy:c.name==="Sol Ring"?"banned":"legal"}};})}});
 });
 const before=await readState(page);
 await page.getByRole("button",{name:"Check format legality",exact:true}).click();
 await expect(page.getByRole("region",{name:"Format legality"})).toContainText(format==="legacy"?"banned in Legacy":"not legal in Standard");
 expect((await readState(page)).items).toEqual(before.items);
 // Removing a Sideboard printing must leave its Main-deck copies in place.
 await section(page,"Cards");
 await page.getByRole("button",{name:"Open Sol Ring details",exact:true}).click();
 await page.getByRole("button",{name:"Remove one Sol Ring",exact:true}).click();
 const removed=await readState(page),updated=removed.decks!.find(d=>d.name===`${format} test`)!;
 expect(updated.entries!.find(e=>e.name==="Sol Ring"&&e.board==="main")!.quantity).toBe(4);
 expect(removed.items[0].quantityAssigned).toBe(4);
 await page.getByRole("button",{name:"Open Forest details",exact:true}).click();
 await page.getByRole("button",{name:"Remove one Forest",exact:true}).click();
 await expect(page.locator(".deck-header-status")).toContainText("13 sideboard");
 await page.reload();await expect(page.locator(".deck-header-status")).toContainText("13 sideboard");
 expect((await readState(page)).items[0].quantityOwned).toBe(6);
});
test("creates Standard/Legacy drafts without Commander selection",async({page})=>{
 await setup(page);
 for(const format of ["standard","legacy"]as const){
  await page.getByRole("button",{name:"New Deck",exact:true}).click();
  await page.getByLabel("Deck format",{exact:true}).selectOption(format);
  await page.getByRole("textbox",{name:"Deck name",exact:true}).fill(`${format} draft`);
  await page.getByRole("button",{name:"Create deck",exact:true}).click();
  await expect(page.getByRole("heading",{name:`${format} draft`,exact:true})).toBeVisible();
  await expect(page.getByRole("navigation",{name:"Deck sections"}).getByRole("button",{name:"Upgrades",exact:true})).toHaveCount(1);
  await expect(page.getByRole("region",{name:"Format legality"})).toContainText("at least 60");
  await page.getByRole("button",{name:"All Decks",exact:true}).click();
 }
 await page.reload();expect((await readState(page)).decks!.map(d=>d.format).sort()).toEqual(["legacy","standard"]);
});

test("an empty device can create a Legacy draft without importing a collection",async({page})=>{
 await page.goto("/");await expect(page.locator(".card-tile")).toHaveCount(32);
 await page.getByRole("navigation").filter({visible:true}).getByRole("button",{name:"Decks",exact:true}).click();
 await page.getByRole("button",{name:"New Deck",exact:true}).click();
 await page.getByLabel("Deck format",{exact:true}).selectOption("legacy");
 await page.getByRole("textbox",{name:"Deck name",exact:true}).fill("Empty Legacy");
 await page.getByRole("button",{name:"Create deck",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Empty Legacy",exact:true})).toBeVisible();
 const saved=await readState(page);expect(saved.items).toEqual([]);expect(saved.decks![0].commanders).toEqual([]);
});
