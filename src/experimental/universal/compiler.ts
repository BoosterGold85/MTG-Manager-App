import {sha256} from './sha256';
import type { CardMetadata } from '../../models/collection';
import { extractCardFacts } from '../../synergy/facts';
import type { Ability, CompiledCard, Effect, Selector, Trigger } from './model';
import { VERSION } from './model';

const counts: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };
function stripReminderText(text: string): string {
  let depth = 0, output = '';
  for (const character of text) {
    if (character === '(') depth++; else if (character === ')' && depth) depth--;
    else if (!depth || character === '\n') output += character;
  }
  return output;
}
const n = (word: string) => counts[word.toLowerCase()] ?? Number(word);
const youCreature = (): Selector => ({ type: 'Creature', zone: 'battlefield', controller: 'you' });
const cache = new WeakMap<CardMetadata, CompiledCard>();
export function fingerprint(value: unknown): string { return sha256(JSON.stringify(value)); }
export function compile(card: CardMetadata): CompiledCard {
  const oracle = card.oracleText ?? '';
  const missing=card.oracleText===undefined || card.oracleText===null;
  const special=!!card.cardFaces?.length || !!card.layout && card.layout!=='normal' || /^Token\b/.test(card.typeLine);
  const key = fingerprint([VERSION, card.oracleId, card.name, oracle, card.typeLine, card.power, card.toughness, card.manaCost, card.manaValue, card.colors, card.cardFaces,...(missing?['missing-oracle']:[]),...(special?['unsupported-layout',card.layout]:[])]);
  const cached = cache.get(card); if (cached?.key === key) return cached;
  let text = stripReminderText(oracle.replace(/[’‘]/g, "'"));
  for (const name of [...new Set([card.name, card.name.split(',')[0]])].sort((a, b) => b.length - a.length)) {
    if (name.length > 2) text = text.split(name).join('SELF');
  }
  text = text.replace(/this (?:creature|vehicle|enchantment|artifact|permanent|spell)/gi, 'SELF');
  const result: CompiledCard = {
    key,
    oracleId: card.oracleId || card.scryfallId, name: card.name, types: card.typeLine.split(/[ —]+/), colors: card.colors || [],
    manaValue: card.manaValue, manaCost: card.manaCost || '',
    power: card.power !== undefined && Number.isFinite(Number(card.power)) ? Number(card.power) : null,
    toughness: card.toughness !== undefined && Number.isFinite(Number(card.toughness)) ? Number(card.toughness) : null,
    keywords: [], legendary: /\bLegendary\b/.test(card.typeLine), abilities: [], unsupported: [], deferred: [],
  };
  if(card.oracleText===undefined || card.oracleText===null)result.unsupported.push('Missing canonical Oracle text.');
  if(special)result.unsupported.push('Multi-face or special layout is outside the experimental subset.');
  // Reuse canonical facts for keyword-permission recognition, not their scores/confidence.
  const facts = extractCardFacts({ ...card });
  const lines = text.split('\n').map((line, index) => ({ line: line.trim(), index })).filter(row => row.line);
  const add = (line: string, index: number, fields: Omit<Ability, 'id' | 'evidence' | 'effects'> & { effects?: Effect[] }) => {
    const costEvidence = { id: `${result.oracleId}:line:${index}`, oracleId: result.oracleId, line: index, text: oracle.split('\n')[index] || line, rule: `subset:${VERSION}:cost`, kind: 'oracle' as const };
    result.abilities.push({ id: `${result.key}:${index}`, effects: [], ...fields, ...(fields.cost ? { cost: { ...fields.cost, evidence: fields.cost.evidence || costEvidence } } : {}),
      evidence: { id: `${result.oracleId}:line:${index}`, oracleId: result.oracleId, line: index, text: oracle.split('\n')[index] || line, rule: `subset:${VERSION}:${fields.kind}` } });
  };
  const parseEffect = (effect: string): Effect[] | null => {
    let m: RegExpMatchArray | null;
    if ((m = effect.match(/^Draw (a|one|two|three|\d+) cards?, then put (a|one|two|three|\d+) cards? from your hand on top of your library in any order\.$/i))) return [{ kind: 'draw-put-back', draw: n(m[1]), putBack: n(m[2]) }];
    if ((m = effect.match(/^Exile target creature\. Its controller gains life equal to its power\.$/i))) return [{ kind: 'remove', target: { type: 'Creature', zone: 'battlefield', controller: 'any' }, destination: 'exile', controllerLifeFromPower: true }];
    if ((m = effect.match(/^(Destroy|Exile) target (creature|artifact|enchantment|artifact or enchantment|nonland permanent|permanent)\.$/i))) {
      const types = { creature: 'Creature', artifact: 'Artifact', enchantment: 'Enchantment', 'artifact or enchantment': 'ArtifactOrEnchantment', 'nonland permanent': 'Permanent', permanent: 'Permanent' } as const;
      return [{ kind: 'remove', target: { type: types[m[2].toLowerCase() as keyof typeof types], zone: 'battlefield', controller: 'any', nonland: m[2].toLowerCase() === 'nonland permanent' }, destination: m[1].toLowerCase() === 'exile' ? 'exile' : 'graveyard' }];
    }
    if ((m = effect.match(/^Create (a|one|two|three|\d+) (Treasure|Clue|Food) tokens?\.$/i))) return [{ kind: 'artifact-tokens', count: n(m[1]), subtype: (m[2][0].toUpperCase() + m[2].slice(1).toLowerCase()) as 'Treasure' | 'Clue' | 'Food' }];
    if ((m = effect.match(/^Draw (a|one|two|three|\d+) cards? and create (a|one|two|three|\d+) (Treasure|Clue|Food) tokens?\.$/i))) {
      const tail = parseEffect(`Create ${m[2]} ${m[3]} token${n(m[2]) === 1 ? '' : 's'}.`);
      return tail ? [{ kind: 'draw', count: n(m[1]) }, ...tail] : null;
    }
    if ((m = effect.match(/^Add \{([WUBRGC])\} for each creature(?: card)? (you control|in your graveyard)\.$/i))) return [{ kind: 'counted-mana', color: m[1] as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', selector: { type: 'Creature', zone: m[2] === 'you control' ? 'battlefield' : 'graveyard', controller: 'you' } }];
    if ((m = effect.match(/^draw a card if its power is (\d+) or greater\. Otherwise, put (two|\d+) \+1\/\+1 counters on it\.$/i))) return [{ kind: 'power-branch', threshold: Number(m[1]), draw: 1, counters: n(m[2]) }];
    if (/^(?:you may )?Copy (?:that spell|it)\. You may choose new targets for the copy\.$/i.test(effect)) return [{ kind: 'copy-spell', nonlegendary: false, thenCounterSelf: false }];
    if ((m = effect.match(/^SELF deals (\d+) damage to any target\.$/i))) return [{ kind: 'damage', count: Number(m[1]) }];
    if ((m = effect.match(/^Exile target creature you control, then return (?:that card|it) to the battlefield under (your|its owner's) control\.$/i))) return [{ kind: 'blink', target: youCreature(), ownerControl: m[1] !== 'your' }];
    if ((m = effect.match(/^Create a token that's a copy of target creature( you control)?\.$/i))) return [{ kind: 'copy-permanent', target: { type: 'Creature', zone: 'battlefield', controller: m[1] ? 'you' : 'any' } }];
    if (/^Untap SELF\.$/i.test(effect)) return [{ kind: 'untap', self: true }];
    if (/^Untap all creatures\.$/i.test(effect)) return [{ kind: 'untap', allCreatures: true }];
    if (/^Untap target creature you control\.$/i.test(effect)) return [{ kind: 'untap', target: youCreature() }];
    if (/^Copy (?:that spell|it)\. You may choose new targets for the copy\.$/i.test(effect)) return [{ kind: 'copy-spell', nonlegendary: false, thenCounterSelf: false }];
    if (/^Add one mana of any color\.$/i.test(effect)) return [{ kind: 'mana', symbols: [], choose: true }];
    if ((m = effect.match(/^(?:you (?:may )?)?Draw (a|one|two|three|\d+) cards?\.$/i))) return [{ kind: 'draw', count: n(m[1]) }];
    if ((m = effect.match(/^you (?:may )?gain (\d+) life\.$/i))) return [{ kind: 'gain-life', count: n(m[1]) }];
    if ((m = effect.match(/^put (a|one|two|\d+) \+1\/\+1 counters? on (SELF|that creature|target creature)\.$/i)))
      return [{ kind: 'counter', count: n(m[1]), recipient: m[2] === 'SELF' ? 'self' : m[2] === 'that creature' ? 'event' : 'target', maximum: 1 }];
    if ((m = effect.match(/^put a \+1\/\+1 counter on each of up to (two|\d+) target creatures\.$/i)))
      return [{ kind: 'counter', count: 1, recipient: 'target', maximum: n(m[1]), minimum: 0 }];
    if ((m = effect.match(/^return target (permanent|creature|artifact) card(?: with mana value (\d+) or less)? from your graveyard to (your hand|the battlefield)\.(.*)$/i))) {
      const suffix = m[4].trim();
      if (suffix && suffix !== 'It gains "SELF attacks each combat if able" and "When SELF deals combat damage to a player, sacrifice it."') return null;
      return [{ kind: 'return', target: { type: m[1] === 'permanent' ? 'Permanent' : m[1] === 'artifact' ? 'Artifact' : 'Creature', zone: 'graveyard', controller: 'you', maxManaValue: m[2] ? Number(m[2]) : undefined }, destination: m[3] === 'your hand' ? 'hand' : 'battlefield', restrictions: suffix ? [suffix] : [] }];
    }
    if (/^draw a card if it has flying\. Otherwise, put a flying counter on it\.$/i.test(effect)) return [{ kind: 'entry-branch', keyword: 'Flying' }];
    if (/^copy that spell, except the copy isn't legendary\. Then put a \+1\/\+1 counter on SELF\.$/i.test(effect)) return [{ kind: 'copy-spell', nonlegendary: true, thenCounterSelf: true }];
    if ((m = effect.match(/^SELF deals (\d+) damage to each opponent\.$/i))) return [{ kind: 'damage', count: Number(m[1]) }];
    if ((m = effect.match(/^Create (a|one|two|three|\d+) (\d+)\/(\d+) (white|blue|black|red|green|colorless) ([A-Za-z ]+?) (?:artifact )?creature tokens?(?: with (flying|vigilance|lifelink))?\.$/i))) {
      const colors: Record<string, string[]> = { white: ['W'], blue: ['U'], black: ['B'], red: ['R'], green: ['G'], colorless: [] };
      return [{ kind: 'tokens', count: n(m[1]), power: Number(m[2]), toughness: Number(m[3]), colors: colors[m[4].toLowerCase()], types: [...m[5].split(' '), ...(effect.includes('artifact creature') ? ['Artifact'] : [])], keywords: m[6] ? [m[6][0].toUpperCase() + m[6].slice(1)] : [] }];
    }
    if ((m = effect.match(/^Add ((?:\{[WUBRGC]\})+)\.$/i))) return [{ kind: 'mana', symbols: [...m[1].matchAll(/\{([WUBRGC])\}/gi)].map(x => x[1].toUpperCase()) }];
    if ((m = effect.match(/^Adapt (\d+)\.$/))) return [{ kind: 'adapt', count: Number(m[1]) }];
    if ((m = effect.match(/^This turn, each creature you control enters with an additional (\+1\/\+1) counter on it\.$/))) return [{ kind: 'entry-counter-permission', count: 1 }];
    if (/^You may sacrifice an artifact or discard a card\. If you do, draw two cards\.$/.test(effect)) return [{ kind: 'discard-choice-draw', count: 2 }];
    if ((m = effect.match(/^Surveil (\d+), then draw (two|\d+) cards\. You lose (\d+) life\.$/))) return [{ kind: 'surveil', count: Number(m[1]) }, { kind: 'draw', count: n(m[2]) }, { kind: 'lose-life', count: Number(m[3]) }];
    if (effect.includes('. ')) {
      const clauses = effect.split(/(?<=\.) /);
      const parts = clauses.map(parseEffect);
      if (parts.every((p): p is Effect[] => p !== null)) return parts.flat();
    }
    return null;
  };
  for (const { line, index: i } of lines) {
    let m: RegExpMatchArray | null;
    if (/^(?:Flying|Flash|Trample|Vigilance|Haste|Lifelink|Reach|Defender|Deathtouch|Menace|First strike|Double strike)(?:, (?:Flying|Flash|Trample|Vigilance|Haste|Lifelink|Reach|Defender|Deathtouch|Menace|First strike|Double strike))*$/i.test(line)) { result.keywords.push(...line.split(', ').map(w => w[0].toUpperCase() + w.slice(1).toLowerCase())); continue; }
    if ((m = line.match(/^As an additional cost to cast SELF, sacrifice (a creature|an artifact or creature)\.$/))) {
      result.castCost = { evidence: {id: `${result.oracleId}:line:${i}`, oracleId:result.oracleId,line:i,text:oracle.split('\n')[i] || line,rule:'subset:additional-sacrifice-cost'}, mana: '', sacrifice: { type: m[1] === 'a creature' ? 'Creature' : 'ArtifactOrCreature', zone: 'battlefield', controller: 'you' } }; continue;
    }
    if ((m = line.match(/^You may have SELF enter as a copy of any (creature|nonland permanent) (on the battlefield|card in a graveyard)\.$/))) {
      add(line, i, { kind: 'replacement', effects: [{ kind: 'entry-copy', selector: { type: m[1] === 'creature' ? 'Creature' : 'Permanent', nonland: m[1] === 'nonland permanent', zone: m[2] === 'on the battlefield' ? 'battlefield' : 'graveyard', controller: 'any' } }] }); continue;
    }
    if (/^(?:SELF can't block\.|Creatures you control have trample\.)$/.test(line)) { result.deferred.push(line); continue; }
    if ((m = line.match(/^Flashback ((?:\{[^}]+\})+)$/))) { add(line, i, { kind: 'permission', permission: 'flashback', cost: { mana: m[1] } }); continue; }
    if (/^Crew \d+$/.test(line) || /^Whenever SELF attacks(?: or blocks)?,/.test(line)) { result.deferred.push(line); continue; }
    if (line === 'Vehicles you control have flying.') { add(line, i, { kind: 'static', static: 'vehicle-flying' }); continue; }
    if (line === 'Each creature you control with a counter on it has "{T}: Add {G}."') { add(line, i, { kind: 'static', static: 'counter-mana' }); continue; }
    if (/^If one or more \+1\/\+1 counters would be put on a creature you control, that many plus one \+1\/\+1 counters are put on it instead\.$/.test(line)) { add(line, i, { kind: 'static', static: 'counter-addition' }); continue; }
    if (/^Players can't cast spells from graveyards(?: or libraries)?\.$/.test(line)) { add(line, i, { kind: 'static', static: 'graveyard-cast-prohibition' }); continue; }
    if (/^Creature cards in graveyards and libraries can't enter the battlefield\.$/.test(line)) { add(line, i, { kind: 'static', static: 'graveyard-entry-prohibition' }); continue; }
    if ((m = line.match(/^Mayhem ((?:\{[^}]+\})+)$/)) && facts.faces.some(f => f.castFromDiscard.some(c => c.mechanic === 'mayhem'))) {
      add(line, i, { kind: 'permission', permission: 'discarded-this-turn', cost: { mana: m[1] } }); continue;
    }
    if ((m = line.match(/^((?:(?:\{[^}]+\})+)(?:, )?)?(Sacrifice (?:SELF|another creature|a creature|an artifact)|Pay \d+ life): (.+)$/))) {
      const effects = parseEffect(m[3]);
      const payment = m[2];
      const sacrifice: Selector | undefined = payment.startsWith('Sacrifice') ? { type: payment.endsWith('artifact') ? 'Artifact' : payment.endsWith('SELF') ? 'Any' : 'Creature', zone: 'battlefield', controller: 'you', self: payment.endsWith('SELF'), another: payment.includes('another') } : undefined;
      if (effects) { add(line, i, { kind: 'activated', effects, cost: { mana: (m[1] || '').replace(/, $/, '').replace('{T}', ''), tap: (m[1] || '').includes('{T}'), sacrifice, life: payment.startsWith('Pay') ? Number(payment.match(/\d+/)![0]) : undefined } }); continue; }
    }
    if ((m = line.match(/^((?:\{[^}]+\})+(?:, Remove a \+1\/\+1 counter from a creature you control)?): (.+)$/))) {
      const effects = parseEffect(m[2]);
      if (effects) { add(line, i, { kind: 'activated', cost: { mana: m[1].replace(/, Remove.*$/, '').replace('{T}', ''), tap: m[1].includes('{T}'), removeCounter: /, Remove/.test(m[1]) ? youCreature() : undefined }, effects }); continue; }
    }
    if ((m = line.match(/^(?:When|Whenever) (.+?), (.+)$/))) {
      let effectText = m[2]; let condition: Ability['condition'];
      const conditional = effectText.match(/^if you control a creature with power (\d+) or greater, (.+)$/);
      if (conditional) { condition = { kind: 'control-power-at-least', minimum: Number(conditional[1]) }; effectText = conditional[2]; }
      const unique = effectText.match(/^if it doesn't have the same name as another creature you control or a creature card in your graveyard, (.+)$/);
      if (unique) { condition = { kind: 'unique-name', minimum: 0 }; effectText = unique[1]; }
      const effects = parseEffect(effectText); let trigger: Trigger | undefined;
      const subject = youCreature();
      if (m[1] === 'SELF enters') { subject.self = true; subject.type = 'Any'; trigger = { event: 'enter', subject, eventCount: 'each-event' }; }
      else if (/^(?:another |a )?creature(?: you control)? enters$/.test(m[1])) { subject.another = m[1].startsWith('another '); subject.controller = /you control/.test(m[1]) ? 'you' : 'any'; trigger = { event: 'enter', subject, eventCount: 'each-event' }; }
      else if (m[1] === 'a Vehicle you control enters') trigger = { event: 'enter', subject: { ...subject, type: 'Vehicle' }, eventCount: 'each-event' };
      else if (m[1] === 'another creature you control enters') trigger = { event: 'enter', subject: { ...subject, another: true }, eventCount: 'each-event' };
      else if (/^(?:one or more \+1\/\+1 counters are|a \+1\/\+1 counter is) put on SELF$/.test(m[1])) trigger = { event: 'counter', subject: { ...subject, self: true }, eventCount: 'one-or-more' };
      else if (m[1] === "you cast a creature spell with mana value equal to SELF's power") trigger = { event: 'cast', subject: { ...subject, zone: 'stack' }, matchingPower: true, eventCount: 'each-event' };
      else if (m[1] === 'you gain life') trigger = { event: 'gain-life', subject: { ...subject, type: 'Any' }, eventCount: 'each-event' };
      if (!trigger && /^(?:SELF|(?:another |a |a nontoken )?creature(?: you control)?) dies$/.test(m[1])) {
        const self = m[1] === 'SELF dies';
        trigger = { event: 'die', subject: { type: self ? 'Any' : 'Creature', zone: 'battlefield', controller: self || m[1].includes('you control') ? 'you' : 'any', self, another: m[1].startsWith('another '), nontoken: m[1].includes('nontoken') }, eventCount: 'each-event' };
      }
      if (!trigger && /^you cast (?:a creature|an artifact|an instant or sorcery) spell$/.test(m[1])) trigger = { event: 'cast', subject: { type: 'Any', zone: 'stack', controller: 'you' }, spellTypes: m[1].includes('instant') ? ['Instant', 'Sorcery'] : m[1].includes('artifact') ? ['Artifact'] : ['Creature'], eventCount: 'each-event' };
      if (!trigger && (m = line.match(/^(?:When|Whenever) ((?:another |a |a nontoken )?creature you control)(?: with power (\d+) or (greater|less))? enters, (.+)$/))) {
        trigger = { event: 'enter', subject: { ...subject, another: m[1].startsWith('another'), nontoken: m[1].includes('nontoken') }, minimumPower: m[3] === 'greater' ? Number(m[2]) : undefined, maximumPower: m[3] === 'less' ? Number(m[2]) : undefined, eventCount: 'each-event' };
      }
      if (effects && trigger) { add(line, i, { kind: 'triggered', effects, trigger, condition }); continue; }
    }
    const effects = parseEffect(line);
    if (effects && /\b(?:Instant|Sorcery)\b/.test(card.typeLine)) { add(line, i, { kind: 'spell', effects }); continue; }
    result.unsupported.push(line);
  }
  if (result.types.includes('Land')) {
    const basicTypes: Record<string, string> = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };
    for (const [type, color] of Object.entries(basicTypes)) if (result.types.includes(type)) result.abilities.push({ id: `${result.key}:intrinsic-${type}`, kind: 'activated', evidence: { id: `${result.oracleId}:land-type:${type}`, oracleId: result.oracleId, line: -1, text: card.typeLine, rule: 'CR305.6:intrinsic-basic-land-type-mana-ability' }, cost: { mana: '', tap: true }, effects: [{ kind: 'mana', symbols: [color] }] });
  }
  cache.set(card, result); return result;
}
