import { collectionRepository } from "../storage/collectionRepository";
import { emptyCollection } from "../models/collection";
import type { CollectionRepository } from "../models/collection";
import { useEffect, useRef, useState } from "react";
import { FileUp, LoaderCircle, TriangleAlert } from "lucide-react";
import type { CollectionState } from "../models/collection";
import type { DeckImportIssue } from "../models/deck";
import type { DeckRepository } from "../storage/deckRepository";
import { LookupInterrupted } from "../import/scryfall";
import { prepareDeckImport } from "../decks/prepareDeckImport";
import {
  blockingIssues,
  claimed,
  colorConflicts,
  deckImportSummary,
  duplicateName,
  finalizeDeckImport,
  initialChoices,
  issuesText,
  picked,
} from "../decks/deckImport";
import type { DeckImportChoices, DeckImportPreview, PreviewEntry } from "../decks/deckImport";
import { Dialog } from "./Dialog";

const printing = (p: { setCode: string; collectorNumber?: string }) =>
  `${p.setCode.toUpperCase()}${p.collectorNumber ? ` #${p.collectorNumber}` : ""}`;
function downloadIssues(issues: DeckImportIssue[]) {
  const url = URL.createObjectURL(new Blob([issuesText(issues)], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "mtg-manager-unresolved-deck-rows.txt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function DeckIssues({ issues, title = "Problem rows" }: { issues: DeckImportIssue[]; title?: string }) {
  const [copied, setCopied] = useState("");
  if (!issues.length) return null;
  return (
    <section className="import-problems" aria-label={title}>
      <div className="import-section-title">
        <h3>
          {title} · {issues.length}
        </h3>
        <span>
          <button
            className="text-button"
            onClick={() =>
              navigator.clipboard
                ?.writeText(issuesText(issues))
                .then(() => setCopied("Unresolved rows copied."))
                .catch(() => setCopied("Copy is unavailable. Use Download instead."))
            }
          >
            Copy unresolved rows
          </button>
          <button className="text-button" onClick={() => downloadIssues(issues)}>
            Download unresolved rows
          </button>
        </span>
      </div>
      <p>These lines are kept exactly as written. Nothing was guessed for them.</p>
      <ol>
        {issues.map((issue, i) => (
          <li key={`${issue.line}-${i}`}>
            <strong>
              Line {issue.line} · {issue.text}
            </strong>
            <p>{issue.reason}</p>
          </li>
        ))}
      </ol>
      <p role="status">{copied}</p>
    </section>
  );
}
function entryState(entry: PreviewEntry, choices: DeckImportChoices, conflict: boolean) {
  if (conflict) return { mark: "!", text: "Outside commander color identity — kept in decklist, no copy will be assigned" };
  if (!choices.reviewed.includes(entry.key)) return { mark: "?", text: "Choose a printing" };
  const picks = choices.picks[entry.key] || {};
  const assigned = picked(picks);
  const quantity = choices.commanders.includes(entry.key) ? 1 : entry.quantity;
  const alternate = Object.entries(picks).some(([id, q]) => q > 0 && !entry.options.find((o) => o.itemId === id)?.exact);
  const rest = quantity - assigned;
  const restText = rest ? ` · ${rest} ${entry.owned ? "unassigned" : "missing"}` : "";
  if (assigned)
    return entry.requested && alternate
      ? { mark: "~", text: `Different printing available${restText}` }
      : { mark: "✓", text: `${entry.requested ? "Exact owned copy" : "Owned copy"}${restText}` };
  if (!entry.owned) return { mark: "—", text: "Missing" };
  if (!entry.available) return { mark: "!", text: "Owned but already fully assigned" };
  return { mark: "—", text: "Owned · left unassigned" };
}
export function DeckImport({
  state: initialState,
  collection = collectionRepository,
  repository,
  onClose,
  onImported,
}: {
  state: CollectionState;
  collection?: CollectionRepository;
  repository: DeckRepository;
  onClose: () => void;
  onImported: (state: CollectionState, deckId: string) => void;
}) {
  const [state,setOwnershipState]=useState(initialState);
  const [ownershipReady,setOwnershipReady]=useState(false);
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"source" | "lookup" | "interrupted" | "ownership-error" | "preview" | "saving">("source");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<DeckImportPreview | null>(null);
  const [choices, setChoices] = useState<DeckImportChoices | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const last = useRef<{ text: string; filename?: string } | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function prepare(source: string, filename?: string) {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    last.current = { text: source, filename };
    setError("");
    setPreview(null);setChoices(null);setOwnershipReady(false);
    setPhase("lookup");
    setProgress("Reading decklist…");
    let current:CollectionState;
    try { current=await collection.load() || emptyCollection(); }
    catch {
      if(next.signal.aborted)return;
      // Repository errors retain their original cause; show an actionable ownership message here.
      setError("MTG Manager could not read your collection from this device. Your deck has not been imported. Retry the ownership check or reload the app.");
      setPhase("ownership-error");return;
    }
    if(next.signal.aborted)return;
    try {
      const result = await prepareDeckImport(source, current, next.signal, setProgress, { filename });
      if (next.signal.aborted) return;
      setOwnershipState(current);setOwnershipReady(true);
      setPreview(result);
      setChoices(initialChoices(result));
      setPhase("preview");
    } catch (reason) {
      if (next.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : "Could not read this decklist.");
      setPhase(reason instanceof LookupInterrupted ? "interrupted" : "source");
    }
  }
  async function choose(file: File) {
    if (file.size > 1024 * 1024) {
      setError("This deck file is too large. Choose a ManaBox deck export.");
      return;
    }
    await prepare(await file.text(), file.name);
  }
  async function confirm() {
    if (!preview || !choices || !ownershipReady || phase!=="preview") return;
    setPhase("saving");
    setError("");
    try {
      const { deck, metadata } = finalizeDeckImport(preview, state, choices);
      const next = await repository.change(state, { type: "import", deck, metadata, allowDuplicateName: choices.allowDuplicateName });
      onImported(next, deck.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this deck. Nothing was changed.");
      setPhase("preview");
    }
  }
  const update = (fn: (c: DeckImportChoices) => DeckImportChoices) => setChoices((c) => (c ? fn(structuredClone(c)) : c));
  const conflicts = preview && choices ? new Set(colorConflicts(preview, choices).map((e) => e.key)) : new Set<string>();
  const summary = preview && choices ? deckImportSummary(preview, choices) : null;
  const blocking = preview && choices ? blockingIssues(preview, state, choices) : [];
  const duplicate = choices ? duplicateName(state, choices.name) : false;
  const options = (entry: PreviewEntry) => {
    if (!choices) return null;
    const others = claimed(choices, entry.key);
    const picks = choices.picks[entry.key] || {};
    const limit = choices.commanders.includes(entry.key) ? 1 : entry.quantity;
    const review = !choices.reviewed.includes(entry.key);
    return (
      <div className="deck-import-options" role="group" aria-label={`Copies for ${entry.name}`}>
        {entry.options.map((o) => {
          const count = picks[o.itemId] || 0;
          const free = o.available - (others.get(o.itemId) || 0) - count;
          return (
            <div key={o.itemId} className="deck-import-option">
              <span>
                {printing(o)} · {o.finish} · {o.language} · {o.condition} · Available {o.available}
                {o.exact ? " · requested printing" : ""}
              </span>
              <span className="deck-import-stepper">
                <button
                  className="icon-button"
                  aria-label={`One fewer ${entry.name} ${printing(o)} ${o.finish}`}
                  disabled={!count}
                  onClick={() => update((c) => ({ ...c, picks: { ...c.picks, [entry.key]: { ...c.picks[entry.key], [o.itemId]: count - 1 } } }))}
                >
                  −
                </button>
                <output aria-label={`${entry.name} ${printing(o)} ${o.finish} selected`}>{count}</output>
                <button
                  className="icon-button"
                  aria-label={`Use one ${entry.name} ${printing(o)} ${o.finish}`}
                  disabled={free < 1 || picked(picks) >= limit}
                  onClick={() => update((c) => ({ ...c, picks: { ...c.picks, [entry.key]: { ...c.picks[entry.key], [o.itemId]: count + 1 } } }))}
                >
                  +
                </button>
              </span>
            </div>
          );
        })}
        {review && (
          <button
            className="management-button"
            onClick={() => update((c) => ({ ...c, reviewed: [...c.reviewed, entry.key] }))}
          >
            {picked(picks) ? `Use selected copies for ${entry.name}` : `Leave ${entry.name} unassigned`}
          </button>
        )}
      </div>
    );
  };
  const row = (entry: PreviewEntry) => {
    const s = entryState(entry, choices!, conflicts.has(entry.key));
    const quantity = entry.quantity;
    return (
      <li key={entry.key} className="deck-import-entry">
        <strong>
          {entry.name} ×{quantity}
          {choices!.commanders.includes(entry.key) ? " · Commander" : ""}
        </strong>
        {entry.requested && <p>Deck requests: {printing(entry.requested)}</p>}
        <p>
          Owned: {entry.owned ? [...new Set(entry.options.map((o) => printing(o)))].join(", ") : 0} · Available: {entry.available}
        </p>
        {entry.usedBy.length > 0 && !entry.available && (
          <p>Used in: {entry.usedBy.map((u) => `${u.deckName} ×${u.quantity}`).join(" · ")}</p>
        )}
        {entry.notes.map((n) => (
          <p key={n} className="import-warning">
            {n}
          </p>
        ))}
        <p className={`deck-import-state state-${s.mark === "✓" ? "exact" : s.mark === "~" ? "alternate" : s.mark === "?" ? "review" : "missing"}`}>
          <span aria-hidden="true">{s.mark}</span> {s.text}
        </p>
        {!conflicts.has(entry.key) && entry.available > 0 &&
          (choices!.reviewed.includes(entry.key) ? (
            <details>
              <summary>Change copies for {entry.name}</summary>
              {options(entry)}
            </details>
          ) : (
            options(entry)
          ))}
      </li>
    );
  };
  return (
    <Dialog titleId="deck-import-title" className="import-dialog" onClose={onClose} closeDisabled={phase === "saving"}>
      <div className="drawer-handle" />
      <header className="dialog-heading">
        <p className="eyebrow">COMMANDER LIBRARY</p>
        <h2 id="deck-import-title">Import Deck</h2>
        <p className="import-subtitle">Bring a ManaBox deck in. Review ownership before anything is saved.</p>
      </header>
      <div className="import-content" role="region" aria-label="Deck import" tabIndex={0}>
        {error && (
          <div className="import-error" role="alert">
            <TriangleAlert size={16} /> {error}
          </div>
        )}
        {(phase === "source" || phase === "interrupted") && (
          <>
            {phase === "interrupted" && (
              <section className="sync-note">
                <h3>Your decklist is safe</h3>
                <p>Card lookup could not finish. Nothing was saved and no rows were marked as bad. Check your connection, then retry.</p>
              </section>
            )}
            <div role="group" aria-label="Import source" className="deck-tabs">
              <button className={`chip ${mode === "file" ? "selected" : ""}`} aria-pressed={mode === "file"} onClick={() => setMode("file")}>
                Upload ManaBox deck file
              </button>
              <button className={`chip ${mode === "paste" ? "selected" : ""}`} aria-pressed={mode === "paste"} onClick={() => setMode("paste")}>
                Paste decklist text
              </button>
            </div>
            {mode === "file" ? (
              <section className="import-upload">
                <span className="import-emblem">
                  <FileUp size={26} />
                </span>
                <p>In ManaBox, open the deck → ⋯ → Export, then choose the text file here. Lines like “1 Sol Ring (CMM) 410” are supported.</p>
                <input
                  ref={input}
                  className="sr-only"
                  type="file"
                  aria-label="ManaBox deck file"
                  accept=".txt,.dec,.dek,text/plain"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void choose(file);
                  }}
                />
                <button className="primary-button" onClick={() => input.current?.click()}>
                  Choose deck file
                </button>
              </section>
            ) : (
              <form
                className="deck-import-paste"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (text.trim()) void prepare(text);
                }}
              >
                <label>
                  Decklist text
                  <textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Commander\n1 Meren of Clan Nel Toth (CMM) 346\n\nDeck\n1 Sol Ring\n1 Skullclamp (C14) 268"} />
                </label>
                <button className="primary-button" disabled={!text.trim()}>
                  Preview import
                </button>
              </form>
            )}
            <p className="allocation-copy">No account connection. Your collection quantities are never changed by importing a deck.</p>
          </>
        )}
        {phase === "ownership-error" && <section className="sync-note"><h3>Ownership check interrupted</h3><p>Your decklist is retained. No ownership results or changes have been saved.</p></section>}
        {phase === "lookup" && (
          <div className="import-progress" role="status">
            <LoaderCircle className="import-spinner" size={31} />
            <p>{progress}</p>
          </div>
        )}
        {(phase === "preview" || phase === "saving") && ownershipReady && preview && choices && summary && (
          <>
            <p className="eyebrow">REVIEW BEFORE SAVING</p>
            <label className="deck-import-name">
              Deck name
              <input value={choices.name} maxLength={120} onChange={(e) => update((c) => ({ ...c, name: e.target.value, allowDuplicateName: false }))} />
            </label>
            {duplicate && (
              <section className="sync-note" aria-label="Deck name conflict">
                <h3>A deck named “{choices.name.trim()}” already exists</h3>
                <p>It will not be overwritten. Import this list as a separate new deck, rename it above, or cancel.</p>
                {choices.allowDuplicateName ? (
                  <p>Will import as a new deck.</p>
                ) : (
                  <span className="deck-import-actions">
                    <button className="management-button" onClick={() => update((c) => ({ ...c, allowDuplicateName: true }))}>
                      Import as new deck
                    </button>
                    <button className="text-button" onClick={onClose}>
                      Cancel
                    </button>
                  </span>
                )}
              </section>
            )}
            <dl className="import-stats" aria-label="Import summary">
              {(
                [
                  ["Cards", summary.total],
                  ["Exact owned copies", summary.exact],
                  ["Alternate printings", summary.alternate],
                  ["Owned · unassigned", summary.allocated],
                  ["Missing", summary.missing],
                  ["Need review", summary.review],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="sync-note">
              {summary.total} cards · {summary.exact + summary.alternate} copies to assign · {summary.missing + summary.allocated} missing or unassigned
              {summary.problems ? ` · ${summary.problems} problem rows` : ""}. Missing cards are kept in the decklist without fake ownership. No copy is moved from another deck.
            </p>
            {preview.warnings.map((w) => (
              <p key={w} className="import-warning">
                <TriangleAlert size={16} /> {w}
              </p>
            ))}
            <section aria-label="Commander selection" className="deck-import-commanders">
              <h3>Commander</h3>
              <p>
                {preview.defaultCommanders.length
                  ? "Taken from the export's Commander section."
                  : preview.candidates.length
                    ? "The export does not identify a commander. Select it from these eligible cards (canonical metadata). Nothing is guessed."
                    : "No card in this list can be a commander according to canonical metadata."}
              </p>
              {preview.candidates.map((key) => {
                const entry = preview.entries.find((e) => e.key === key)!;
                const checked = choices.commanders.includes(key);
                return (
                  <label key={key} className="deck-import-candidate">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && choices.commanders.length >= 2}
                      onChange={() =>
                        update((c) => {
                          const commanders = checked ? c.commanders.filter((k) => k !== key) : [...c.commanders, key];
                          const picks = { ...c.picks, [key]: Object.fromEntries(Object.entries(c.picks[key] || {}).slice(0, 1).map(([id]) => [id, 1])) };
                          return { ...c, commanders, picks };
                        })
                      }
                    />
                    {entry.name} · {entry.card.colorIdentity.join("") || "Colorless"}
                  </label>
                );
              })}
              {choices.commanders.length === 2 && (
                <p className="import-warning">Two commanders selected. Partner/Background pairing rules are not validated.</p>
              )}
            </section>
            {conflicts.size > 0 && (
              <section className="import-problems" aria-label="Color identity conflicts">
                <h3>Outside commander color identity · {conflicts.size}</h3>
                <p>These cards stay in the decklist, flagged, with no physical copy assigned.</p>
                <ul>
                  {preview.entries.filter((e) => conflicts.has(e.key)).map((e) => (
                    <li key={e.key}>
                      {e.name} · {e.card.colorIdentity.join("") || "Colorless"}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {preview.entries.some((e) => !choices.reviewed.includes(e.key)) && (
              <section aria-label="Needs review">
                <h3>Need review</h3>
                <p>Several owned printings could fill these cards. Choose copies, or leave them unassigned.</p>
                <ol className="deck-import-list">{preview.entries.filter((e) => !choices.reviewed.includes(e.key)).map(row)}</ol>
              </section>
            )}
            <section aria-label="Decklist preview">
              <h3>Decklist</h3>
              <ol className="deck-import-list">{preview.entries.filter((e) => choices.reviewed.includes(e.key)).map(row)}</ol>
            </section>
            <DeckIssues issues={preview.issues} />
            {blocking.length > 0 && (
              <section className="import-warning" aria-label="Before importing">
                <ul>
                  {blocking.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
      <footer className="import-footer">
        {phase === "ownership-error" && last.current && <button className="primary-button" onClick={()=>void prepare(last.current!.text,last.current!.filename)}>Retry ownership check</button>}
        {phase === "interrupted" && last.current && (
          <button className="primary-button" onClick={() => void prepare(last.current!.text, last.current!.filename)}>
            Retry lookup
          </button>
        )}
        <button className="text-button" disabled={phase === "saving"} onClick={onClose}>
          Cancel
        </button>
        {(phase === "preview" || phase === "saving" || phase === "ownership-error") && (
          <button className="primary-button" disabled={!ownershipReady || phase === "saving" || blocking.length > 0} onClick={() => void confirm()}>
            {phase === "saving" ? "Saving deck…" : "Confirm import"}
          </button>
        )}
      </footer>
    </Dialog>
  );
}
