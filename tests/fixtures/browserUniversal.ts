// Named cards and authored states live only in development fixtures, never in reasoning rules.
import snapshot from '../../research/universal/data/cards.scryfall.json';
import { normalizeCard } from '../../src/import/scryfall';
import type { CardMetadata } from '../../src/models/collection';
import { emptyMana } from '../../src/experimental/universal/model';
import type { Action, Color, State } from '../../src/experimental/universal/model';
import { scenario, execute } from '../../src/experimental/universal/engine';
export const cards = snapshot.data.map(c => normalizeCard(c as unknown as Parameters<typeof normalizeCard>[0]));
export function card(name: string): CardMetadata {
  const found = cards.find(c => c.name === name); if (!found) throw new Error(`Fixture missing: ${name}`); return found;
}
export const mana = (values: Partial<Record<Color, number>>) => ({ ...emptyMana(), ...values });
export function tails(admiral = true): State {
  return scenario([
    { card: card('Miles "Tails" Prower'), zone: 'battlefield', id: 'tails' },
    ...(admiral ? [{ card: card('Aeronaut Admiral'), zone: 'battlefield' as const, id: 'admiral' }] : []),
    { card: card('Renegade Freighter'), zone: 'hand', id: 'vehicle' },
  ], { mana: mana({ C: 3 }) });
}
export function jackal(): State {
  return scenario([
    { card: card('Jackal, Genius Geneticist'), zone: 'battlefield', id: 'jackal', counters: { '+1/+1': 1 } },
    { card: card('Evolution Witness'), zone: 'battlefield', id: 'witness' },
    { card: card('Zameck Guildmage'), zone: 'battlefield', id: 'power-control' },
    { card: card('Llanowar Elves'), zone: 'graveyard', id: 'one-drop' },
  ], { mana: mana({ G: 5, U: 2, C: 2 }) });
}
export function carnage(zone: 'hand' | 'library' = 'hand'): State {
  return scenario([
    { card: card('Vision of Love'), zone: 'hand', id: 'discard-spell' },
    { card: card('Diresight'), zone: 'hand', id: 'surveil-spell' },
    { card: card('Carnage, Crimson Chaos'), zone, id: 'carnage' },
    ...(zone === 'library' ? [{ card: card('Llanowar Elves'), zone: 'library' as const, id: 'library-second' }] : []),
  ], { mana: mana({ R: 2, B: 2, C: 3 }) });
}
export function novel(support: string[] = ['warden', 'pridemate']): State {
  return scenario([
    ...(support.includes('warden') ? [{ card: card('Soul Warden'), zone: 'battlefield' as const, id: 'warden' }] : []),
    ...(support.includes('pridemate') ? [{ card: card("Ajani's Pridemate"), zone: 'battlefield' as const, id: 'pridemate' }] : []),
    { card: card('Raise the Alarm'), zone: 'hand', id: 'token-spell' },
  ], { mana: mana({ W: 1, C: 1 }) });
}
export function rishkar(present = true): State {
  return scenario([
    // Real Oracle text: an existing counter makes Adapt a no-op until counters are removed.
    { card: card('Evolution Witness'), zone: 'battlefield', id: 'witness', counters: { '+1/+1': 1 } },
    ...(present ? [{ card: card('Rishkar, Peema Renegade'), zone: 'hand' as const, id: 'rishkar' }] : []),
    { card: card('Llanowar Elves'), zone: 'graveyard', id: 'target' },
  ], { mana: mana({ G: 1, C: 2 }) });
}
export function follow(initial: State, actions: Action[]) {
  let states = [initial];
  for (const action of actions) states = states.flatMap(s => execute(s, action).flatMap(p => p.status === 'Verified' && p.terminal ? [p.terminal] : []));
  return states;
}
