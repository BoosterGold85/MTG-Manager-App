import { useState } from "react";
import type { CardSynergy } from "../dna/engine";
export function ScoreBreakdown({ synergy }: { synergy: CardSynergy }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details
      className="score-breakdown"
      onToggle={(e) => setExpanded(e.currentTarget.open)}
    >
      <summary>Why this score?</summary>
      {expanded && (
        <>
          <p>
            Six weighted, evidence-based components, less negative adjustments.
            Generic tags, prices and owned quantities do not earn points.
          </p>
          <dl>
            {synergy.components.map((c, index) => (
              <div key={c.label}>
                <dt>{c.label}</dt>
                <dd>
                  {c.points > 0 ? "+" : ""}
                  {c.points}
                  {synergy.recommendation && index < 6
                    ? ` / ${synergy.recommendation.componentCaps[index]}`
                    : ""}
                </dd>
              </div>
            ))}
          </dl>
          {synergy.recommendation && (
            <>
              <h4>Confidence: {synergy.recommendation.confidence}</h4>
              <p>{synergy.recommendation.confidenceReasons.join(" ")}</p>
              <p>
                Commander relationship: {synergy.recommendation.commander.score}
                /25 ·{" "}
                {synergy.recommendation.commander.direct
                  ? "Direct"
                  : "Indirect / none"}
              </p>
              <p>
                80+ eligibility:{" "}
                {synergy.recommendation.gate.reasons.join(" ") ||
                  "No qualifying major interaction or exceptional role gap."}
              </p>
              <h4>Typed effects</h4>
              <p>
                {synergy.recommendation.typedRoles
                  .map((r) => r.replaceAll("_", " "))
                  .join(" · ") || "No resolved typed effect"}
              </p>
            </>
          )}
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
