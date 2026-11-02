import {it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import hashes from "../commander-protected.sha256.json";
it("Standard development leaves the complete approved Commander scorer and tool source unchanged",()=>{
 for(const [path,hash] of Object.entries(hashes))expect(createHash("sha256").update(readFileSync(path)).digest("hex"),path).toBe(hash);
});
