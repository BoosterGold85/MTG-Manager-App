import { useState } from "react";
import type { CardSynergy } from "../dna/engine";
export function ScoreBreakdown({ synergy }: { synergy: CardSynergy }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details
      className="score-breakdown"
      onToggle={(e) => setExpanded(e.currentTarget.open)}
    >
      <summary>Score breakdown</summary>
      {expanded && (
        <>
          <p>
            Commander interaction (30), primary strategy (25), needed role (15),
            packages (10), contextual efficiency (10), generic overlap (5), and
            curve fit (5), less penalties. Prices and owned quantities do not
            affect these points.
          </p>
          <dl>
            {synergy.components.map((c) => (
              <div key={c.label}>
                <dt>{c.label}</dt>
                <dd>
                  {c.points > 0 ? "+" : ""}
                  {c.points}
                </dd>
              </div>
            ))}
          </dl>
          {synergy.debug.componentReasons.map((c) => (
            <p key={c.label}>
              <strong>{c.label}:</strong> {c.reason}
            </p>
          ))}
          {synergy.debug.penalties.length === 0 && <p>Penalties: 0</p>}
          {synergy.debug.penalties.map((p) => (
            <p key={p.name}>
              <strong>
                {p.name} ({p.value}):
              </strong>{" "}
              {p.reason}
            </p>
          ))}
          <p>
            Raw total: {synergy.debug.rawScore} · Final total:{" "}
            <strong>{synergy.score}</strong> (clamped to 0–100)
          </p>
          {synergy.debug.commanderInteractions.length > 0 && (
            <>
              <h4>Commander interactions</h4>
              <ul>
                {synergy.debug.commanderInteractions.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </>
          )}
          {synergy.debug.packageInteractions.length > 0 && (
            <>
              <h4>Package interactions</h4>
              <ul>
                {synergy.debug.packageInteractions.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </>
          )}
          <p>
            Efficiency and role targets are local heuristics, not an external
            power ranking. Mana needs and individual rules interactions still
            need your review.
          </p>
        </>
      )}
    </details>
  );
}
