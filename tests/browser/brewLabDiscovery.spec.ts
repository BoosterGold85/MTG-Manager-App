import { test, expect } from '@playwright/test';
import { seed, section } from './workspaceHelpers';
import { allStorage, addStorageSentinels } from './analyzerStorage';
import { reignOfDragonsFixture } from '../recommendationFixtures';
import { oracleCard } from '../upgradeCandidates';
import type { CardMetadata } from '../../src/models/collection';

// Synthetic colourless cards so the commander's identity admits them; no named-card behaviour.
function fixture() {
  const f = reignOfDragonsFixture();
  const visitor = { ...oracleCard('Lab Visitor', '{1}', 1, 'Creature — Bear', '', []), power: '2', toughness: '2' };
  const observer = { ...oracleCard('Lab Observer', '{1}', 1, 'Artifact Creature — Scout', 'Whenever another creature enters, you gain 1 life.', []), power: '1', toughness: '1' };
  const riddle = oracleCard('Lab Riddle', '{2}', 2, 'Artifact', 'Do an unresolved action.', []);
  const offColor = oracleCard('Lab Outsider', '{G}', 1, 'Creature — Elf', 'Whenever another creature enters, you gain 1 life.', ['G']);
  const own = (card: CardMetadata) => { f.state.metadata[card.scryfallId] = card; f.state.items.push({ id: `owned:${card.name}`, scryfallId: card.scryfallId, setCode: 'cnd', collectorNumber: card.name, finish: 'nonfoil', language: 'en', condition: 'NM', binderName: '', binderType: '', quantityOwned: 1, quantityAssigned: 0, quantityUnassigned: 1, sourceRows: [] }); };
  f.state.metadata[visitor.scryfallId] = visitor;
  f.deck.entries!.push({ id: visitor.name, board: 'main', quantity: 1, name: visitor.name, cardIdentity: visitor.oracleId!, scryfallId: visitor.scryfallId });
  for (const card of [observer, riddle, offColor]) own(card);
  return { ...f, visitor, observer, riddle, offColor };
}

test('automatic discovery reports what an owned candidate adds, abstains on unreadable text, and leaves storage intact', async ({ page }) => {
  const f = fixture();
  await seed(page, f.state, f.deck.name, 'Upgrades'); await addStorageSentinels(page); const before = await allStorage(page);
  const lab = page.getByRole('region', { name: 'Experimental Brew Lab', exact: true });
  await lab.getByRole('button', { name: 'Open Brew Lab', exact: true }).click();
  const discovery = lab.getByRole('region', { name: 'Automatic chain discovery', exact: true });
  await expect(discovery).toContainText("outside your commander's color identity");
  await discovery.getByRole('button', { name: /Find chains for my owned candidates/ }).click();
  const results = discovery.getByLabel('Automatic discovery results');
  await expect(results).toBeVisible({ timeout: 60000 });
  const chain = results.getByRole('article', { name: 'Chains for Lab Observer' });
  await expect(chain).toContainText('Adds +1 life gained');
  await expect(chain).toContainText('Lab Visitor');
  await chain.getByText('How it works and what was assumed', { exact: true }).first().click();
  await expect(chain).toContainText('Lab Observer: Whenever another creature enters, you gain 1 life.');
  await expect(chain).toContainText('0 in the same scenario without Lab Observer');
  await expect(results).toContainText('not a score');
  // Unknown is listed as unreadable, never as a weak card; off-identity cards are not tested at all.
  await results.getByText(/Not readable yet — Unknown, not weak/).click();
  await expect(results).toContainText('Lab Riddle — Do an unresolved action.');
  await expect(results).not.toContainText('Lab Outsider');
  // Hand-off to the same-card comparison keeps the original engine as the baseline.
  await chain.getByRole('button', { name: 'Compare Lab Observer with the original Brew Engine' }).click();
  await expect(lab).toContainText('Lab Observer · same-card comparison');
  await expect(lab).toContainText('Original Brew Score');
  const single = lab.getByRole('region', { name: 'Automatic chain discovery for this card' });
  await single.getByRole('button', { name: 'Find chains for Lab Observer automatically' }).click();
  await expect(single.getByLabel('Automatic discovery results')).toContainText('Adds +1 life gained');
  // Removing the only readable partner removes the evidence that named it.
  await lab.getByRole('combobox', { name: 'Brew Lab remove card' }).selectOption(f.visitor.scryfallId);
  const after = lab.getByRole('region', { name: 'Automatic chain discovery for this card' });
  await after.getByRole('button', { name: 'Find chains for Lab Observer automatically' }).click();
  await expect(after.getByLabel('Automatic discovery results')).toBeVisible();
  await expect(after.getByLabel('Automatic discovery results')).not.toContainText('Lab Visitor');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await lab.getByRole('button', { name: 'Close Brew Lab', exact: true }).click();
  await section(page, 'Overview'); await section(page, 'Upgrades');
  expect(await allStorage(page)).toEqual(before);
});

test('cancelling discovery terminates the worker and changes nothing', async ({ page }) => {
  const f = fixture();
  await seed(page, f.state, f.deck.name, 'Upgrades'); await addStorageSentinels(page); const before = await allStorage(page);
  await page.route(/(?:assets\/discovery\.worker-[^/]+\.js|src\/experimental\/universal\/discovery\.worker\.ts)/, r => r.fulfill({ contentType: 'application/javascript', body: 'self.onmessage=()=>{};' }));
  const lab = page.getByRole('region', { name: 'Experimental Brew Lab', exact: true });
  await lab.getByRole('button', { name: 'Open Brew Lab', exact: true }).click();
  const discovery = lab.getByRole('region', { name: 'Automatic chain discovery', exact: true });
  await discovery.getByRole('button', { name: /Find chains for my owned candidates/ }).click();
  await discovery.getByRole('button', { name: 'Cancel discovery' }).click();
  await expect(discovery.getByRole('alert')).toContainText('cancelled');
  await expect(discovery.getByRole('button', { name: /Find chains for my owned candidates/ })).toBeEnabled();
  expect(await allStorage(page)).toEqual(before);
});
