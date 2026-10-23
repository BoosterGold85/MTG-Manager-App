import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  FileUp,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type {
  CollectionRepository,
  CollectionState,
  ImportPlan,
  ImportProblem,
} from "../models/collection";
import { collectionRepository } from "../storage/collectionRepository";
import { parseFile } from "../import/parseFile";
import { prepareImport } from "../import/prepare";
import { Dialog } from "./Dialog";
function downloadProblems(problems: ImportProblem[]) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(problems, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "mtg-manager-unresolved-rows.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Problems({
  problems,
  title = "Rows to review",
}: {
  problems: ImportProblem[];
  title?: string;
}) {
  if (!problems.length) return null;
  return (
    <section className="import-problems">
      <div className="import-section-title">
        <h3>
          {title} · {problems.length}
        </h3>
        <button
          className="text-button"
          onClick={() => downloadProblems(problems)}
        >
          Download all problem rows
        </button>
      </div>
      <p>
        These rows are kept with their original fields. Correct them in ManaBox
        or your CSV, then re-import.
      </p>
      <ol>
        {problems.slice(0, 20).map((p, i) => (
          <li key={`${p.sourceKey}-${i}`}>
            <strong>
              Row {p.line} · {p.name || "Unnamed card"}
            </strong>
            <p>{p.message}</p>
            <details>
              <summary>Original row</summary>
              <pre>{JSON.stringify(p.raw, null, 2)}</pre>
            </details>
          </li>
        ))}
      </ol>
      {problems.length > 20 && (
        <p>
          Showing the first 20 of {problems.length}. Download includes every
          problem row.
        </p>
      )}
    </section>
  );
}
export function ImportCollection({
  onClose,
  onImported,
  repository = collectionRepository,
}: {
  onClose: () => void;
  onImported: (state: CollectionState) => void;
  repository?: CollectionRepository;
}) {
  const [phase, setPhase] = useState<
    "upload" | "parsing" | "preview" | "importing" | "success" | "error"
  >("upload");
  const [progress, setProgress] = useState("Reading your export…");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [saved, setSaved] = useState<CollectionState | null>(null);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null),
    controller = useRef<AbortController | null>(null),
    mounted = useRef(true),
    committing = useRef(false);
  useEffect(() => {
    mounted.current = true;
    repository
      .load()
      .then((state) => {
        if (mounted.current) setSaved(state);
      })
      .catch((reason) => {
        if (mounted.current)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not read the saved collection.",
          );
      });
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, [repository]);
  async function choose(file: File) {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setError("");
    setPlan(null);
    setPhase("parsing");
    setProgress("Reading your export…");
    try {
      const parsed = await parseFile(file, next.signal);
      setProgress(
        `Parsed ${parsed.totalRows.toLocaleString()} rows. Checking card identities…`,
      );
      const preview = await prepareImport(
        parsed,
        file.name,
        repository,
        next.signal,
        (message) => {
          if (mounted.current) setProgress(message);
        },
      );
      if (mounted.current && !next.signal.aborted) {
        setPlan(preview);
        setPhase("preview");
      }
    } catch (reason) {
      if (mounted.current && !next.signal.aborted) {
        setError(
          reason instanceof Error ? reason.message : "Could not read this CSV.",
        );
        setPhase("error");
      }
    }
  }
  async function commit() {
    if (!plan || committing.current) return;
    committing.current = true;
    setError("");
    setPhase("importing");
    try {
      await repository.save(plan.next, plan.baseRevision);
      onImported(plan.next);
      if (mounted.current) {
        setSaved(plan.next);
        setPhase("success");
      }
      // Best effort only: persistence denial must not invalidate an atomic save.
      if (navigator.storage?.persist)
        void navigator.storage.persist().catch(() => false);
    } catch (reason) {
      if (mounted.current) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not save this import. Your previous collection is unchanged.",
        );
        setPhase("preview");
      }
    } finally {
      committing.current = false;
    }
  }
  const busy = phase === "parsing" || phase === "importing";
  return (
    <Dialog
      titleId="import-title"
      className="import-dialog"
      onClose={onClose}
      closeDisabled={phase === "importing"}
    >
      <div className="drawer-handle" />
      <header className="dialog-heading">
        <p className="eyebrow">REAL COLLECTION FOUNDATION</p>
        <h2 id="import-title">Import Collection</h2>
        <p className="import-subtitle">
          Your ManaBox collection. The same beautiful binder.
        </p>
      </header>
      <div
        className="import-content"
        role="region"
        aria-label="Collection import"
        tabIndex={0}
      >
        {error && (
          <div className="import-error" role="alert">
            <TriangleAlert size={19} />
            <p>{error}</p>
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          aria-label="ManaBox CSV"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void choose(file);
          }}
        />
        {(phase === "upload" || phase === "error") && (
          <>
            <section className="import-upload">
              <span className="import-emblem">
                <FileUp size={30} strokeWidth={1.3} />
              </span>
              <h3>Give your cards a home.</h3>
              <p>
                Export your collection as a CSV from ManaBox, then choose that
                file. You’ll review every change before saving.
              </p>
              <button
                className="primary-button"
                onClick={() => input.current?.click()}
              >
                <FileUp size={17} />
                Choose CSV file
              </button>
              <span className="import-local">
                <ShieldCheck size={14} />
                Stored privately in this browser · no account needed
              </span>
            </section>
            <section className="sync-note">
              <h3>A careful, repeatable import</h3>
              <p>
                Matching rows are combined by printing, finish, language,
                condition, and binder/list. Their quantities are summed within
                this file, then <strong>replace</strong> the saved totals—not
                added again. Cards absent from the export stay in your
                collection.
              </p>
              <p>
                Use Scryfall IDs or set codes + collector numbers for the most
                reliable matches. Ambiguous matches are left for review.
              </p>
            </section>
            {saved?.lastImport && (
              <section className="last-import">
                <h3>Last import</h3>
                <p>
                  {saved.lastImport.filename} ·{" "}
                  {saved.lastImport.recognized.toLocaleString()} recognized rows
                  · {saved.lastImport.problematic.toLocaleString()} problem rows
                </p>
              </section>
            )}
            {saved && (
              <Problems
                problems={saved.unresolved}
                title="Saved rows to review"
              />
            )}
          </>
        )}
        {busy && (
          <div className="import-progress" role="status">
            <LoaderCircle className="import-spinner" size={31} />
            <h3>
              {phase === "parsing"
                ? "Preparing your preview"
                : "Saving your collection"}
            </h3>
            <p>
              {phase === "parsing"
                ? progress
                : "Saving cards, ownership and problem rows together…"}
            </p>
            <span>
              {phase === "parsing"
                ? "No collection changes have been made."
                : "Please keep this window open until saving completes."}
            </span>
          </div>
        )}
        {phase === "preview" && plan && (
          <>
            <p className="eyebrow">REVIEW BEFORE SAVING</p>
            <h3 className="import-filename">{plan.summary.filename}</h3>
            <dl className="import-stats">
              {[
                ["Recognized rows", plan.summary.recognized],
                ["New records", plan.summary.newRecords],
                ["Updated records", plan.summary.updated],
                ["Unchanged records", plan.summary.unchanged],
                ["Combined duplicate rows", plan.summary.duplicates],
                ["Problem rows", plan.summary.problematic],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value.toLocaleString()}</dd>
                </div>
              ))}
            </dl>
            <p className="sync-note">
              {plan.summary.totalRows.toLocaleString()} CSV rows ·{" "}
              {plan.summary.copies.toLocaleString()} recognized copies.
              Quantities in this file replace matching saved totals. Duplicate
              rows are summed, not discarded. Omitted records are kept.
            </p>
            {plan.warnings.map((w) => (
              <p key={w} className="import-warning">
                <TriangleAlert size={16} />
                {w}
              </p>
            ))}
            {!plan.summary.recognized && (
              <p className="import-warning">
                No cards are ready to import. Confirming will save problem rows
                for review only; it will not add cards.
              </p>
            )}
            {plan.entries.length > 0 && (
              <section className="import-records">
                <h3>Cards in this import</h3>
                <ol>
                  {plan.entries.slice(0, 30).map((entry) => (
                    <li key={entry.item.id}>
                      <div>
                        <strong>{entry.name}</strong>
                        <small>
                          {entry.item.setCode.toUpperCase()} #
                          {entry.item.collectorNumber} · {entry.item.finish} ·{" "}
                          {entry.item.language}
                          {entry.item.binderName
                            ? ` · ${entry.item.binderName}`
                            : ""}
                        </small>
                      </div>
                      <span className={`import-record-status ${entry.status}`}>
                        {entry.status}
                      </span>
                      <span className="import-quantity">
                        {entry.status === "updated"
                          ? `${entry.previousQuantity} → `
                          : ""}
                        {entry.item.quantityOwned}
                      </span>
                    </li>
                  ))}
                </ol>
                {plan.entries.length > 30 && (
                  <p>
                    Showing the first 30 of{" "}
                    {plan.entries.length.toLocaleString()} records. All
                    recognized records will be saved.
                  </p>
                )}
              </section>
            )}
            <Problems problems={plan.problems} />
          </>
        )}
        {phase === "success" && plan && (
          <>
            <section className="import-success">
              <span className="import-emblem">
                {plan.problems.length ? (
                  <TriangleAlert size={30} />
                ) : (
                  <CheckCircle2 size={30} />
                )}
              </span>
              <p className="eyebrow">SAVED IN THIS BROWSER</p>
              <h3>
                {plan.problems.length
                  ? "Imported, with rows to review"
                  : "Collection imported"}
              </h3>
              <p>
                {plan.summary.newRecords} new · {plan.summary.updated} updated ·{" "}
                {plan.summary.unchanged} unchanged records.
              </p>
              <p>
                {plan.problems.length
                  ? `${plan.problems.length} problem rows were saved for correction. Your recognized cards are ready in the binder.`
                  : "Your cards are ready in the binder. Import this export again any time without adding duplicate copies."}
              </p>
            </section>
            <Problems problems={plan.problems} />
          </>
        )}
      </div>
      <footer className="import-footer">
        {phase === "preview" ? (
          <>
            <button
              className="text-button"
              onClick={() => {
                setPhase("upload");
                setError("");
              }}
            >
              Back to upload
            </button>
            <button className="primary-button" onClick={() => void commit()}>
              {plan?.summary.recognized
                ? "Confirm import"
                : "Save problem rows"}
            </button>
          </>
        ) : phase === "success" ? (
          <button className="primary-button" onClick={onClose}>
            Return to binder
          </button>
        ) : (
          <button
            className="text-button"
            disabled={phase === "importing"}
            onClick={onClose}
          >
            {phase === "parsing" ? "Cancel import" : "Close"}
          </button>
        )}
      </footer>
    </Dialog>
  );
}
