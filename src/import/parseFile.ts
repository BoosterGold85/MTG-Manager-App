import { MAX_FILE_BYTES } from "./csv";
import type { ParsedImport } from "../models/collection";
export async function parseFile(
  file: File,
  signal: AbortSignal,
): Promise<ParsedImport> {
  if (file.size > MAX_FILE_BYTES)
    throw new Error(
      "Choose a CSV smaller than 50 MB. Split larger exports into smaller files.",
    );
  const text = await file.text();
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/csv.worker.ts", import.meta.url),
      { type: "module" },
    );
    const done = () => {
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      done();
      reject(new DOMException("Import canceled", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (
      e: MessageEvent<{ parsed?: ParsedImport; error?: string }>,
    ) => {
      done();
      if (e.data.parsed) resolve(e.data.parsed);
      else reject(new Error(e.data.error || "Could not parse the CSV."));
    };
    worker.onerror = () => {
      done();
      reject(
        new Error("CSV parsing could not start. Reload the app and try again."),
      );
    };
    worker.postMessage(text);
  });
}
