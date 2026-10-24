import type { CardSynergy } from "../dna/engine";
export function InThisDeck({ synergy }: { synergy: CardSynergy }) {
  return (
    <section className="in-this-deck" aria-label="In This Deck">
      <p className="eyebrow">DECK-RELATIVE FIT</p>
      <h3>In This Deck</h3>
      <div className="synergy-score">
        <strong>Synergy {synergy.score}</strong>
        <span>{synergy.band}</span>
      </div>
      <p>{synergy.explanation}</p>
      <p>
        Coarse theme fit, not raw power or card quality. Nearby scores mean
        similar fit.
      </p>
      <dl>
        <div>
          <dt>Strongest Deck DNA connections</dt>
          <dd>
            {synergy.connections
              .slice(0, 3)
              .map((c) => c.label)
              .join(" · ") || "No strong primary-theme connection"}
          </dd>
        </div>
        <div>
          <dt>Commander connection</dt>
          <dd>
            {synergy.commanderConnections
              .map((c) => `${c.name} — ${c.theme}`)
              .join(" · ") ||
              "No explicit shared Commander-theme connection identified"}
          </dd>
        </div>
        <div>
          <dt>Primary role</dt>
          <dd>{synergy.roles[0] || "Theme support where evidenced"}</dd>
        </div>
        {synergy.roles.length > 1 && (
          <div>
            <dt>Supporting roles</dt>
            <dd>{synergy.roles.slice(1, 5).join(" · ")}</dd>
          </div>
        )}
      </dl>
      <details>
        <summary>Why this Synergy score?</summary>
        <p>
          The model combines dominant-theme overlap, breadth of supported
          themes, explicit Commander connections, payoff/enabler relationships
          and supporting roles. Prices, popularity and external rankings are
          excluded. The total is capped at 100 and rounded to the nearest five.
        </p>
        <ul>
          {synergy.components
            .filter((c) => c.points > 0)
            .map((c) => (
              <li key={c.label}>
                {c.label}: {c.points.toFixed(1)} points
              </li>
            ))}
        </ul>
        {synergy.connections.map((con) => (
          <div key={con.themeId}>
            <h4>{con.label}</h4>
            {con.signals.map((signal) => (
              <div key={signal.tagId}>
                <strong>
                  {signal.label} · {signal.kind}
                </strong>
                {signal.evidence.map((e, i) => (
                  <p key={i}>
                    <q>{e.snippet}</q> — {e.reason} ({e.field})
                  </p>
                ))}
              </div>
            ))}
            {con.themeId.startsWith("typal:") &&
              con.signals.some((s) => s.kind === "characteristic") && (
                <p>
                  Matching creature subtypes become stronger support when this
                  deck contains explicit type-based payoffs; subtype alone is
                  weak evidence.
                </p>
              )}
          </div>
        ))}
        {synergy.roleEvidence.length > 0 && (
          <details>
            <summary>Supporting role evidence</summary>
            {synergy.roleEvidence.map((role) => (
              <div key={role.label}>
                <h4>{role.label}</h4>
                {role.evidence.map((proof, i) => (
                  <p key={i}>
                    <q>{proof.snippet}</q> — {proof.reason}
                  </p>
                ))}
              </div>
            ))}
          </details>
        )}
        {synergy.commanderConnections.map((c, i) => (
          <div key={i}>
            <h4>
              Commander: {c.name} · {c.theme}
            </h4>
            {c.evidence.map((e, j) => (
              <p key={j}>
                <q>{e.snippet}</q> — {e.reason}
              </p>
            ))}
          </div>
        ))}
      </details>
    </section>
  );
}
