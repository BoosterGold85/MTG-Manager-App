import { IndexedDbScryfallCache } from "../storage/scryfallCache";
import type { MetadataCache } from "../storage/scryfallCache";
import type { Color, Rarity } from "../models/card";
import type { CardMetadata, ImportRow } from "../models/collection";
import { identifierKey, normalizedName } from "./csv";
interface ScryfallCard {
  object: "card";
  lang?: string;
  oracle_id?: string;
  keywords?: string[];
  produced_mana?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  layout?: string;
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  cmc: number;
  color_identity: Color[];
  type_line: string;
  rarity: Rarity;
  mana_cost?: string;
  oracle_text?: string;
  artist?: string;
  printed_name?: string;
  image_uris?: { normal?: string; large?: string };
  card_faces?: {
    name?: string;
    type_line?: string;
    keywords?: string[];
    power?: string;
    toughness?: string;
    loyalty?: string;
    oracle_text?: string;
    mana_cost?: string;
    image_uris?: { normal?: string; large?: string };
  }[];
}
interface ListResponse {
  data: ScryfallCard[];
  has_more?: boolean;
  not_found?: {id?: string;name?: string;set?: string;collector_number?: string}[];
}
export interface Resolution {
  card?: CardMetadata;
  error?: string;
}
export interface ResolvedImport {
  results: Map<string, Resolution>;
  nameMatches: Record<string, string>;
}
export interface MetadataResolver {
  resolve(
    rows: ImportRow[],
    metadata: Record<string, CardMetadata>,
    nameMatches: Record<string, string>,
    signal: AbortSignal,
    progress: (message: string) => void,
  ): Promise<ResolvedImport>;
}
export function normalizeCard(c: ScryfallCard): CardMetadata {
  if (
    !c.id ||
    !c.name ||
    !Array.isArray(c.color_identity) ||
    c.color_identity.some((v) => !["W", "U", "B", "R", "G"].includes(v)) ||
    !Number.isFinite(c.cmc) ||
    !c.set ||
    !c.collector_number ||
    !c.type_line
  )
    throw new Error(
      "Scryfall returned incomplete metadata. Try again before importing.",
    );
  const image = c.image_uris || c.card_faces?.[0]?.image_uris;
  return {
    scryfallId: c.id,
    oracleId: c.oracle_id,
    keywords: c.keywords,
    producedMana: c.produced_mana,
    power: c.power, toughness: c.toughness, loyalty: c.loyalty, layout: c.layout,
    cardFaces: c.card_faces?.map(f => ({name:f.name || c.name,oracleText:f.oracle_text,typeLine:f.type_line,keywords:f.keywords,power:f.power,toughness:f.toughness,loyalty:f.loyalty})),
    printedLanguage: c.lang || "en",
    name: c.name,
    setCode: c.set,
    setName: c.set_name,
    collectorNumber: c.collector_number,
    manaValue: c.cmc,
    colorIdentity: c.color_identity,
    typeLine: c.type_line,
    rarity: c.rarity,
    manaCost:
      c.mana_cost ||
      c.card_faces
        ?.map((f) => f.mana_cost)
        .filter(Boolean)
        .join(" // "),
    oracleText:
      c.oracle_text ||
      c.card_faces
        ?.map((f) => `${f.name}\n${f.oracle_text || ""}`)
        .join("\n\n"),
    imageUrl: image?.large || image?.normal || "",
    thumbnailUrl: image?.normal || "",
    artist: c.artist,
    aliases: [
      c.printed_name,
      ...(c.card_faces?.map((f) => f.name) || []),
    ].filter((n): n is string => Boolean(n)),
  };
}
const delay = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Import canceled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Scryfall is unavailable. Try preparing this preview again.";
export class LookupInterrupted extends Error {
  constructor(public resolvedRows:number,public totalRows:number,public cause:unknown) {
    super(`Card lookup was interrupted after ${resolvedRows.toLocaleString()} of ${totalRows.toLocaleString()} rows. Your file is intact. Retry remaining cards.`);
    this.name='LookupInterrupted';
  }
}
class ServiceFailure extends Error {
  constructor(message:string,public retryAfter=0,public retryable=true) {super(message);}
}
class CardResolutionError extends Error {}
export interface ScryfallOptions {
  attempts?:number;backoffMs?:number;timeoutMs?:number;
  sleep?:(ms:number,signal:AbortSignal)=>Promise<void>;
  cache?:MetadataCache;
}
export function retryAfterMilliseconds(value:string|null,now=Date.now()) {
  if(!value) return 0;
  const seconds=Number(value);
  return Number.isFinite(seconds) ? Math.max(0,seconds*1000) : Math.max(0,Date.parse(value)-now)||0;
}
export class ScryfallClient implements MetadataResolver, DeckCardLookup {
  private lastRequest = 0;
  private cooldownUntil = 0;
  private pace:number;
  private sets: { code: string; name: string }[] | null = null;
  private sessionMetadata: Record<string, CardMetadata> = {};
  private sessionNames: Record<string, string> = {};
  private sessionErrors = new Map<string,string>();
  constructor(
    private fetcher: typeof fetch = (input, init) => fetch(input, init),
    interval = 250,
    private options:ScryfallOptions = {},
  ) {this.pace=interval;}
  private wait(ms:number,signal:AbortSignal) {return (this.options.sleep || delay)(ms,signal);}
  private async request(path:string,signal:AbortSignal,body?:unknown):Promise<unknown> {
    const attempts=this.options.attempts ?? 4;
    for(let attempt=0;attempt<attempts;attempt++) {
      signal.throwIfAborted();
      await this.wait(Math.max(0,this.pace-(Date.now()-this.lastRequest),this.cooldownUntil-Date.now()),signal);
      signal.throwIfAborted();
      this.lastRequest=Date.now();
      const controller=new AbortController();
      const abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});
      const timeout=setTimeout(abort,this.options.timeoutMs ?? 20_000);
      let failure:ServiceFailure;
      try {
        const response=await this.fetcher(`https://api.scryfall.com${path}`,{
          method:body?'POST':'GET',signal:controller.signal,
          headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
          ...(body?{body:JSON.stringify(body)}:{}),
        });
        if(response.status===404 && path.startsWith('/cards/search?')) {
          const missing=await response.json();
          if(missing?.object==='error' && missing?.code==='not_found') return {data:[]};
          throw new ServiceFailure('Search failed without a confirmed Scryfall not_found response.',0,false);
        }
        if(!response.ok) {
          const retryAfter=retryAfterMilliseconds(response.headers.get('Retry-After'));
          if(response.status===429) this.pace=Math.min(2000,Math.max(500,this.pace*2));
          throw new ServiceFailure(`Scryfall lookup failed (HTTP ${response.status}).`,retryAfter,response.status===429 || response.status>=500 || response.status===408);
        }
        return await response.json();
      } catch(error) {
        signal.throwIfAborted();
        failure=error instanceof ServiceFailure ? error : new ServiceFailure(controller.signal.aborted?'Scryfall lookup timed out.':`Could not reach Scryfall or read its response. ${message(error)}`);
      } finally {clearTimeout(timeout);signal.removeEventListener('abort',abort);}
      const backoff=(this.options.backoffMs ?? 1000)*2**attempt;
      this.cooldownUntil=Math.max(this.cooldownUntil,Date.now()+Math.max(failure.retryAfter,backoff));
      if(!failure.retryable || attempt===attempts-1) throw failure;
    }
    throw new ServiceFailure('Scryfall lookup could not finish.');
  }
  private async checkpoint(cards:CardMetadata[],names:Record<string,string>) {
    for(const card of cards) this.sessionMetadata[card.scryfallId]=card;
    Object.assign(this.sessionNames,names);
    // A cache write is never an inventory write; quota failure still retains session successes.
    try {await this.options.cache?.save(cards,names);} catch { /* Session cache remains usable. */ }
  }
  async resolve(
    rows: ImportRow[],
    metadata: Record<string, CardMetadata>,
    nameMatches: Record<string, string>,
    signal: AbortSignal,
    progress: (message: string) => void,
  ): Promise<ResolvedImport> {
    let cached:{metadata:Record<string,CardMetadata>;nameMatches:Record<string,string>}={metadata:{},nameMatches:{}};
    try {cached=await this.options.cache?.load() || cached;} catch { /* Cache is optional; ownership storage is untouched. */ }
    signal.throwIfAborted();
    const known = { ...cached.metadata, ...this.sessionMetadata, ...metadata };
    const names = { ...cached.nameMatches, ...this.sessionNames, ...nameMatches };
    const results = new Map<string, Resolution>();
    const unique = [
      ...new Map(rows.map((row) => [identifierKey(row), row])).values(),
    ];
    const prints = new Map(
      Object.values(known)
        .filter(
          (c) =>
            c.collectorNumber &&
            (!c.printedLanguage || c.printedLanguage === "en"),
        )
        .map((c) => [
          `${c.setCode.toLowerCase()}:${c.collectorNumber!.toLowerCase()}`,
          c,
        ]),
    );
    const interrupt=(error:unknown):never=>{
      signal.throwIfAborted();
      const available={...known,...this.sessionMetadata};
      const availablePrints=new Set(Object.values(available).filter(c=>!c.printedLanguage || c.printedLanguage==='en').map(c=>`${c.setCode}:${c.collectorNumber?.toLowerCase()}`));
      const resolved=rows.filter(row=>results.get(identifierKey(row))?.card || (row.scryfallId ? available[row.scryfallId] : availablePrints.has(`${row.setCode}:${row.collectorNumber.toLowerCase()}`))).length;
      throw new LookupInterrupted(resolved,rows.length,error);
    };
    const pending: ImportRow[] = [],
      fallback: ImportRow[] = [];
    for (const row of unique) {
      const key = identifierKey(row);
      const previousError=this.sessionErrors.get(key);
      if(previousError) {results.set(key,{error:previousError});continue;}
      if (row.scryfallId) {
        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
            row.scryfallId,
          )
        ) {
          results.set(key, {
            error:
              "Invalid Scryfall ID. Correct the identifier; no name-based guess was made.",
          });
          continue;
        }
        if (known[row.scryfallId])
          results.set(key, { card: known[row.scryfallId] });
        else pending.push(row);
      } else if (row.setCode && row.collectorNumber) {
        const card = prints.get(
          `${row.setCode}:${row.collectorNumber.toLowerCase()}`,
        );
        if (card) results.set(key, { card });
        else pending.push(row);
      } else fallback.push(row);
    }
    for (let offset = 0; offset < pending.length; offset += 75) {
      signal.throwIfAborted();
      const batch = pending.slice(offset, offset + 75);
      progress(
        `Matching printings ${offset + 1}–${Math.min(offset + 75, pending.length)} of ${pending.length}…`,
      );
      try {
        const response = (await this.request("/cards/collection", signal, {
          identifiers: batch.map((row) =>
            row.scryfallId
              ? { id: row.scryfallId }
              : { set: row.setCode, collector_number: row.collectorNumber },
          ),
        })) as ListResponse;
        if (!Array.isArray(response.data))
          throw new Error(
            "Scryfall returned an unexpected response. Retry the preview.",
          );
        const normalized = response.data.map(normalizeCard);
        await this.checkpoint(normalized,{});
        const batchResults = new Map<string,Resolution>();
        for (const row of batch) {
          const candidates = normalized.filter((c) =>
            row.scryfallId
              ? c.scryfallId === row.scryfallId
              : c.setCode.toLowerCase() === row.setCode &&
                c.collectorNumber?.toLowerCase() ===
                  row.collectorNumber.toLowerCase(),
          );
          if(!candidates.length && !response.not_found?.some(identifier=>row.scryfallId ? identifier.id===row.scryfallId : identifier.set===row.setCode && identifier.collector_number===row.collectorNumber))
            throw new ServiceFailure('Scryfall returned an incomplete collection batch.');
          batchResults.set(
            identifierKey(row),
            candidates.length === 1
              ? { card: candidates[0] }
              : {
                  error:
                    candidates.length > 1
                      ? "Ambiguous printing. Supply a Scryfall ID."
                      : "No Scryfall printing found for this identifier. Correct the ID or printing information.",
                },
          );
        }
        for (const [key,value] of batchResults) {results.set(key,value);if(value.error)this.sessionErrors.set(key,value.error);}
        for (const card of normalized) known[card.scryfallId] = card;
      } catch (error) {
        interrupt(error);
      }
    }

    for (const [index, row] of fallback.entries()) {
      signal.throwIfAborted();
      progress(`Checking exact names ${index + 1} of ${fallback.length}…`);
      const key = identifierKey(row);
      try {
        let code = row.setCode;
        if (!code) {
          if (!this.sets) {
            const response = (await this.request("/sets", signal)) as {
              data: { code: string; name: string }[];
            };
            if (!Array.isArray(response.data))
              throw new Error(
                "Could not load Scryfall set names. Retry the preview.",
              );
            this.sets = response.data;
          }
          const matches = this.sets.filter(
            (set) => normalizedName(set.name) === normalizedName(row.setName),
          );
          if (matches.length !== 1)
            throw new CardResolutionError(
              "Set name is unknown or ambiguous. Supply a set code or Scryfall ID.",
            );
          code = matches[0].code;
        }
        if (!/^[a-z0-9_]+$/.test(code))
          throw new CardResolutionError("Invalid set code. Use the ManaBox Set code column.");
        const nameKey = JSON.stringify([
          normalizedName(row.name),
          code,
          row.collectorNumber.toLowerCase(),
        ]);
        const cached = known[names[nameKey]];
        if (cached) {
          results.set(key, { card: cached });
          continue;
        }
        const escaped = normalizedName(row.name)
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"');
        const response = (await this.request(
          `/cards/search?unique=prints&q=${encodeURIComponent(`!"${escaped}" set:${code}`)}`,
          signal,
        )) as ListResponse;
        if (!Array.isArray(response.data))
          throw new Error(
            "Scryfall returned an unexpected search response. Retry the preview.",
          );
        const exact = response.data
          .map(normalizeCard)
          .filter(
            (c) =>
              normalizedName(c.name) === normalizedName(row.name) &&
              c.setCode.toLowerCase() === code &&
              (!row.collectorNumber ||
                c.collectorNumber?.toLowerCase() ===
                  row.collectorNumber.toLowerCase()),
          );
        if (!exact.length)
          throw new CardResolutionError(
            "No exact name and printing match found. Supply a Scryfall ID or set + collector number.",
          );
        if (response.has_more || exact.length !== 1)
          throw new CardResolutionError(
            "Multiple printings match this name and set. Supply a collector number or Scryfall ID; nothing was guessed.",
          );
        results.set(key, { card: exact[0] });
        known[exact[0].scryfallId] = exact[0];
        names[nameKey] = exact[0].scryfallId;
        await this.checkpoint([exact[0]],{[nameKey]:exact[0].scryfallId});
      } catch (error) {
        signal.throwIfAborted();
        if(error instanceof CardResolutionError) {results.set(key, { error: message(error) });this.sessionErrors.set(key,message(error));}
        else interrupt(error);
      }
    }
    this.sessionMetadata = known;
    this.sessionNames = names;
    return { results, nameMatches: names };
  }
  private deckResults: DeckLookupResult = new Map();
  // Deck lookups reuse the same pacing, retries and canonical cache; successes survive a retry.
  async lookupDeckCards(
    identifiers: DeckIdentifier[],
    signal: AbortSignal,
    progress: (message: string) => void,
  ): Promise<DeckLookupResult> {
    const results: DeckLookupResult = new Map();
    const pending: DeckIdentifier[] = [];
    for (const id of new Map(identifiers.map((i) => [i.key, i])).values()) {
      if (this.deckResults.has(id.key)) results.set(id.key, this.deckResults.get(id.key)!);
      else pending.push(id);
    }
    const total = identifiers.length;
    for (let offset = 0; offset < pending.length; offset += 75) {
      signal.throwIfAborted();
      const batch = pending.slice(offset, offset + 75);
      progress(`Looking up deck cards ${offset + 1}–${Math.min(offset + 75, pending.length)} of ${pending.length}…`);
      try {
        const response = (await this.request("/cards/collection", signal, {
          identifiers: batch.map((id) =>
            id.set && id.collector_number
              ? { set: id.set, collector_number: id.collector_number }
              : { name: id.name },
          ),
        })) as ListResponse;
        if (!Array.isArray(response.data))
          throw new ServiceFailure("Scryfall returned an unexpected response. Retry the preview.");
        const normalized = response.data.map(normalizeCard);
        await this.checkpoint(normalized, {});
        const batchResults: DeckLookupResult = new Map();
        for (const id of batch) {
          const card = normalized.find((c) =>
            id.set && id.collector_number
              ? c.setCode.toLowerCase() === id.set && c.collectorNumber?.toLowerCase() === id.collector_number
              : [c.name, ...(c.aliases || [])].some((n) => normalizedName(n) === normalizedName(id.name || "")) ||
                normalizedName(c.name.split(" // ")[0]) === normalizedName(id.name || ""),
          );
          const missing = response.not_found?.some((nf) =>
            id.set && id.collector_number
              ? nf.set?.toLowerCase() === id.set && nf.collector_number?.toLowerCase() === id.collector_number
              : normalizedName(nf.name || "") === normalizedName(id.name || ""),
          );
          if (!card && !missing)
            throw new ServiceFailure("Scryfall returned an incomplete collection batch.");
          batchResults.set(id.key, card || null);
        }
        for (const [key, value] of batchResults) {
          results.set(key, value);
          this.deckResults.set(key, value);
        }
      } catch (error) {
        signal.throwIfAborted();
        throw new LookupInterrupted(results.size, total, error);
      }
    }
    return results;
  }
}
export interface DeckIdentifier {
  key: string;
  name?: string;
  set?: string;
  collector_number?: string;
}
// null = Scryfall explicitly reported not_found for this identifier.
export type DeckLookupResult = Map<string, CardMetadata | null>;
export interface DeckCardLookup {
  lookupDeckCards(
    identifiers: DeckIdentifier[],
    signal: AbortSignal,
    progress: (message: string) => void,
  ): Promise<DeckLookupResult>;
}
export function printingConflict(
  row: ImportRow,
  card: CardMetadata,
): string | null {
  if (row.setCode && row.setCode !== card.setCode.toLowerCase())
    return "Identifier conflicts with the supplied set code. Correct this row before importing.";
  if (
    row.collectorNumber &&
    row.collectorNumber.toLowerCase() !== card.collectorNumber?.toLowerCase()
  )
    return "Identifier conflicts with the collector number. Correct this row before importing.";
  if (
    row.name &&
    ![card.name, ...(card.aliases || [])].some(
      (n) => normalizedName(n) === normalizedName(row.name),
    )
  )
    return "Identifier conflicts with the supplied card name. Correct this row before importing.";
  return null;
}
export const scryfallClient = new ScryfallClient(undefined,250,{cache:new IndexedDbScryfallCache()});
