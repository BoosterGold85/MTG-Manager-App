import { describe, it, expect } from 'vitest';
import { discoveryInput } from '../../src/experimental/universal/discoveryInput';
import { withoutCard } from '../../src/experimental/universal/deckPreview';
import { reignOfDragonsFixture } from '../recommendationFixtures';
import { oracleCard } from '../upgradeCandidates';
import type { CardMetadata } from '../../src/models/collection';

function fixture() {
  const f = reignOfDragonsFixture();
  const own = (card: CardMetadata, id = card.scryfallId) => { f.state.metadata[id] = { ...card, scryfallId: id }; f.state.items.push({ id: `owned:${id}`, scryfallId: id, setCode: 'cnd', collectorNumber: id, finish: 'nonfoil', language: 'en', condition: 'NM', binderName: '', binderType: '', quantityOwned: 1, quantityAssigned: 0, quantityUnassigned: 1, sourceRows: [] }); };
  const colorless = oracleCard('Picker Gadget', '{1}', 1, 'Artifact', '', []);
  const offColor = oracleCard('Picker Elf', '{G}', 1, 'Creature — Elf', '', ['G']);
  own(colorless); own(colorless, `${colorless.scryfallId}-reprint`); own(offColor);
  return { ...f, colorless, offColor };
}

describe('Brew Lab picker eligibility', () => {
  it('lists one printing per Oracle card and hides cards outside the commander identity', () => {
    const f = fixture(), input = discoveryInput(f.state, f.deck), names = input.candidates.map(c => c.name);
    expect(names.filter(n => n === 'Picker Gadget')).toHaveLength(1);
    expect(names).not.toContain('Picker Elf');
    expect(input.outsideIdentity).toBeGreaterThanOrEqual(1);
    const deckKeys = input.deckCards.map(c => c.oracleId || c.name);
    expect(new Set(deckKeys).size).toBe(deckKeys.length);
  });
  it('removal preview is an ephemeral projection that leaves the saved deck untouched', () => {
    const f = fixture(), snapshot = JSON.stringify(f.deck), input = discoveryInput(f.state, f.deck);
    const cut = input.deckCards.find(c => !input.anchorIds.includes(c.scryfallId))!;
    const projected = withoutCard(f.state, f.deck, cut.scryfallId);
    expect(discoveryInput(f.state, projected).deckCards.some(c => c.oracleId === cut.oracleId)).toBe(false);
    expect(JSON.stringify(f.deck)).toBe(snapshot);
  });
});
