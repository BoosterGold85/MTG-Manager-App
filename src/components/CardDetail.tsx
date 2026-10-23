import { Sparkles } from "lucide-react";
import type { SampleCollectionCard } from "../models/card";
import { colorOptions } from "../utils/filters";
import { Dialog } from "./Dialog";
import { CardImage } from "./CardImage";
export function CardDetail({
  card,
  onClose,
  onRemove,
}: {
  card: SampleCollectionCard;
  onClose: () => void;
  onRemove?: () => void;
}) {
  return (
    <Dialog titleId="detail-title" onClose={onClose} className="detail-dialog">
      <div className="drawer-handle" />
      <div
        className="detail-layout"
        tabIndex={0}
        role="region"
        aria-label="Card details"
      >
        <div className="detail-art">
          <CardImage card={card} detail />
          {card.artist && (
            <p className="artist">Illustrated by {card.artist}</p>
          )}
        </div>
        <div className="detail-copy">
          <p className="eyebrow">FROM YOUR COLLECTION</p>
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
            <div>
              <dt>In your binder</dt>
              <dd>
                {card.quantity} {card.quantity === 1 ? "copy" : "copies"}{" "}
                <span className="finish">
                  {card.foil ? "✧ Foil" : "Nonfoil"}
                </span>
              </dd>
            </div>
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
          <section className="intelligence">
            <div className="section-label">
              <Sparkles size={16} />
              <h3>Card Intelligence</h3>
              <span className="preview-badge">Preview</span>
            </div>
            <p>
              {card.ownership
                ? "No automated analysis in this release"
                : "Manually curated sample tags"}
            </p>
            <div className="tags">
              {card.tags?.length ? (
                card.tags.map((tag) => <span key={tag}>{tag}</span>)
              ) : (
                <span>
                  {card.ownership ? "No curated tags" : "No sample tags"}
                </span>
              )}
            </div>
          </section>
        </div>
      </div>
    </Dialog>
  );
}
