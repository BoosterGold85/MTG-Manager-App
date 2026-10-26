import type { DeckDna } from "../dna/engine";
export function DeckDnaPanel({
  dna,
  selected,
  onSelect,
}: {
  dna: DeckDna;
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="deck-dna-block">
      <section className="deck-dna" aria-label="Deck DNA">
        <div className="dna-heading">
          <h2>Deck DNA</h2>
          <span>STRATEGY, EXPLAINED</span>
        </div>
        <p className="dna-caption">
          Relative theme weights, not power or card-quality ratings. Select a
          theme to browse its contributors.
        </p>
        {dna.themes.length ? (
          <div className="dna-themes">
            {dna.themes.map((theme) => (
              <button
                key={theme.id}
                className={`dna-theme ${selected === theme.id ? "selected" : ""}`}
                aria-pressed={selected === theme.id}
                onClick={() => onSelect(selected === theme.id ? "" : theme.id)}
              >
                <span>{theme.label}</span>
                <span>{theme.percent}%</span>
                <span className="dna-theme-track" aria-hidden="true">
                  <span style={{ width: `${theme.percent}%` }} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p>
            Not enough repeated theme evidence yet. Add deck cards to build a
            clearer picture.
          </p>
        )}
        <details className="dna-method">
          <summary>How these themes are weighted</summary>
          <p>
            Explicit payoffs weigh more than enablers, supporting effects or
            characteristics. Repeated independent cards reinforce a theme;
            related tags on one card are capped. Commander evidence is
            amplified, then capped at 45% of the main deck’s base evidence per
            theme. The actual decklist controls the result.
          </p>
          <p>
            Primary weights sum to 100% when themes are supported. They are not
            the percentage of cards carrying a tag. Missing cards count equally.
            Synergy uses a separate deck strategy profile, contextual role needs,
            efficiency and explicit penalties. Canonical facts and verified rules
            relationships earn points; generic tags alone do not. Utility cards
            can still have value outside the main plan.
          </p>
          {dna.themes.map((theme) => (
            <details key={theme.id}>
              <summary>
                {theme.label} · {theme.contributors.length} non-commander
                identities
              </summary>
              <p>
                Deck evidence: {theme.deckWeight.toFixed(1)} · Commander
                reinforcement: {theme.commanderWeight.toFixed(1)} weighted units
              </p>
              <p>
                Subthemes:{" "}
                {theme.subthemes
                  .map((t) => `${t.label} (${t.cards})`)
                  .join(" · ")}
              </p>
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
                        <p key={i}>
                          <q>{proof.snippet}</q> — {proof.reason}{" "}
                          <span className="muted">({proof.field})</span>
                        </p>
                      ))}
                    </div>
                  ))}
                </details>
              ))}
            </details>
          ))}
          {dna.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </details>
      </section>
      <section className="dna-summary" aria-label="What This Deck Does">
        <h3>What This Deck Does</h3>
        <p>{dna.summary}</p>
      </section>
      <details className="dna-core">
        <summary>Core Plan</summary>
        <dl>
          <div>
            <dt>Primary strategy</dt>
            <dd>
              {dna.core.primary.join(" / ") || "Insufficient theme evidence"}
            </dd>
          </div>
          <div>
            <dt>Supporting engines</dt>
            <dd>
              {dna.core.support.join(" · ") ||
                "No repeated supporting engine identified"}
            </dd>
          </div>
          <div>
            <dt>Primary payoff</dt>
            <dd>{dna.core.payoff}</dd>
          </div>
        </dl>
        {dna.central.length > 0 && (
          <>
            <h4>Strategy anchors</h4>
            <p>
              {dna.central
                .map((c) => `${c.name} (Synergy ${c.score})`)
                .join(" · ")}
            </p>
          </>
        )}
      </details>
    </div>
  );
}
