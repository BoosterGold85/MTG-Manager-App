import {analyze,cardIdentity} from "../src/intelligence/tagger";
import {emptyCollection} from "../src/models/collection";
import type {CardMetadata,CollectionState} from "../src/models/collection";
import type {Deck} from "../src/models/deck";
import {sol} from "./importFixtures";
import {synergyFixture} from "./synergyFixtures";
// Synthetic legalities isolate mechanics; this is not a real tournament deck or quality benchmark.
export function standardFixture(){
 let n=0;
 const make=(name:string,typeLine:string,oracleText:string,manaValue=2):CardMetadata=>({name,typeLine,oracleText,manaValue,colorIdentity:["W"],manaCost:"{1}{W}",rarity:"common",scryfallId:`standard-card-${++n}`,oracleId:`standard-oracle-${n}`,setCode:"tst",collectorNumber:String(n),imageUrl:sol.imageUrl,legalities:{standard:"legal"},legalityCheckedAt:new Date().toISOString()});
 const land=make("Test Plains","Basic Land — Plains","{T}: Add {W}.",0);land.producedMana=["W"];
 const bodies=Array.from({length:8},(_,i)=>make(`Test value body ${i}`,"Creature — Soldier","When this creature enters, draw a card."));
 const weak=make("Test slow spell","Sorcery","Scry 1.",5);
 const candidate=make("Test reusable blink","Enchantment","At the beginning of your end step, exile target creature you control, then return that card to the battlefield under its owner's control.",3);
 const state:CollectionState={...emptyCollection(),revision:1,metadata:Object.fromEntries([land,...bodies,weak,candidate].map(c=>[c.scryfallId,c]))};
 const now=new Date().toISOString();
 const deck:Deck={id:"standard-test",name:"Standard test",format:"standard",commanders:[],entries:[{id:"land",board:"main",quantity:24,name:land.name,cardIdentity:land.oracleId!,scryfallId:land.scryfallId,basicLand:true},...bodies.map((c,i)=>({id:`body-${i}`,board:"main" as const,quantity:4,name:c.name,cardIdentity:c.oracleId!,scryfallId:c.scryfallId})),{id:"weak",board:"main",quantity:3,name:weak.name,cardIdentity:weak.oracleId!,scryfallId:weak.scryfallId},{id:"blink-main",board:"main",quantity:1,name:candidate.name,cardIdentity:candidate.oracleId!,scryfallId:candidate.scryfallId},{id:"blink-side",board:"sideboard",quantity:1,name:candidate.name,cardIdentity:candidate.oracleId!,scryfallId:candidate.scryfallId}],assignments:[{itemId:"blink-owned",entryId:"blink-main",quantity:1},{itemId:"blink-owned",entryId:"blink-side",quantity:1},{itemId:"weak-owned",entryId:"weak",quantity:3}],createdAt:now,modifiedAt:now};
 const owned=synergyFixture().owned;
 const a=owned(candidate,"blink-owned",6);a.quantityAssigned=2;a.quantityUnassigned=4;
 const b=owned(weak,"weak-owned",3);b.quantityAssigned=3;b.quantityUnassigned=0;
 state.items=[a,b];state.decks=[deck];state.intelligence={auto:Object.fromEntries(Object.values(state.metadata).map(c=>[cardIdentity(c),analyze(c)])),overrides:{}};return {state,deck,candidate,weak,land,bodies};
}
