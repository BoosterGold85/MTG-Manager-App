import { DeckLibrary } from '../components/DeckLibrary';
import { LocalDeckRepository } from '../storage/deckRepository';
import { allocationConflicts } from '../decks/decks';
const deckRepository = new LocalDeckRepository(collectionRepository);
import { tagCollection, tagInWorker } from "../intelligence/client";
import { cardIdentity, effectiveAssignments, needsAnalysis } from "../intelligence/tagger";
import { RULESET_VERSION } from "../intelligence/types";
import type { Override } from "../intelligence/types";
import { ownedCanonicalCards } from "../intelligence/process";
import { quickTags, tagDefinition } from "../intelligence/taxonomy";
import { useEffect, useRef, useState } from "react";
import { subscribeCollectionChanges } from "../storage/collectionSync";
import {
  ArrowDownUp,
  BookOpen,
  ChevronDown,
  Crown,
  Diamond,
  Search,
  Settings2,
  CheckSquare,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import type { SampleCollectionCard } from "../models/card";
import {
  activeFilterCount,
  cardTypes,
  colorOptions,
  emptyFilters,
  filterCards,
} from "../utils/filters";
import type { Filters } from "../utils/filters";
import { sortCards, sortLabels } from "../utils/sorting";
import type { Sort } from "../utils/sorting";
import { CardGrid } from "../components/CardGrid";
import { CardDetail } from "../components/CardDetail";
import { FilterDrawer } from "../components/FilterDrawer";
import { ImportCollection } from "../components/ImportCollection";
import { collectionRepository } from "../storage/collectionRepository";
import { collectionCards } from "../models/collection";
import type { CollectionState } from "../models/collection";
import { sampleCollectionSource } from "../data/sampleCollection";

import { ManageCollection } from "../components/ManageCollection";
import { ConfirmCollectionChange } from "../components/ConfirmCollectionChange";

type Overlay =
  | { type: "card"; card: SampleCollectionCard }
  | { type: "filters" }
  | { type: "import" }
  | { type: "manage" }
  | { type: "remove"; ids: string[] }
  | { type: "clear" }
  | null;
type Area = "collection" | "decks";
// Screen and deck identity live in the query string so static hosting needs no route fallback.
function readRoute(): { area: Area; deckId: string | null } {
  const params = new URLSearchParams(location.search);
  const deckId = params.get("deck");
  return params.get("view") === "decks" || deckId ? { area: "decks", deckId } : { area: "collection", deckId: null };
}
function routeUrl(area: Area, deckId: string | null) {
  const params = new URLSearchParams(location.search);
  params.delete("view");
  params.delete("deck");
  if (area === "decks") {
    params.set("view", "decks");
    if (deckId) params.set("deck", deckId);
  }
  const query = params.toString();
  return `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
}
export default function App() {
  const [cards, setCards] = useState<SampleCollectionCard[]>([]);
  const [tagging,setTagging] = useState(false);
  const [tagStatus,setTagStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savedCollection, setSavedCollection] =
    useState<CollectionState | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  function cancelSelection() { setSelecting(false); setSelected(new Set()); }
  function acceptState(state: CollectionState) {
    setSavedCollection(state); setCards(collectionCards(state));
    const remainingIds = new Set(state.items.map(item => item.id));
    setSelected(current => new Set([...current].filter(id => remainingIds.has(id))));
  }
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters });
  const [sort, setSort] = useState<Sort>("name");
  const [activeDeckId,setActiveDeckId] = useState<string|null>(()=>readRoute().deckId);
  const [area, setArea] = useState<Area>(()=>readRoute().area);
  const [newerRevision, setNewerRevision] = useState<number | null>(null);
  const revision = useRef(0);
  useEffect(() => { revision.current = savedCollection?.revision || 0; }, [savedCollection]);
  // Omitting deckId keeps the deck that was open, so Collection → Decks returns to it (approved v0.4 behavior).
  function navigate(nextArea: Area, requestedDeck?: string | null) {
    const deckId = requestedDeck === undefined ? activeDeckId : requestedDeck;
    if (nextArea === area && deckId === activeDeckId) return;
    const url = routeUrl(nextArea, nextArea === "decks" ? deckId : null);
    // From an open overlay, replace its history entry instead of racing an async back().
    if (history.state?.binderOverlay) { history.replaceState({ route: true }, "", url); setOverlay(null); }
    else history.pushState({ route: true }, "", url);
    setArea(nextArea);
    setActiveDeckId(deckId);
  }
  const [overlay, setOverlay] = useState<Overlay>(null);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    collectionRepository
      .load()
      .then(async (state) => {
        if (state) {
          const pending=ownedCanonicalCards(state).some(card=>needsAnalysis(card,state.intelligence?.auto[cardIdentity(card)]));
          let current=state;
          if(pending) {
            if(!cancelled) {setTagging(true);setTagStatus('Preparing Auto-Tags…');}
            current=await tagCollection(state,message=>{if(!cancelled)setTagStatus(message);},controller.signal);
            current={...current,revision:state.revision+1};
            controller.signal.throwIfAborted();
            await collectionRepository.save(current,state.revision);
            if(!cancelled) {setTagging(false);setTagStatus('Auto-tags ready');}
          }
          if (!cancelled) setSavedCollection(current);
          return collectionCards(current);
        }
        const sample=await sampleCollectionSource.load();
        const intelligence=await tagInWorker(sample,undefined,false,()=>{},controller.signal);
        return sample.map(card=>({...card,analysis:intelligence.auto[cardIdentity(card)],intelligentTags:effectiveAssignments(intelligence.auto[cardIdentity(card)],undefined).map(a=>a.tagId)}));
      })
      .then((data) => {
        if (!cancelled) {
          setCards(data);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not read the saved collection.",
          );
          setLoading(false);
          setTagging(false);
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);
  useEffect(() => {
    const close = () => {
      setOverlay(null);
      const route = readRoute();
      setArea(route.area);
      if (route.area === "decks") setActiveDeckId(route.deckId);
    };
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, []);
  // Another tab saved a newer revision: offer to load it. Never replace state silently,
  // so an open preview or edit keeps its input; stale writes are still rejected by revision.
  useEffect(() => {
    const check = (latest: number) => { if (latest > revision.current) setNewerRevision(latest); };
    const unsubscribe = subscribeCollectionChanges(change => check(change.revision));
    const visible = () => {
      if (document.visibilityState !== "visible") return;
      collectionRepository.load().then(state => { if (state) check(state.revision); }).catch(() => {});
    };
    document.addEventListener("visibilitychange", visible);
    return () => { unsubscribe(); document.removeEventListener("visibilitychange", visible); };
  }, []);
  async function loadLatest() {
    try {
      const state = await collectionRepository.load();
      if (state) acceptState(state);
      setNewerRevision(null);
    } catch (error) {
      setTagStatus(error instanceof Error ? error.message : "Could not load the latest collection. Reload the page.");
    }
  }
  const activeDeck = savedCollection?.decks?.find(d => d.id === activeDeckId);
  useEffect(() => {
    document.title = area === "collection" ? "MTG Manager — My Collection" : activeDeck ? `MTG Manager — ${activeDeck.name}` : "MTG Manager — Decks";
  }, [area, activeDeck]);
  // A deck link whose deck no longer exists falls back to the library without a dead history entry.
  useEffect(() => {
    if (loading || area !== "decks" || !activeDeckId || activeDeck) return;
    history.replaceState(history.state, "", routeUrl("decks", null));
    setActiveDeckId(null);
  }, [loading, area, activeDeckId, activeDeck]);
  function openOverlay(next: Overlay) {
    history.pushState({ ...history.state, binderOverlay: true }, "");
    setOverlay(next);
  }
  function closeOverlay() {
    if (history.state?.binderOverlay) history.back();
    else setOverlay(null);
  }
  async function saveTags(card:SampleCollectionCard,override:Override) {
    if(!savedCollection || tagging) throw new Error('Wait for auto-tags to finish, then retry.');
    const identity=card.analysis?.cardIdentity || cardIdentity(card);
    const intelligence=savedCollection.intelligence || {auto:{},overrides:{}};
    const assignments=[...override.added.map(tagId=>({tagId,source:'manual-add' as const})),...override.suppressed.map(tagId=>({tagId,source:'manual-remove' as const}))].map(a=>({...a,cardIdentity:identity,confidence:1,evidence:[{field:'user',snippet:a.source==='manual-add'?'Added by you':'Hidden by you',reason:'Your manual correction takes precedence over automatic rules.'}],rulesetVersion:RULESET_VERSION}));
    const next={...savedCollection,revision:savedCollection.revision+1,intelligence:{...intelligence,overrides:{...intelligence.overrides,[identity]:{...override,assignments}}}};
    await collectionRepository.save(next,savedCollection.revision);
    acceptState(next);
  }
  async function recalculate() {
    if(!savedCollection || tagging) return;
    setTagging(true); setTagStatus(`Preparing ${ownedCanonicalCards(savedCollection).length} canonical cards…`);
    try {
      const next=await tagCollection(savedCollection,setTagStatus,undefined,true);
      next.revision=savedCollection.revision+1;
      await collectionRepository.save(next,savedCollection.revision);
      acceptState(next);setTagStatus('Auto-tags recalculated. Your manual corrections are preserved.');
    } catch(error) {setTagStatus(error instanceof Error?error.message:'Could not save auto-tags. Try again.');}
    finally {setTagging(false);}
  }
  function reset() {
    setQuery("");
    setFilters({ ...emptyFilters });
  }
  function toggleFilter(key: "colors" | "types", value: string) {
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(value)
        ? f[key].filter((v) => v !== value)
        : [...f[key], value],
    }));
  }
  const results = sortCards(filterCards(cards, query, filters), sort);
  // A record is one printing/finish/condition group; copies are physical cards.
  const copies = results.reduce((n, card) => n + card.quantity, 0);
  const filterCount = activeFilterCount(filters);
  const nav = (mobile = false) => (
    <nav
      className={mobile ? "bottom-nav" : "desktop-nav"}
      aria-label={mobile ? "Mobile navigation" : "Main navigation"}
    >
      <button
        aria-current={area === "collection" ? "page" : undefined}
        onClick={() => navigate("collection")}
      >
        <BookOpen size={mobile ? 21 : 17} />
        <span>Collection</span>
      </button>
      <button
        aria-current={area === "decks" ? "page" : undefined}
        onClick={() => (area === "decks" ? navigate("decks", null) : navigate("decks"))}
      >
        <Crown size={mobile ? 21 : 17} />
        <span>Decks</span>
      </button>
    </nav>
  );
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to collection
      </a>
      <header className="app-header">
        <div className="header-inner">
          <a
            href="#"
            className="wordmark"
            onClick={(e) => {
              e.preventDefault();
              navigate("collection");
            }}
            aria-label="MTG Manager home"
          >
            <span className="brand-mark">
              <Diamond size={22} strokeWidth={1.3} />
            </span>
            <span>
              MTG <span className="wordmark-light">Manager</span>
            </span>
          </a>
          {nav()}
          <span className="header-note">
            <span /> THE DIGITAL BINDER <span className="version">v0.6.4</span>
          </span>
        </div>
      </header>
      <main id="main" className="main-content">
        {newerRevision !== null && (
          <div className="sync-banner" role="status">
            <span>Your collection changed in another tab or window.</span>
            <button className="management-button" onClick={() => void loadLatest()}>Load latest</button>
          </div>
        )}
        {area === "collection" ? (
          <>
            <section className="collection-heading">
              <div>
                <p className="eyebrow">
                  <span className="tiny-line" /> YOUR CARDS. YOUR STORIES.
                </p>
                <h1>
                  My Collection<span className="heading-period">.</span>
                </h1>
                <p className="collection-subtitle">
                  A little magic, beautifully kept.
                </p>
                <div className="collection-count">
                  <BookOpen size={14} />
                  <span>
                    {loading
                      ? "Opening your binder…"
                      : `${cards.reduce((n, c) => n + c.quantity, 0)} cards`}{" "}
                    <span className="count-divider">/</span>{" "}
                    {loading
                      ? "Sample collection"
                      : `${cards.length} ${savedCollection ? (cards.length === 1 ? "record" : "records") : "unique"}`}
                  </span>
                  <span className="sample-label">
                    {savedCollection ? "YOUR COLLECTION" : "SAMPLE COLLECTION"}
                  </span>
                </div>
              </div>
              <div className="binder-note" aria-hidden="true">
                <span className="binder-note-icon">✧</span>
                <p>
                  Every card
                  <br />
                  has a story.
                </p>
                <span>KEEP YOURS CLOSE.</span>
              </div>
            </section>
            {savedCollection && allocationConflicts(savedCollection).length>0 && <div className="allocation-conflicts" role="status"><strong>Inventory needs reconciliation.</strong> Re-import preserved deck assignments that exceed ownership. <button className="text-button" onClick={()=>navigate('decks')}>Review allocation conflicts</button></div>}
            {tagging && <p role="status" className="tagging-status">{tagStatus}</p>}
            <div className="collection-management-actions">
              <button className="management-button" onClick={() => openOverlay({ type: "manage" })} disabled={loading || !!loadError}><Settings2 size={16} />Manage Collection</button>
              <button className="management-button" aria-pressed={selecting} disabled={tagging || !savedCollection || !cards.length} onClick={() => selecting ? cancelSelection() : setSelecting(true)}><CheckSquare size={16} />{selecting ? 'Cancel selection' : 'Select'}</button>
            </div>
            <section
              className="collection-controls"
              aria-label="Collection controls"
            >
              <div className="toolbar">
                <div className="search-bar">
                  <Search size={19} />
                  <input
                    aria-label={filters.searchIn === 'oracle' ? 'Search Oracle text' : filters.searchIn === 'all' ? 'Search card name and Oracle text' : 'Search cards by name'}
                    type="search"
                    placeholder={filters.searchIn === "oracle" ? "Find words in Oracle text…" : "Find a card in your collection…"}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      aria-label="Clear search"
                      className="icon-button"
                      onClick={() => setQuery("")}
                    >
                      <X size={17} />
                    </button>
                  )}
                  <select className="search-scope" aria-label="Search in" value={filters.searchIn || 'name'} onChange={e=>setFilters(f=>({...f,searchIn:e.target.value as 'name'|'oracle'|'all'}))}>
                    <option value="name">Card Name</option><option value="oracle">Oracle Text</option><option value="all">All</option>
                  </select>
                </div>
                <div className="toolbar-actions">
                  <button
                    className="import-button"
                    aria-label="Import Collection"
                    disabled={loading || tagging || !!loadError}
                    onClick={() => openOverlay({ type: "import" })}
                  >
                    <Upload size={17} />
                    <span className="import-action-full">
                      Import Collection
                    </span>
                    <span className="import-action-short" aria-hidden="true">
                      Import
                    </span>
                  </button>
                  <button
                    className={`filter-button ${filterCount ? "is-active" : ""}`}
                    onClick={() => openOverlay({ type: "filters" })}
                  >
                    <SlidersHorizontal size={18} />
                    <span>Filters</span>
                    {filterCount > 0 && (
                      <span className="filter-count">{filterCount}</span>
                    )}
                  </button>
                </div>
                <div className="sort-control">
                  <ArrowDownUp size={16} />
                  <label className="sr-only" htmlFor="sort">
                    Sort cards
                  </label>
                  <select
                    id="sort"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as Sort)}
                  >
                    {Object.entries(sortLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </div>
              </div>
              <div className="chips" aria-label="Quick filters">
                <button
                  className={`chip all-chip ${!filterCount ? "selected" : ""}`}
                  aria-pressed={!filterCount}
                  onClick={() => setFilters({ ...emptyFilters })}
                >
                  All cards
                </button>
                <span className="chip-divider" />
                {colorOptions.map((c) => (
                  <button
                    key={c.value}
                    className={`chip ${filters.colors.includes(c.value) ? "selected" : ""}`}
                    aria-pressed={filters.colors.includes(c.value)}
                    onClick={() => toggleFilter("colors", c.value)}
                  >
                    <span
                      aria-hidden="true"
                      className={`color-dot color-${c.value}`}
                    >
                      {c.symbol}
                    </span>
                    {c.label}
                  </button>
                ))}
                <span className="chip-divider" />
                {cardTypes
                  .filter((t) =>
                    ["Creature", "Artifact", "Enchantment", "Land"].includes(t),
                  )
                  .map((t) => (
                    <button
                      className={`chip ${filters.types.includes(t) ? "selected" : ""}`}
                      aria-pressed={filters.types.includes(t)}
                      key={t}
                      onClick={() => toggleFilter("types", t)}
                    >
                      {t === "Creature"
                        ? "Creatures"
                        : t === "Artifact"
                          ? "Artifacts"
                          : t === "Enchantment"
                            ? "Enchantments"
                            : "Lands"}
                    </button>
                  ))}
              </div>
            </section>
            <div className="quick-synergy" role="group" aria-label="Quick synergy tags"><span>EXPLORE</span>{quickTags.map(id=><button key={id} className={`chip ${filters.synergyTags?.includes(id)?'selected':''}`} aria-pressed={filters.synergyTags?.includes(id)||false} onClick={()=>setFilters(f=>({...f,synergyTags:f.synergyTags?.includes(id)?f.synergyTags.filter(t=>t!==id):[...(f.synergyTags||[]),id]}))}>{tagDefinition(id)?.label}</button>)}</div>
            <div className="results-line">
              <p aria-live="polite" aria-atomic="true">
                {loading ? (
                  "Preparing your collection"
                ) : (
                  <>
                    <strong>{results.length}</strong>{" "}
                    {results.length === 1 ? "record" : "records"} ·{" "}
                    {copies} {copies === 1 ? "copy" : "copies"}
                    {query || filterCount ? " found" : " in your binder"}
                  </>
                )}
                {filterCount > 0 && (
                  <span className="active-filter-label">
                    {filterCount} active{" "}
                    {filterCount === 1 ? "filter" : "filters"}
                  </span>
                )}
              </p>
              {query || filterCount > 0 ? (
                <button className="reset-button" onClick={reset}>
                  <X size={13} />
                  Reset all
                </button>
              ) : (
                <span className="view-label">
                  <span className="mini-grid">▦</span> BINDER VIEW
                </span>
              )}
            </div>
            {loadError ? (
              <section className="empty-state">
                <h2>The binder couldn’t open</h2>
                <p>{loadError}</p>
                <button
                  className="primary-button"
                  onClick={() => location.reload()}
                >
                  Try again
                </button>
              </section>
            ) : savedCollection && cards.length === 0 ? (
              <section className="empty-state">
                <BookOpen size={30} />
                <h2>Your binder is waiting</h2>
                <p>
                  No owned cards are ready to display yet. Import another
                  export, or review any saved problem rows.
                </p>
                <button
                  className="primary-button"
                  onClick={() => openOverlay({ type: "import" })}
                >
                  Import Collection
                </button>
              </section>
            ) : (
              <CardGrid
                key={JSON.stringify([
                  query,
                  filters,
                  sort,
                  savedCollection?.revision,
                ])}
                cards={results}
                loading={loading}
                selecting={selecting}
                selected={selected}
                onToggle={(id) => setSelected(current => {
                  const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next;
                })}
                onOpen={(card) => openOverlay({ type: "card", card })}
                onReset={reset}
              />
            )}
            {!loading && results.length > 0 && (
              <footer className="collection-footer">
                <span>✧</span>
                <p>A collection worth getting lost in.</p>
                <span>
                  {results.length} collection{" "}
                  {results.length === 1 ? "record" : "records"} · {copies}{" "}
                  {copies === 1 ? "copy" : "copies"} ·{" "}
                  {savedCollection ? "Your binder" : "Sample binder"}
                </span>
              </footer>
            )}
          </>
        ) : (
          <DeckLibrary state={savedCollection} repository={deckRepository} onSaved={acceptState} activeId={activeDeckId} onOpen={id=>navigate('decks',id)} onCollection={()=>navigate('collection')} onSaveTags={saveTags}/>

        )}
        <footer className="app-footer">
          <span>
            MTG Manager <span className="muted">· v0.6.4</span>
          </span>
          <span>Card data & artwork: Scryfall · © Wizards of the Coast</span>
        </footer>
      </main>
      {selecting && area === "collection" && <div className="selection-bar" role="region" aria-label="Selection actions">
        <strong role="status">{selected.size.toLocaleString()} selected</strong>
        <button onClick={cancelSelection}>Cancel</button>
        <button onClick={() => setSelected(new Set())} disabled={!selected.size}>Clear selection</button>
        <button onClick={() => setSelected(current => new Set([...current, ...results.map(card => card.id)]))}>Select all</button>
        <button className="danger-button" disabled={!selected.size} onClick={() => openOverlay({ type: "remove", ids: [...selected] })}>Remove</button>
      </div>}
      {nav(true)}
      {overlay?.type === "card" && (
        <CardDetail collection={savedCollection} onOpenDeck={id=>navigate('decks',id)} onSaveTags={savedCollection && overlay.card.ownership ? override=>saveTags(cards.find(c=>c.id===overlay.card.id)||overlay.card,override) : undefined} card={cards.find(c=>c.id===overlay.card.id)||overlay.card} onClose={closeOverlay} onRemove={overlay.card.ownership ? () => setOverlay({ type: "remove", ids: [overlay.card.id] }) : undefined} />
      )}
      {overlay?.type === "manage" && <ManageCollection onRecalculate={recalculate} tagging={tagging} tagStatus={tagStatus} state={savedCollection} onClose={closeOverlay} onClear={() => setOverlay({ type: "clear" })} />}
      {(overlay?.type === "clear" || overlay?.type === "remove") && savedCollection && <ConfirmCollectionChange key={overlay.type} state={savedCollection} clear={overlay.type === "clear"} ids={overlay.type === "remove" ? overlay.ids : []} onClose={closeOverlay} onSaved={state => { acceptState(state); if (overlay.type === "clear") { cancelSelection(); reset(); } closeOverlay(); }} />}
      {overlay?.type === "import" && (
        <ImportCollection
          onClose={closeOverlay}
          onImported={(state) => {
            acceptState(state);
            cancelSelection();
            setLoadError("");
            reset();
          }}
        />
      )}
      {overlay?.type === "filters" && (
        <FilterDrawer
          filters={filters}
          query={query}
          cards={cards}
          onApply={(f) => {
            setFilters(f);
            closeOverlay();
          }}
          onClose={closeOverlay}
        />
      )}
    </>
  );
}
