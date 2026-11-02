import {test,expect} from "@playwright/test";
import {legacyFixture} from "../legacyFixture";
import {seed,readState} from "./workspaceHelpers";
import {analyze,cardIdentity} from "../../src/intelligence/tagger";
test("a reloaded partial check resumes only saved-unverified printings",async({page})=>{
 const f=legacyFixture(),expected:string[]=[],requested:string[]=[];
 for(let i=0;i<20;i++){
  const card={...f.candidate,scryfallId:`reload-${i}`,oracleId:`reload-oracle-${i}`,name:`Reload owned ${i}`,legalityCheckedAt:i<10?new Date().toISOString():undefined};
  f.state.metadata[card.scryfallId]=card;f.state.items.push({...f.state.items[0],id:card.scryfallId,scryfallId:card.scryfallId,quantityOwned:1,quantityAssigned:0,quantityUnassigned:1});f.state.intelligence!.auto[cardIdentity(card)]=analyze(card);
  if(i>=10)expected.push(card.scryfallId);
 }
 await page.route("https://api.scryfall.com/cards/collection",async route=>{
  const ids=(route.request().postDataJSON().identifiers as {id:string}[]).map(i=>i.id);requested.push(...ids);
  await route.fulfill({json:{data:ids.map(id=>{const c=f.state.metadata[id];return {object:"card",id,oracle_id:c.oracleId,name:c.name,set:c.setCode,collector_number:c.collectorNumber,type_line:c.typeLine,cmc:c.manaValue,color_identity:c.colorIdentity,mana_cost:c.manaCost,oracle_text:c.oracleText,rarity:c.rarity,image_uris:{normal:c.imageUrl},legalities:{legacy:"legal",standard:"not_legal"}};})}});
 });
 await seed(page,f.state,f.deck.name,"Upgrades");await page.reload();
 const panel=page.getByRole("region",{name:"Legacy Upgrades",exact:true});await expect(panel.getByRole("status",{name:"Upgrade catalog"})).toContainText("10 unverified/stale");const before=await readState(page);
 await panel.getByRole("button",{name:"Check unverified / stale only",exact:true}).click();await expect(panel.getByRole("status",{name:"Legality check progress"})).toContainText("0 remaining");
 expect(requested).toEqual(expected);const after=await readState(page);expect(after.items).toEqual(before.items);expect(after.decks).toEqual(before.decks);
});
