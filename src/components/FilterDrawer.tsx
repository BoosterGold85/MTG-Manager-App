import { useState } from "react";
import { Check } from "lucide-react";
import type { SampleCollectionCard } from "../models/card";
import {
  activeFilterCount,
  cardTypes,
  colorOptions,
  emptyFilters,
  filterCards,
} from "../utils/filters";
import type { Filters } from "../utils/filters";
import { Dialog } from "./Dialog";
const toggle = (values: string[], value: string) =>
  values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
export function FilterDrawer({
  filters,
  cards,
  query,
  onApply,
  onClose,
}: {
  filters: Filters;
  cards: SampleCollectionCard[];
  query: string;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Filters>({ ...filters });
  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraft((f) => ({ ...f, [key]: value }));
  }
  const sets = [
    ...new Map(
      cards.map((c) => [c.setCode, c.setName || c.setCode.toUpperCase()]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const tags = [...new Set(cards.flatMap((c) => c.tags || []))].sort();
  const count = filterCards(cards, query, draft).length;
  return (
    <Dialog titleId="filter-title" onClose={onClose} className="filter-dialog">
      <div className="drawer-handle" />
      <header className="dialog-heading">
        <p className="eyebrow">REFINE YOUR BINDER</p>
        <h2 id="filter-title">
          Filters <span>{activeFilterCount(draft) || ""}</span>
        </h2>
      </header>
      <div className="filter-content">
        <fieldset>
          <legend>
            Color identity <span>Match any selected</span>
          </legend>
          <div className="filter-options">
            {colorOptions.map((c) => (
              <button
                key={c.value}
                className={`choice ${draft.colors.includes(c.value) ? "selected" : ""}`}
                aria-pressed={draft.colors.includes(c.value)}
                onClick={() => update("colors", toggle(draft.colors, c.value))}
              >
                <span
                  aria-hidden="true"
                  className={`color-dot color-${c.value}`}
                >
                  {c.symbol}
                </span>
                {c.label}
                {draft.colors.includes(c.value) && <Check size={14} />}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>
            Card type <span>Match any selected</span>
          </legend>
          <div className="filter-options">
            {cardTypes.map((t) => (
              <button
                key={t}
                className={`choice ${draft.types.includes(t) ? "selected" : ""}`}
                aria-pressed={draft.types.includes(t)}
                onClick={() => update("types", toggle(draft.types, t))}
              >
                {t}
                {draft.types.includes(t) && <Check size={14} />}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Mana value</legend>
          <div className="range-inputs">
            <label>
              Minimum
              <input
                type="number"
                min="0"
                max="20"
                placeholder="0"
                value={draft.minMana}
                onChange={(e) => update("minMana", e.target.value)}
              />
            </label>
            <span>—</span>
            <label>
              Maximum
              <input
                type="number"
                min="0"
                max="20"
                placeholder="Any"
                value={draft.maxMana}
                onChange={(e) => update("maxMana", e.target.value)}
              />
            </label>
          </div>
        </fieldset>
        <div className="select-pair">
          <label>
            Rarity
            <select
              aria-label="Rarity"
              value={draft.rarity}
              onChange={(e) => update("rarity", e.target.value)}
            >
              <option value="">Any rarity</option>
              {["common", "uncommon", "rare", "mythic"].map((r) => (
                <option key={r} value={r}>
                  {r[0].toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Finish
            <select
              aria-label="Finish"
              value={draft.finish}
              onChange={(e) => update("finish", e.target.value)}
            >
              <option value="">Any finish</option>
              <option value="foil">Foil</option>
              <option value="nonfoil">Nonfoil</option>
            </select>
          </label>
        </div>
        <label>
          Set
          <select
            aria-label="Set"
            value={draft.set}
            onChange={(e) => update("set", e.target.value)}
          >
            <option value="">All sets</option>
            {sets.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sample synergy tag <span className="muted">· manually curated</span>
          <select
            aria-label="Sample synergy tag"
            value={draft.tag}
            onChange={(e) => update("tag", e.target.value)}
          >
            <option value="">All sample tags</option>
            {tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      <footer className="filter-footer">
        <button
          className="text-button"
          onClick={() => setDraft({ ...emptyFilters })}
        >
          Clear all
        </button>
        <button className="primary-button" onClick={() => onApply(draft)}>
          Apply · Show {count} cards
        </button>
      </footer>
    </Dialog>
  );
}
