import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import type { CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import type { SampleCollectionCard } from "../models/card";
import type { DeckDna } from "../dna/engine";
import { deckCount, deckStats } from "../decks/decks";
import { deckHealth } from "../upgrades";
import { CardImage } from "./CardImage";
import { identityName } from "../decks/workspace";

const round = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
/** Overview answers "what does this deck do and what does it need?" before any methodology. */
export function DeckOverview({
  state,
  deck,
  dna,
  commanderCard,
  onCommander,
  onViewTheme,
}: {
  state: CollectionState;
  deck: Deck;
  dna: DeckDna | null;
  commanderCard: (index: number) => SampleCollectionCard;
  onCommander: (index: number) => void;
  onViewTheme: (themeId: string) => void;
}) {
  const health = useMemo(() => deckHealth(state, deck), [state, deck]);
  const stats = deckStats(state, deck);
  const short = health.filter((h) => h.status === "Low" || h.status === "Slightly Low");
  return (
    <div className="deck-overview">
      <section aria-label="Commander" className="deck-commander">
        {deck.commanders.map((c, i) => {
          const card = commanderCard(i);
          return (
            <div key={`${c.itemId || c.scryfallId}-${i}`}>
              <button className="commander-art deck-art-button" aria-label={`Open ${c.name} details`} onClick={() => onCommander(i)}>
                <CardImage card={card} />
              </button>
              <div>
                <p className="eyebrow">COMMANDER</p>
                <h2>
                  <button className="commander-name" onClick={() => onCommander(i)}>
                    {c.name}
                  </button>
                </h2>
                <p className="commander-identity">{identityName(deck)}</p>
                <p className="meta-text">
                  {card.setCode.toUpperCase()} #{card.collectorNumber}
                  {c.itemId && card.ownership ? ` · ${card.ownership.finish}` : ""}
                  {card.ownership
                    ? ` · Owned ${card.ownership.quantityOwned} · Assigned ${card.ownership.quantityAssigned} · Available ${card.ownership.quantityUnassigned}`
                    : " · Missing — no owned copy assigned"}
                </p>
              </div>
            </div>
          );
        })}
        {deck.commanders.length > 1 && <p className="meta-text">Partner/Background pairing rules are not validated.</p>}
      </section>
      {dna && (
        <section className="overview-block dna-summary" aria-label="What This Deck Does">
          <h2>What This Deck Does</h2>
          <p className="prose">{dna.summary}</p>
        </section>
      )}
      <section className="overview-block deck-health" aria-label="Deck Health">
        <h2>Deck Health</h2>
        <p className="prose">
          {short.length
            ? `Short on ${short.map((h) => h.label.toLowerCase()).join(", ")}.`
            : "Every structural role meets this Commander's targets."}
        </p>
        <dl>
          {health.map((h) => (
            <div key={h.need} className={`health-row health-${h.status.toLowerCase().replace(" ", "-")}`}>
              <dt>{h.label}</dt>
              <dd>
                <span className="health-count">
                  {round(Math.round(h.count * 10) / 10)} / {h.target}
                </span>
                <span className="health-status">{h.status}</span>
              </dd>
            </div>
          ))}
        </dl>
        <details className="method">
          <summary>How targets are set</summary>
          <p className="meta-text">
            Targets come from this Commander's blueprint, the same targets Upgrade Value uses. Counts use the same card roles as
            upgrade scoring; partial roles (for example single-mode protection) count as a fraction.
          </p>
          <ul>
            {health.map((h) => (
              <li key={h.need} className="meta-text">
                {h.label}: {h.reasons.join(" ")}
              </li>
            ))}
          </ul>
        </details>
      </section>
      {dna && (
        <section className="overview-block dna-core" aria-label="Core Plan">
          <h2>Core Plan</h2>
          <dl>
            <div>
              <dt>Primary</dt>
              <dd>{dna.core.primary.join(" / ") || "Insufficient theme evidence"}</dd>
            </div>
            <div>
              <dt>Supporting</dt>
              <dd>{dna.core.support.join(" · ") || "No repeated supporting engine identified"}</dd>
            </div>
            <div>
              <dt>Key payoff</dt>
              <dd>{dna.core.payoff}</dd>
            </div>
          </dl>
          {dna.central.length > 0 && (
            <>
              <h3>Key cards</h3>
              <p>{dna.central.map((c) => c.name).join(" · ")}</p>
            </>
          )}
        </section>
      )}
      {dna && (
        <section className="overview-block deck-dna" aria-label="Deck DNA">
          <h2>Deck DNA</h2>
          <p className="meta-text">Relative theme weights, not power or card-quality ratings.</p>
          {dna.themes.length ? (
            <ul className="dna-themes">
              {dna.themes.map((theme) => (
                <li key={theme.id} className="dna-theme">
                  <span className="dna-theme-name">{theme.label}</span>
                  <span className="dna-theme-percent">{theme.percent}%</span>
                  <span className="dna-theme-track" aria-hidden="true">
                    <span style={{ width: `${theme.percent}%` }} />
                  </span>
                  <span className="meta-text">
                    {theme.contributors.length} contributing {theme.contributors.length === 1 ? "card" : "cards"}
                  </span>
                  <button className="text-button" onClick={() => onViewTheme(theme.id)}>
                    View Cards<span className="sr-only"> for {theme.label}</span> <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>Not enough repeated theme evidence yet. Add deck cards to build a clearer picture.</p>
          )}
        </section>
      )}
      <details className="deck-statistics">
        <summary>Basic Composition · {deckCount(deck)} cards</summary>
        <ul>
          {Object.entries(stats.counts).map(([type, count]) => (
            <li key={type}>
              {type}: {count}
            </li>
          ))}
        </ul>
        <p>Average nonland mana value: {stats.average.toFixed(2)}</p>
      </details>
      {dna && (
        <details className="dna-method">
          <summary>How this analysis was calculated</summary>
          <p className="meta-text">
            Explicit payoffs weigh more than enablers, supporting effects or characteristics. Repeated independent cards reinforce a
            theme; related tags on one card are capped. Commander evidence is amplified, then capped at 45% of the main deck’s base
            evidence per theme. The actual decklist controls the result.
          </p>
          <p className="meta-text">
            Primary weights sum to 100% when themes are supported. They are not the percentage of cards carrying a tag. Missing cards
            count equally. Synergy uses a separate deck strategy profile, contextual role needs, efficiency and explicit penalties.
            Canonical facts and verified rules relationships earn points; generic tags alone do not.
          </p>
          <p className="meta-text">Color identity is enforced. Other Commander rules, singleton limits, banned cards and Partner combinations are not fully validated.</p>
          {dna.themes.map((theme) => (
            <details key={theme.id}>
              <summary>
                {theme.label} · {theme.contributors.length} non-commander identities
              </summary>
              <p className="meta-text">
                Deck evidence: {theme.deckWeight.toFixed(1)} · Commander reinforcement: {theme.commanderWeight.toFixed(1)} weighted units
              </p>
              <p className="meta-text">Subthemes: {theme.subthemes.map((t) => `${t.label} (${t.cards})`).join(" · ")}</p>
              {theme.evidence.map((e) => (
                <details key={`${e.name}-${e.commander}`}>
                  <summary>
                    {e.name}
                    {e.commander ? " · Commander" : ""}
                  </summary>
                  {e.signals.map((s) => (
                    <div key={s.tagId}>
                      <strong>
                        {s.label} · {s.kind}
                      </strong>
                      {s.evidence.map((proof, i) => (
                        <p key={i} className="meta-text">
                          <q>{proof.snippet}</q> — {proof.reason} <span className="muted">({proof.field})</span>
                        </p>
                      ))}
                    </div>
                  ))}
                </details>
              ))}
            </details>
          ))}
          {dna.warnings.map((w) => (
            <p key={w} className="meta-text">
              {w}
            </p>
          ))}
        </details>
      )}
    </div>
  );
}
