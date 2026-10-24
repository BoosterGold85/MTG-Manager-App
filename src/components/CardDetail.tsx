import { InThisDeck } from './InThisDeck';
import type { CardSynergy } from '../dna/engine';
import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { deckUsage } from '../decks/decks';
import type { CollectionState } from '../models/collection';
import { cardKeywords } from "../utils/cardKeywords";
import { CardIntelligence } from "./CardIntelligence";
import type { Override } from "../intelligence/types";
import type { SampleCollectionCard } from "../models/card";
import { colorOptions } from "../utils/filters";
import { Dialog } from "./Dialog";
import { CardImage } from "./CardImage";
// Deck context: the decklist entry and its physical assignment, kept distinct from ownership.
export interface DeckDetailContext {
  deckName: string;
  quantity: number;
  assigned: boolean;
  ownedElsewhere: number;
  availableElsewhere: number;
  commander?: boolean;
}
export interface DetailNavigation {
  position: number;
  total: number;
  onPrevious?: () => void;
  onNext?: () => void;
}
const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
export function CardDetail({
  card,
  collection,
  onOpenDeck,
  onClose,
  onRemove,
  onSaveTags,
  deck,
  navigation,
  synergy,
}: {
  card: SampleCollectionCard;
  collection?: CollectionState|null;
  onOpenDeck?: (id:string)=>void;
  onClose: () => void;
  onRemove?: () => void;
  onSaveTags?: (override:Override) => Promise<void>;
  deck?: DeckDetailContext;
  navigation?: DetailNavigation;
  synergy?: CardSynergy;
}) {
  const layout = useRef<HTMLDivElement>(null);
  // Card content is swapped in place; start each card at its logical top.
  useEffect(() => {
    if (layout.current) layout.current.scrollTop = 0;
    layout.current?.closest('dialog')?.scrollTo?.({ top: 0 });
  }, [card.id]);
  const previous = navigation?.onPrevious, next = navigation?.onNext;
  useEffect(() => {
    if (!navigation) return;
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return;
      const active = document.activeElement;
      if (active && active !== document.body && !layout.current?.closest('dialog')?.contains(active)) return;
      if (e.key === 'ArrowLeft' && previous) { e.preventDefault(); previous(); }
      if (e.key === 'ArrowRight' && next) { e.preventDefault(); next(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [navigation, previous, next]);
  const unassigned = deck && !card.ownership;
  return (
    <Dialog titleId="detail-title" onClose={onClose} className={`detail-dialog${navigation ? ' detail-navigable' : ''}`}>
      <div className="drawer-handle" />
      <div
        ref={layout}
        className="detail-layout"
        tabIndex={0}
        role="region"
        aria-label="Card details"
      >
        <div className="detail-art">
          <CardImage key={card.id} card={card} detail />
          {card.artist && (
            <p className="artist">Illustrated by {card.artist}</p>
          )}
        </div>
        <div className="detail-copy">
          <p className="eyebrow">{deck ? `IN ${deck.deckName.toUpperCase()}` : 'FROM YOUR COLLECTION'}</p>
          <h2 id="detail-title">{card.name}</h2>
          <p className="type-line">{card.typeLine}</p>
          <div className="mana-line">
            <span
              className="mana-cost"
              aria-label={`Mana cost ${card.manaCost || "none"}`}
            >
              {card.manaCost || "—"}
            </span>
            <span>Mana value {card.manaValue}</span>
          </div>
          {card.oracleText && (
            <section className="oracle-text" aria-label="Oracle text">
              {card.oracleText.split("\n").map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </section>
          )}
          <dl className="card-facts">
            <div>
              <dt>Color identity</dt>
              <dd>
                {card.colorIdentity
                  .map((c) => colorOptions.find((o) => o.value === c)?.label)
                  .join(", ") || "Colorless"}
              </dd>
            </div>
            <div>
              <dt>Set</dt>
              <dd>
                {card.setName || card.setCode.toUpperCase()}{" "}
                <span className="muted">
                  · {card.setCode.toUpperCase()}
                  {card.collectorNumber ? ` #${card.collectorNumber}` : ""}
                </span>
              </dd>
            </div>
            <div>
              <dt>Rarity</dt>
              <dd className={`rarity ${card.rarity}`}>{card.rarity}</dd>
            </div>
            {unassigned ? (
              <div>
                <dt>Ownership</dt>
                <dd>{deck.ownedElsewhere ? `Owned elsewhere · ${deck.ownedElsewhere} ${deck.ownedElsewhere === 1 ? 'copy' : 'copies'} (${deck.availableElsewhere} available)` : 'Not currently owned'}</dd>
              </div>
            ) : (
            <div>
              <dt>In your binder</dt>
              <dd>
                {card.quantity} {card.quantity === 1 ? "copy" : "copies"}{" "}
                <span className="finish">
                  {card.foil ? "✧ Foil" : "Nonfoil"}
                </span>
              </dd>
            </div>
            )}
            {card.ownership && (
              <>
                <div>
                  <dt>Available</dt>
                  <dd>
                    {card.ownership.quantityUnassigned} unassigned ·{" "}
                    {card.ownership.quantityAssigned} assigned
                  </dd>
                </div>
                <div>
                  <dt>Printing copy</dt>
                  <dd>
                    {card.ownership.language} · {card.ownership.condition} ·{" "}
                    {card.ownership.finish}
                  </dd>
                </div>
                {card.ownership.binderName && (
                  <div>
                    <dt>Binder / list</dt>
                    <dd>
                      {card.ownership.binderName}
                      {card.ownership.binderType
                        ? ` · ${card.ownership.binderType}`
                        : ""}
                    </dd>
                  </div>
                )}
              </>
            )}
          </dl>
          {deck && (
            <section className="deck-entry-detail" aria-label="Deck entry">
              <h3>Deck entry</h3>
              <p>{card.name} ×{deck.quantity}{deck.commander ? ' · Commander' : ''}</p>
              <p>
                Physical assignment:{' '}
                {card.ownership
                  ? `${card.setCode.toUpperCase()}${card.collectorNumber ? ` #${card.collectorNumber}` : ''} · ${card.ownership.finish} · ${card.ownership.language} · ${card.ownership.condition}`
                  : 'None'}
              </p>
              {!card.ownership && (
                <p>{deck.ownedElsewhere ? `Owned elsewhere: ${deck.ownedElsewhere} ${deck.ownedElsewhere === 1 ? 'copy' : 'copies'} · ${deck.availableElsewhere} available · none assigned to this entry` : 'Not currently owned'}</p>
              )}
            </section>
          )}
          {cardKeywords(card).length > 0 && <section className="canonical-keywords" aria-label="Canonical keywords"><h3>Keywords</h3><p>Canonical named mechanics · separate from strategic tags</p><div className="tags">{cardKeywords(card).map(word=><span key={word}>{word}</span>)}</div></section>}
          {card.ownership && (
            <details className="source-fields">
              <summary>Original import fields</summary>
              <p>
                Includes any condition, binder, and purchase information from
                your export.
              </p>
              <pre>{JSON.stringify(card.ownership.sourceRows, null, 2)}</pre>
            </details>
          )}
          {onRemove && <div className="danger-zone"><button className="danger-button" onClick={onRemove}>Remove from Collection</button></div>}
          <CardIntelligence key={card.id} card={card} onSave={onSaveTags} />
          {deck && synergy && <InThisDeck synergy={synergy}/>}
          {collection && card.ownership && <section className="deck-usage" aria-label="Deck Usage"><h3>Deck Usage</h3><p>Owned: {card.ownership.quantityOwned} · Available: {card.ownership.quantityUnassigned} · Assigned: {card.ownership.quantityAssigned}</p>{card.ownership.quantityAssigned>card.ownership.quantityOwned&&<p className="deck-error">Allocation conflict: inventory needs reconciliation.</p>}{deckUsage(collection,card.id).map(u=><p key={u.deck.id}><button className="text-button" onClick={()=>onOpenDeck?.(u.deck.id)}>{u.deck.name} ×{u.quantity}</button></p>)}{!card.ownership.quantityAssigned&&<p>No deck assignments.</p>}</section>}
        </div>
      </div>
      {navigation && (
        <nav className="detail-navigation" aria-label="Deck card navigation">
          <button className="icon-button" aria-label="Previous card" disabled={!previous} onClick={previous}>
            <ChevronLeft size={22} />
            <span className="detail-nav-label">Previous</span>
          </button>
          <span className="detail-position" aria-live="polite">{navigation.position} of {navigation.total}</span>
          <button className="icon-button" aria-label="Next card" disabled={!next} onClick={next}>
            <span className="detail-nav-label">Next</span>
            <ChevronRight size={22} />
          </button>
        </nav>
      )}
    </Dialog>
  );
}
