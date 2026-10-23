import { useEffect, useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Crown,
  Diamond,
  Search,
  SlidersHorizontal,
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
import { sampleCollectionSource } from "../data/sampleCollection";

type Overlay =
  | { type: "card"; card: SampleCollectionCard }
  | { type: "filters" }
  | null;
export default function App() {
  const [cards, setCards] = useState<SampleCollectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters });
  const [sort, setSort] = useState<Sort>("name");
  const [area, setArea] = useState<"collection" | "commanders">("collection");
  const [overlay, setOverlay] = useState<Overlay>(null);
  useEffect(() => {
    let cancelled = false;
    sampleCollectionSource
      .load()
      .then((data) => {
        if (!cancelled) {
          setCards(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const close = () => setOverlay(null);
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, []);
  function openOverlay(next: Overlay) {
    history.pushState({ ...history.state, binderOverlay: true }, "");
    setOverlay(next);
  }
  function closeOverlay() {
    if (history.state?.binderOverlay) history.back();
    else setOverlay(null);
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
  const filterCount = activeFilterCount(filters);
  const nav = (mobile = false) => (
    <nav
      className={mobile ? "bottom-nav" : "desktop-nav"}
      aria-label={mobile ? "Mobile navigation" : "Main navigation"}
    >
      <button
        aria-current={area === "collection" ? "page" : undefined}
        onClick={() => setArea("collection")}
      >
        <BookOpen size={mobile ? 21 : 17} />
        <span>Collection</span>
      </button>
      <button
        aria-current={area === "commanders" ? "page" : undefined}
        onClick={() => setArea("commanders")}
      >
        <Crown size={mobile ? 21 : 17} />
        <span>Commanders</span>
        {!mobile && <span className="soon-dot" />}
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
              setArea("collection");
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
            <span /> THE DIGITAL BINDER <span className="version">v0.1.1</span>
          </span>
        </div>
      </header>
      <main id="main" className="main-content">
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
                    {loading ? "Sample collection" : `${cards.length} unique`}
                  </span>
                  <span className="sample-label">SAMPLE COLLECTION</span>
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
            <section
              className="collection-controls"
              aria-label="Collection controls"
            >
              <div className="toolbar">
                <div className="search-bar">
                  <Search size={19} />
                  <input
                    aria-label="Search cards by name"
                    type="search"
                    placeholder="Find a card in your collection…"
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
                  <span className="search-hint" aria-hidden="true">
                    BY NAME
                  </span>
                </div>
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
            <div className="results-line">
              <p aria-live="polite" aria-atomic="true">
                {loading ? (
                  "Preparing your collection"
                ) : (
                  <>
                    <strong>{results.length}</strong>{" "}
                    {results.length === 1 ? "card" : "cards"}
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
                <p>Reload to try loading the local sample collection again.</p>
                <button
                  className="primary-button"
                  onClick={() => location.reload()}
                >
                  Try again
                </button>
              </section>
            ) : (
              <CardGrid
                cards={results}
                loading={loading}
                onOpen={(card) => openOverlay({ type: "card", card })}
                onReset={reset}
              />
            )}
            {!loading && results.length > 0 && (
              <footer className="collection-footer">
                <span>✧</span>
                <p>A collection worth getting lost in.</p>
                <span>{results.length} unique cards · Sample binder</span>
              </footer>
            )}
          </>
        ) : (
          <section className="coming-soon">
            <div className="coming-emblem">
              <Crown size={35} strokeWidth={1} />
            </div>
            <p className="eyebrow">THE NEXT CHAPTER</p>
            <h1>A place for your commanders.</h1>
            <p>
              Coming in a future release. For now, enjoy the cards that make
              every deck possible.
            </p>
            <button
              className="primary-button"
              onClick={() => setArea("collection")}
            >
              Back to your collection <ArrowRight size={17} />
            </button>
          </section>
        )}
        <footer className="app-footer">
          <span>
            MTG Manager <span className="muted">· v0.1.1</span>
          </span>
          <span>Card data & artwork: Scryfall · © Wizards of the Coast</span>
        </footer>
      </main>
      {nav(true)}
      {overlay?.type === "card" && (
        <CardDetail card={overlay.card} onClose={closeOverlay} />
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
