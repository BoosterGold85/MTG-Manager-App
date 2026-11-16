// Coverage census: tallies the Oracle lines the experimental compiler leaves unsupported, grouped
// into generalized rule families. Development data only; frozen blind holdouts are never read.
import { it } from 'vitest';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { normalizeCard } from '../src/import/scryfall';
import { compile } from '../src/experimental/universal/compiler';

const FAMILIES: [string, RegExp][] = [
  ['crew', /^Crew \d+/], ['attack trigger', /^Whenever SELF attacks/],
  ['mana ability (other form)', /^\{T\}.*: Add|^Add /], ['tutor (search library)', /search your library/i],
  ['static anthem/keyword grant', /(get|gets|have|has) [+-]\d|\bhave\b.*\b(flying|haste|trample|vigilance|hexproof|indestructible)\b/i],
  ['cost reduction', /cost[s]? \{\d+\} less|costs? less to cast/i], ['combat damage trigger', /deals combat damage/i],
  ['equip/aura', /^Equip|^Enchant /], ['ward/hexproof/protection', /^(Ward|Hexproof|Protection|Indestructible)/],
  ['activated (other)', /^[^"]*\{[^}]+\}[^"]*: /], ['triggered (other)', /^(When|Whenever|At the beginning)/],
  ['spell text (other)', /./],
];
it('census', () => {
  const files = readdirSync('tests/data').filter(f => f.endsWith('.json') && /deck|vehicles|hug|pings|reign-of-dragons|brew-cards/.test(f));
  const tally = new Map<string, { lines: number; cards: Set<string>; examples: Set<string> }>(); let cards = 0, blocked = 0; const seen = new Set<string>();
  for (const f of files) {
    const raw = JSON.parse(readFileSync(`tests/data/${f}`, 'utf8')); const list = Array.isArray(raw) ? raw : raw.cards || Object.values(raw.data || {});
    for (const c of list) {
      if (!c?.oracle_text && !c?.card_faces || seen.has(c.oracle_id || c.name) || /\bLand\b/.test(c.type_line || '')) continue;
      seen.add(c.oracle_id || c.name); cards++;
      const r = compile(normalizeCard({ ...c, object: 'card', set_name: 'census' }));
      if (r.unsupported.length) blocked++;
      for (const line of [...r.unsupported, ...r.deferred]) {
        const fam = FAMILIES.find(([, re]) => re.test(line))![0];
        const t = tally.get(fam) || { lines: 0, cards: new Set(), examples: new Set() };
        t.lines++; t.cards.add(c.name); if (t.examples.size < 4) t.examples.add(`${c.name}: ${line}`); tally.set(fam, t);
      }
    }
  }
  const rows = [...tally].sort((a, b) => b[1].cards.size - a[1].cards.size).map(([k, v]) => ({ family: k, cards: v.cards.size, lines: v.lines, examples: [...v.examples] }));
  writeFileSync(process.env.CENSUS_OUT || 'census.json', JSON.stringify({ files, cards, blocked, rows }, null, 1));
});
