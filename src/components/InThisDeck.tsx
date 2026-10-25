import { ScoreBreakdown } from "./ScoreBreakdown";
import type { CardSynergy } from "../dna/engine";
export function InThisDeck({ synergy }: { synergy: CardSynergy }) {
  return (
    <section
      className="in-this-deck"
      data-fit={synergy.tier}
      aria-label="In This Deck"
    >
      <p className="eyebrow">DECK-RELATIVE FIT</p>
      <h3>In This Deck</h3>
      <div className="synergy-score">
        <strong>Synergy {synergy.score}</strong>
        <span>{synergy.band}</span>
      </div>
      <p>{synergy.explanation}</p>
      <p>
        Deck-relative strategy, role need and efficiency, less conflicts. This
        is not a universal power rating or a guaranteed upgrade.
      </p>
      <dl>
        <div>
          <dt>Recorded theme / tag connections</dt>
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
            {synergy.debug.commanderInteractions.join(" · ") ||
              "No direct Commander interaction identified"}
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
      {synergy.conflicts.length > 0 && (
        <section aria-label="Conflicts">
          <h4>Conflicts</h4>
          <ul>
            {synergy.conflicts.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </section>
      )}
      <ScoreBreakdown synergy={synergy} />
      <details>
        <summary>Card tag evidence</summary>
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
