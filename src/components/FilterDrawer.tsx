import { taxonomy, tagDefinition } from "../intelligence/taxonomy";
import { useState } from "react";
import { Check } from "lucide-react";
import type { SampleCollectionCard } from "../models/card";
import {
  activeFilterCount,
  cardTypes,
  colorOptions,
  commanderIdentityOptions,
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
  const [tagQuery,setTagQuery] = useState("");
  const [draft, setDraft] = useState<Filters>({ ...filters });
  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraft((f) => ({ ...f, [key]: value }));
  }
  const sets = [
    ...new Map(
      cards.map((c) => [c.setCode, c.setName || c.setCode.toUpperCase()]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));
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
        <fieldset className="synergy-filter"><legend>Tags / Synergy</legend>
          <label>Search tags<input type="search" value={tagQuery} onChange={e=>setTagQuery(e.target.value)} /></label>
          <div role="group" aria-label="Tag matching" className="tag-match-options">{(["ANY","ALL"] as const).map(mode=><button key={mode} className={`choice ${(draft.tagMatch || 'ANY')===mode?'selected':''}`} aria-pressed={(draft.tagMatch || 'ANY')===mode} onClick={()=>update('tagMatch',mode)}>Match {mode}</button>)}</div>
          <p className="filter-help">{draft.synergyTags?.length || 0} selected · {(draft.tagMatch || 'ANY') === 'ANY' ? 'At least one selected tag' : 'Every selected tag'}</p>
          <div className="synergy-options">{[...taxonomy,...[...new Set(cards.flatMap(c=>c.intelligentTags||[]))].filter(id=>id.startsWith('typal:')).map(id=>tagDefinition(id)!)].filter(t=>`${t.label} ${t.aliases?.join(' ')||''}`.toLowerCase().includes(tagQuery.toLowerCase())).map(t=><button key={t.id} className={`choice ${draft.synergyTags?.includes(t.id)?'selected':''}`} aria-pressed={draft.synergyTags?.includes(t.id)||false} onClick={()=>update('synergyTags',toggle(draft.synergyTags||[],t.id))}>{t.label}{draft.synergyTags?.includes(t.id) && <Check size={14}/>}</button>)}</div>
          <button className="text-button" onClick={()=>update('synergyTags',[])}>Clear tags</button>
        </fieldset>
        <div>
          <label htmlFor="commander-colors">Commander Colors</label>
          <select
            id="commander-colors"
            aria-describedby="commander-colors-help"
            value={
              draft.commanderColors === null
                ? ""
                : draft.commanderColors.join("") || "C"
            }
            onChange={(e) =>
              update(
                "commanderColors",
                commanderIdentityOptions.find(
                  (option) => option.value === e.target.value,
                )?.identity ?? null,
              )
            }
          >
            <option value="">Any Commander colors</option>
            {commanderIdentityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p id="commander-colors-help" className="filter-help">
            Cards legal within this color identity. Includes colorless cards.
          </p>
        </div>
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
