// Engineering and adjudication evidence is reviewed before changing these gates.
// No URL, localStorage key, or user setting can enable a production build.
export const ANALYZER_GATES = Object.freeze({
  browser: 'pending' as string,
  storagePreservation: 'pending' as string,
  independentlyAdjudicatedCorrectness: 'pending' as string,
  proofQuality: 'pending' as string,
  actualDeckUsefulness: 'pending' as string,
});
export function analyzerAvailable(): boolean {
  return Object.values(ANALYZER_GATES).every(value => value === 'passed') ||
    import.meta.env.DEV && import.meta.env.VITE_ANALYZER_TEST_HARNESS === '1';
}
export const ANALYZER_BLOCKED_MESSAGE = 'Execution is not enabled: independent correctness, proof quality and actual-deck validation are pending.';
