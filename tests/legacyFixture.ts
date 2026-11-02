import {analyze,cardIdentity} from "../src/intelligence/tagger";
import {standardFixture} from "./standardFixture";
// Synthetic ownership/legality fixture: not a claimed tournament deck.
export function legacyFixture(){
 const f=standardFixture();f.deck.format="legacy";f.deck.name="Legacy test";
 f.deck.entries=f.deck.entries!.filter(e=>e.id!=="blink-main");
 const extra={...f.bodies[0],name:"Test ninth value body",scryfallId:"legacy-extra-body",oracleId:"legacy-extra-oracle"};f.bodies.push(extra);f.state.metadata[extra.scryfallId]=extra;
 f.deck.entries.push({id:"extra-body",board:"main",quantity:1,name:extra.name,scryfallId:extra.scryfallId,cardIdentity:extra.oracleId});
 f.state.intelligence!.auto[cardIdentity(extra)]=analyze(extra);
 f.deck.assignments=f.deck.assignments.filter(a=>a.entryId!=="blink-main");
 f.state.items[0].quantityAssigned=1;f.state.items[0].quantityUnassigned=5;
 for(const c of Object.values(f.state.metadata))c.legalities={standard:"not_legal",legacy:"legal"};
 return f;
}
