import { useState } from "react";
import { Check, Layers, SearchX, Sparkles } from "lucide-react";
import type { SampleCollectionCard } from "../models/card";
import { CardImage } from "./CardImage";
export function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div />
      <span />
      <span />
    </div>
  );
}
export function CardGrid({
  cards,
  loading,
  onOpen,
  onReset,
  selecting = false,
  selected = new Set<string>(),
  onToggle,
  caption,
}: {
  cards: SampleCollectionCard[];
  loading: boolean;
  caption?: (card: SampleCollectionCard) => React.ReactNode;
  selecting?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  onOpen: (c: SampleCollectionCard) => void;
  onReset: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(120);
  if (loading)
    return (
      <div role="status" aria-label="Loading collection">
        <span className="sr-only">Loading collection…</span>
        <div className="card-grid">
          {Array.from({ length: 12 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  if (!cards.length)
    return (
      <section className="empty-state">
        <span className="empty-icon">
          <SearchX size={30} />
        </span>
        <p className="eyebrow">A LITTLE TOO WELL HIDDEN</p>
        <h2>No cards found</h2>
        <p>Try another name or give your filters a little more room.</p>
        <button className="primary-button" onClick={onReset}>
          Reset search & filters
        </button>
      </section>
    );
  return (
    <>
      <div className="card-grid">
        {cards.slice(0, visibleCount).map((card, i) => (
          <button
            className={`card-tile ${selecting && selected.has(card.id) ? "tile-selected" : ""}`}
            key={card.id}
            onClick={() => selecting ? onToggle?.(card.id) : onOpen(card)}
            aria-pressed={selecting ? selected.has(card.id) : undefined}
            aria-description={`${card.setCode.toUpperCase()}${card.collectorNumber ? ` #${card.collectorNumber}` : ""}, ${card.rarity}, ${card.quantity} ${card.quantity === 1 ? "copy" : "copies"}${card.foil ? ", foil" : ""}${caption && card.ownership ? `, Owned ${card.ownership.quantityOwned}, Assigned ${card.ownership.quantityAssigned}, Available ${card.ownership.quantityUnassigned}` : ""}`}
          >
            <span className="sr-only">{selecting ? "Select" : "View"} {card.name}</span>
            <div className="tile-art" aria-hidden="true">
              <CardImage card={card} eager={i < 6} />
              {selecting && <span className="selection-indicator" aria-hidden="true">{selected.has(card.id) && <Check size={17} />}</span>}
              {card.quantity > 1 && (
                <span
                  className="quantity"
                  aria-label={`${card.quantity} copies`}
                >
                  <Layers size={12} />
                  {card.quantity}
                </span>
              )}
              {card.foil && (
                <span className="foil-badge" aria-label="Foil">
                  <Sparkles size={13} />
                </span>
              )}
            </div>
            <span className="tile-title" aria-hidden="true">{card.name}</span>
            <span className="tile-subtitle" aria-hidden="true">
              {card.setCode.toUpperCase()} <span>·</span>{" "}
              <span className={`rarity ${card.rarity}`}>{card.rarity}</span>
            </span>
            {caption && <span className="tile-allocation" aria-hidden="true">{caption(card)}</span>}
          </button>
        ))}
      </div>
      {cards.length > visibleCount && (
        <div className="load-more">
          <p aria-live="polite">
            Showing {visibleCount.toLocaleString()} of{" "}
            {cards.length.toLocaleString()} collection records
          </p>
          <button
            className="primary-button"
            onClick={() => setVisibleCount((count) => count + 120)}
          >
            Show more cards
          </button>
        </div>
      )}
    </>
  );
}
