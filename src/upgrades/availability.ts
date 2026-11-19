import type { OwnedCandidateGroup } from "../synergy/explorer";
/** Copy availability in plain words. Unassigned copies are the only ones an add or swap can use. */
export const availabilityLine = (c: OwnedCandidateGroup) =>
  c.available > 0 ? `Available ${c.available} · Owned ${c.owned}` : `Owned ${c.owned} · Available 0 · No available copy`;
