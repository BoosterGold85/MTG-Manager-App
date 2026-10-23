import { parseManaBox } from "../import/csv";
self.onmessage = (event: MessageEvent<string>) => {
  try {
    self.postMessage({ parsed: parseManaBox(event.data) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : "Could not parse this CSV.",
    });
  }
};
