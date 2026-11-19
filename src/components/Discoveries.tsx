import type { ReactNode } from "react";
import type { OwnedCandidateGroup } from "../synergy/explorer";
import type { Discovery, DiscoveryStrength } from "../upgrades/discovery";
import { CardImage } from "./CardImage";
import { availabilityLine } from "../upgrades/availability";


// What each strength label promises, in plain words. The label is a category, never a number.
const STRENGTH_MEANING: Record<DiscoveryStrength, string> = {
  "Strongly supported": "The card text of both cards confirms this interaction.",
  Plausible: "The interaction is real, but how often it matters depends on how the deck plays.",
  Speculative: "MTG Manager is not sure how this plays out. Read the card text before relying on it.",
};

export interface DiscoveryHandlers {
  busy: boolean;
  complete: boolean;
  /** Cards already in the deck, for "Add to Deck (N of 100)". */
  deckCards: number;
  deckName: string;
  isSaved: (d: Discovery) => boolean;
  onDetail: (identity: string) => void;
  onReview: (identity: string) => void;
  onAdd: (group: OwnedCandidateGroup) => void;
  onSave: (d: Discovery) => void;
  /** The evidence drawer (Brew "Why" lines), supplied by the parent so it keeps its existing wording. */
  renderEvidence: (d: Discovery) => ReactNode;
}

/** The "Potential change" line: an add for incomplete decks, the best one-for-one cut for complete decks. Nothing is written. */
function potentialChange(d: Discovery, h: DiscoveryHandlers) {
  if (!h.complete) return `Add to ${h.deckName}. The deck has ${h.deckCards} of 100 cards.`;
  if (!d.upgrade) return "Not evaluated for this deck.";
  if (!d.upgrade.best) return "No valid one-for-one cut keeps this deck's essential functions.";
  return `Best one-for-one swap: cut ${d.upgrade.best.cutName} (${d.upgrade.label}). Nothing changes until you confirm.`;
}

function DiscoveryCard({ d, h }: { d: Discovery; h: DiscoveryHandlers }) {
  const name = d.group.card.name;
  const saved = h.isSaved(d);
  return (
    <li className="upgrade-card discovery-card" data-strength={d.strength}>
      <button className="synergy-art deck-art-button" disabled={h.busy} onClick={() => h.onDetail(d.identity)}>
        <CardImage card={d.group.card} />
        <span className="sr-only">View {name} details</span>
      </button>
      <div>
        <p className={`strength-chip strength-${d.strength.split(" ")[0].toLowerCase()}`}>{d.strength}</p>
        <h3>{name}</h3>
        <p className="upgrade-headline discovery-why">
          <span className="metric-name">Why it's interesting</span> <strong>{d.brew.headline}</strong>
        </p>
        <dl className="discovery-facts">
          <div>
            <dt>Works with</dt>
            <dd>{d.worksWith.join(", ")}</dd>
          </div>
          <div>
            <dt>What happens</dt>
            <dd>{d.happens}</dd>
          </div>
          {d.needs.length > 0 && (
            <div>
              <dt>What it needs</dt>
              <dd>
                <ul>
                  {d.needs.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          <div>
            <dt>Availability</dt>
            <dd>{availabilityLine(d.group)}</dd>
          </div>
          <div>
            <dt>Potential change</dt>
            <dd>{potentialChange(d, h)}</dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>
              {d.strength}. <small>{STRENGTH_MEANING[d.strength]}</small>
            </dd>
          </div>
        </dl>
        {d.caveats.length > 0 && <p className="meta-text">Caveat: {d.caveats[0]}</p>}
        <div className="upgrade-actions">
          {h.complete ? (
            d.upgrade?.best && (
              <button className="primary-button" disabled={h.busy || d.group.available < 1} onClick={() => h.onReview(d.identity)}>
                Review Swap
              </button>
            )
          ) : (
            <button className="primary-button" disabled={h.busy || d.group.available < 1} onClick={() => h.onAdd(d.group)}>
              Add to Deck
            </button>
          )}
          <button className="management-button" disabled={h.busy} aria-pressed={saved} onClick={() => h.onSave(d)}>
            {saved ? "Saved" : "Save"}
          </button>
        </div>
        <details className="upgrade-why">
          <summary>Why it fits</summary>
          {h.renderEvidence(d)}
        </details>
        <button className="text-button" onClick={() => h.onDetail(d.identity)}>
          Card Details
        </button>
      </div>
    </li>
  );
}

/** Recommended from your collection: the Upgrades landing. Shows the top results; "Show more" reveals the rest. */
export function DiscoveryList({ items, limit, onShowMore, handlers }: { items: Discovery[]; limit: number; onShowMore: () => void; handlers: DiscoveryHandlers }) {
  return (
    <>
      <ul className="synergy-candidates discovery-list">
        {items.slice(0, limit).map((d) => (
          <DiscoveryCard key={d.identity} d={d} h={handlers} />
        ))}
      </ul>
      {items.length > limit && (
        <button className="primary-button" onClick={onShowMore}>
          Show more recommendations
        </button>
      )}
    </>
  );
}
