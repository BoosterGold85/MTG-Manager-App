import { useEffect, useMemo, useRef, useState } from "react";
import type { CardMetadata, CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import type { DeckChange } from "../storage/deckRepository";
import { deckIntelligence, explainCandidate } from "../deckIntelligence/analysis";
import type { SynergyChain } from "../deckIntelligence/analysis";
import { scryfallClient } from "../import/scryfall";
import { CardDetail } from "./CardDetail";
import { needLabels } from "../upgrades/cardFunction";
import type { Need } from "../upgrades/cardFunction";

type Props = { state: CollectionState; deck: Deck; busy: boolean; change: (action: DeckChange, success: string) => Promise<boolean> };
const labels = { full: "Fully analyzed", partial: "Partially analyzed", unresolved: "Unresolved", unverified: "Unverified" };
function Chain({ chain, cards, open }: { chain: SynergyChain; cards: Map<string, CardMetadata>; open: (card: CardMetadata) => void }) {
  const a = cards.get(chain.producer), b = cards.get(chain.consumer);
  return <details className="intelligence-evidence"><summary>{a?.name} {chain.direction === "partners" ? "↔" : "→"} {b?.name} · {chain.status.replaceAll("-", " ")} · {chain.mechanism}</summary>
    <p>{chain.explanation}</p>
    {a && <button className="text-button" onClick={() => open(a)}>Read {a.name}</button>}
    {b && <button className="text-button" onClick={() => open(b)}>Read {b.name}</button>}
    {chain.evidence.map((e, i) => <p className="meta-text" key={i}><strong>{e.name}: </strong><q>{e.text}</q></p>)}
    <ul>{chain.restrictions.map(r => <li key={r}>{r}</li>)}</ul>
  </details>;
}
export function DeckIntelligence({ state, deck, busy, change }: Props) {
  const report = useMemo(() => deckIntelligence(state, deck), [state, deck]);
  const [plan, setPlan] = useState(deck.intelligenceIntent?.plan || ""), [target, setTarget] = useState<"casual" | "competitive">(deck.intelligenceIntent?.target || "casual");
  const [detail, setDetail] = useState<CardMetadata>(), [refreshing, setRefreshing] = useState(false), [error, setError] = useState(""), [progress, setProgress] = useState(""), [issues, setIssues] = useState<Record<string, string>>({});
  const [chainLimit, setChainLimit] = useState(12);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const cards = useMemo(() => new Map(report.rows.map(r => [r.identity, r.card])), [report]);
  async function refresh(ids: string[]) {
    const selected = report.coverage.entries.filter(r => ids.includes(r.entry.id));
    if (!selected.length) return;
    setRefreshing(true); setError(""); setProgress(`Refreshing ${selected.length} selected entries…`);
    const next = new AbortController(); controller.current = next;
    try {
      const result = await scryfallClient.refreshDeckMetadata(selected.map(r => ({ key: r.entry.id, name: r.entry.name, scryfallId: r.entry.scryfallId, set: r.entry.requestedPrinting?.setCode.toLowerCase(), collector_number: r.entry.requestedPrinting?.collectorNumber?.toLowerCase() })), next.signal);
      if (next.signal.aborted) return;
      setIssues(current => ({ ...Object.fromEntries(Object.entries(current).filter(([id]) => !ids.includes(id))), ...result.issues }));
      if (Object.keys(result.resolved).length) {
        const saved = await change({ type: "deck-metadata", deckId: deck.id, metadata: result.metadata, resolved: result.resolved }, "Selected card metadata refreshed. Deck quantities, assignments and intent are preserved.");
        if (!saved) setError("Lookup results could not be saved. Saved data was retained; retry the selected entries.");
      }
      setProgress(`${Object.keys(result.resolved).length} metadata matches returned · ${Object.keys(result.issues).length} entries need attention. Review printing, Oracle and legality states below.`);
    } catch (e) { if (!next.signal.aborted) setError(e instanceof Error ? e.message : "Refresh failed. Retry selected entries."); }
    finally { if (!next.signal.aborted) setRefreshing(false); }
  }
  const pending = report.coverage.entries.filter(r => r.status !== "full" || r.printing !== "exact" || ["unverified", "unavailable"].includes(r.finish) || issues[r.entry.id]);
  return <div className="deck-intelligence">
    <section className="overview-block" aria-label="Card Analysis Coverage"><h2>Card Analysis Coverage</h2>
      <p>{report.coverage.entries.length} unique printing entries · {report.coverage.total} total copies · {report.coverage.groups.length} canonical cards across all boards.</p>
      <div className="intelligence-summary">{Object.entries(report.coverage.counts).map(([key, count]) => <div key={key}><strong>{labels[key as keyof typeof labels]}</strong><p>{count.entries} entries · {count.quantity} copies</p></div>)}</div>
      <p className="meta-text">These counts describe Oracle/mechanical analysis. Printing, finish, format legality and ownership are checked separately. Fully analyzed means recognized by this interpreter, not every interaction proven.</p>
      {deck.importIssues && deck.importIssues.length > 0 && <p>{deck.importIssues.length} source rows were not imported and are excluded from these counts. Review Settings for the original rows.</p>}
      {!!deck.entries?.length && <button className="management-button" disabled={busy || refreshing || !pending.length} onClick={() => void refresh(pending.map(r => r.entry.id))}>{refreshing ? "Refreshing metadata…" : "Refresh entries needing attention"}</button>}
      {progress && <p role="status">{progress}</p>}{error && <p role="alert">{error}</p>}
      <details><summary>Exact cards and analysis explanations</summary><ul className="intelligence-card-list">{report.coverage.entries.map(r => <li key={r.entry.id}>
        <details><summary>{r.entry.quantity} × {r.entry.name} · {r.entry.board} · {labels[r.status]}</summary>
          <p>{r.entry.requestedPrinting ? `${r.entry.requestedPrinting.setCode.toUpperCase()} #${r.entry.requestedPrinting.collectorNumber || "unspecified"}` : r.card ? `${r.card.setCode.toUpperCase()} #${r.card.collectorNumber || "unspecified"}` : "No resolved printing"} · {r.entry.requestedFinish || r.entry.requestedPrinting?.finish || "finish unspecified"}</p>
          <p>Printing: {r.printing} · Finish: {r.finish} · Oracle data: {r.oracle} · Mechanics: {r.mechanical?.state || "unverified"}</p>
          <p>Legality: {r.legality.status.replaceAll("_", " ")} · {r.legality.freshness}. {r.owned} canonical copies owned · {r.allocated} copies allocated to this entry.</p>
          {r.basic ? <p>Basic land: tracked in the decklist without exclusive allocation.</p> : r.allocated < r.entry.quantity && <p>{r.entry.quantity - r.allocated} copies have no physical assignment; this does not mean their rules are missing.</p>}
          <ul>{r.explanations.map(e => <li key={e}>{e}</li>)}</ul>
          {issues[r.entry.id] && <p role="status">Last refresh: {issues[r.entry.id]}</p>}
          {r.card && <button className="text-button" onClick={() => setDetail(r.card)}>Read {r.card.name}</button>}
          {!!deck.entries?.length && <button className="text-button" disabled={busy || refreshing} onClick={() => void refresh([r.entry.id])}>Refresh metadata for {r.entry.name}</button>}
        </details>
      </li>)}</ul></details>
    </section>
    <section className="overview-block" aria-label="Deck Strategy"><h2>Deck Strategy</h2>
      <p>{deck.intelligenceIntent?.plan ? `Your stated plan: ${deck.intelligenceIntent.plan}` : report.goals[0] ? `Inferred primary plan: ${report.goals[0].label} · ${report.goals[0].confidence} confidence.` : "Insufficient verified relationships to infer a clear game plan."}</p>
      <p className="meta-text">Optimization target: {deck.intelligenceIntent?.target || "casual"}. This is your preference; Plan Fit and Brew Score remain the existing heuristics, not tournament readiness or win-rate estimates.</p>
      <details><summary>Strategy evidence and supporting roles</summary>
        {report.goals.slice(0, 2).map((g, i) => <div key={g.label}><h3>{i ? "Secondary" : "Primary"}: {g.label}</h3><p>{g.confidence} confidence · conditional relationships</p><p>Enablers: {g.enablers.join(" · ")} ({report.rows.filter(r => g.enablers.includes(r.card.name)).reduce((n, r) => n + r.quantity, 0)} main-deck copies)</p><p>Payoffs: {g.payoffs.join(" · ")} ({report.rows.filter(r => g.payoffs.includes(r.card.name)).reduce((n, r) => n + r.quantity, 0)} main-deck copies)</p><ul>{g.evidence.slice(0, 8).map(e => <li key={e}>{e}</li>)}</ul></div>)}
        <p>Explicit win-condition text: {report.wins.join(" · ") || "None verified. No deterministic win is inferred."}</p>
        <p>Modeled finishers / pressure: {report.threats.join(" · ") || "No supported finisher role identified."}</p>
        <p>Other supporting cards: {report.supporting.join(" · ") || "None classified beyond the listed relationships."}</p>
        <p>Confidence is bounded by Oracle coverage and distinct supported partners. Sideboard cards do not establish the main-deck plan. Theme similarity alone does not establish a chain.</p>
      </details>
      <details><summary>Set deck intent and optimization target</summary><form onSubmit={e => { e.preventDefault(); void change({ type: "deck-intent", deckId: deck.id, plan, target }, "Deck intent saved. Card assignments are unchanged."); }}>
        <label>Your deck plan<textarea maxLength={500} value={plan} onChange={e => setPlan(e.target.value)} /></label>
        <label>Optimization target<select value={target} onChange={e => setTarget(e.target.value as typeof target)}><option value="casual">Casual</option><option value="competitive">Competitive</option></select></label>
        <button className="management-button" disabled={busy}>Save deck intent</button>
      </form></details>
    </section>
    <section className="overview-block" aria-label="Synergy Chains"><h2>Synergy Chains</h2>
      <p>{report.chains.filter(c => c.status === "conditional").length} conditional relationships · {report.chains.filter(c => c.status === "rule-conflict").length} invalid proposed interactions · {report.chains.filter(c => c.status === "unresolved").length} unresolved.</p>
      <details><summary>Explore cards and interaction evidence</summary><p className="meta-text">These chains describe potential plays, not proven combos. Confirmed describes an unconditional rules relationship; conditional requires the stated costs, targets or timing. Thematic similarities and unsupported guesses receive no synergy credit.</p>
        {report.chains.slice(0, chainLimit).map(c => <Chain key={c.id} chain={c} cards={cards} open={setDetail} />)}
        {report.chains.length > chainLimit && <button className="text-button" onClick={() => setChainLimit(n => n + 20)}>Show more relationships</button>}
        {!report.chains.length && <p>No supported chains were identified from available Oracle data.</p>}
      </details>
    </section>
    <section className="overview-block" aria-label="Weaknesses"><h2>Weaknesses</h2><p>{report.weaknesses.length} evidence-based observations to review. Legality and competitive readiness are separate.</p>
      <details><summary>Strengths, gaps and composition</summary><h3>Strengths</h3><ul>{report.strengths.map(s => <li key={s}>{s}</li>)}</ul><h3>Gaps / uncertainty</h3><ul>{report.weaknesses.map(s => <li key={s}>{s}</li>)}</ul>
        <p>{report.landCount} verified land copies · average verified nonland mana value {report.averageMana.toFixed(2)}.</p>
        <p>Nonland curve: {Object.entries(report.curve).map(([mv, n]) => `${mv}: ${n}`).join(" · ") || "Unavailable"}</p>
        <p>Modeled role contributions (weighted units, overlapping effects): {Object.entries(report.roles).map(([role, n]) => `${needLabels[role as Need]}: ${(n || 0).toFixed(1)}`).join(" · ") || "Unverified"}.</p>
        <p>Saved land production: {Object.entries(report.mana).map(([color, n]) => `${color}: ${n} copies`).join(" · ") || "Unverified"}. Multicolor sources overlap; entry/tap costs and sequencing still apply.</p>
        <p>Composition is descriptive, not a universal land/role ratio. Partial abilities can contribute only the roles the existing interpreter recognizes.</p>
      </details>
    </section>
    {detail && <CardDetail referenceOnly card={{ ...detail, id: detail.scryfallId, quantity: 0 }} collection={state} onClose={() => setDetail(undefined)} />}
  </div>;
}

/** Deferred until expanded; explanation never changes the existing candidate's score or order. */
export function CandidateIntelligence({ state, deck, card, cutId, quantity = 1 }: { state: CollectionState; deck: Deck; card: CardMetadata; cutId?: string; quantity?: number }) {
  const [expanded, setExpanded] = useState(false);
  const result = useMemo(() => expanded ? explainCandidate(state, deck, card, cutId, quantity) : undefined, [expanded, state, deck, card, cutId, quantity]);
  return <details onToggle={e => setExpanded(e.currentTarget.open)}><summary>Deck goals, partners and role changes</summary>{result && <>
    <p>Supports: {result.before.goals.filter(g => result.links.some(c => g.enablers.concat(g.payoffs).some(n => c.evidence.some(e => e.name === n)))).map(g => g.label).join(" · ") || "No established goal relationship verified."}</p>
    <ul>{result.links.slice(0, 8).map(c => <li key={c.id}>{c.status}: {c.explanation} {c.restrictions.join(" ")}</li>)}</ul>
    {!result.links.length && <p>No specific verified partner interaction; generic utility alone does not prove plan support.</p>}
    {result.after && <><p>Before → after modeled role coverage (weighted units):</p><ul>{result.roleChanges.map(r => <li key={r.label}>{r.label}: {r.before.toFixed(1)} → {r.after.toFixed(1)}</li>)}</ul>
      <p>{result.gained.length} relationship types gained · {result.lost.length} lost. Multiple copies affect role density; these relationship counts use canonical pairs.</p>
      {result.lost.map(c => <p key={c.id}>Lost: {c.explanation}</p>)}{result.gained.map(c => <p key={c.id}>Added: {c.explanation}</p>)}</>}
    <p className="meta-text">Preview only. Existing Plan Fit and Brew Score calculations are unchanged. Assignments change only through the separate confirmation action.</p>
  </>}</details>;
}
