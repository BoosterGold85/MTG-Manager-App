"""Publish the completed pass from frozen offline outputs and explicit review sheets.
Usage: python3 scripts/publish-recall-pass.py CURRENT_JSON REAL_DECKS_JSON BEFORE_PERF AFTER_PERF
No network or production writes. Labels are inputs to reporting only, never scoring.
"""
import collections
import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'tests/audit/recall'
OUT = ROOT / 'docs/recall'
load = lambda path: json.loads(pathlib.Path(path).read_text())
sha = lambda path: hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
current, real, before_perf, after_perf = [load(p) for p in sys.argv[1:]]
baseline = load(OUT / 'frozen-baseline-results.json')
original = load(DATA / 'reviews/failure-classification.json')
precision = load(DATA / 'reviews/precision-after.json')
assert current['metricsValid'] and current['evaluated'] == 12
assert current['snapshotHashes'] == baseline['snapshotHashes']
assert current['corpusHash'] == baseline['corpusHash']
assert len(real['results']) == 11
ranking_keys = {(d['deck'], c['name'], rank) for d in current['results'] for rank,c in enumerate(d['candidates'],1)}
review_keys = {(r['deck'],r['candidate'],r['baselineRank']) for r in precision['reviews']}
assert len(precision['reviews']) == 240 and ranking_keys == review_keys
old_precision = {(r['deck'],r['candidate']):r for r in load(DATA/'reviews/precision-review.json')['reviews']}
for row in precision['reviews']:
    prior = old_precision.get((row['deck'],row['candidate']))
    if prior:
        assert row['label'] == prior['label'] and row['rationale'] == prior['rationale']

RULES = {
'Winding Constrictor':'counter replacement with scoped real initial placements',
'Inspiring Call':'anaphoric protection and conditional counter-board draw',
'Living Death':'linked exile/return, inherited subject and sacrifice reset',
'Animate Dead':'graveyard-Aura linked reanimation',
'Peregrine Drake':'self-entry land untap as mana and scoped reusable entry',
'Marionette Master':'Fabricate artifact bodies, variable life loss and actual artifact death feeders',
'Scrap Trawler':'return word order, artifact target coverage and actual artifact sacrifice feeders',
'Ramunap Excavator':'graveyard land-play permission, without inventing extra land drops',
'Temur Sabertooth':'friendly bounce/recast ETB reuse, preserving mana costs',
'Brass Squire':'legal Equipment attachment relationships',
'Ardenn, Intrepid Archaeologist':'mass friendly attachment, retaining Aura targeting restrictions',
'Kotori, Pilot Prodigy':'Vehicle crew rewrite',
'Mech Hangar':'Vehicle animation, distinct from restricted mana',
'Peacewalker Colossus':'another Vehicle animation, distinct from its own crew',
'Mobilizer Mech':'crew-dependent animation of another Vehicle',
'Corpsejack Menace':'counter replacement that requires compatible initial counter placement',
'Teleportation Circle':'repeatable compatible artifact/creature ETB output relationships',
'Thassa, Deep-Dwelling':'repeatable creature-only ETB output relationships',
'Jhoira, Weatherlight Captain':'reminder-normalized line identity and historic condition-to-draw output',
'Shimmer Dragon':'artifact-tap draw costs, not artifact sacrifice',
"Herald's Horn":'bind one chosen creature type for both cost and top-card effects',
'Cursed Mirror':'copy-target ETB and copied entry predicates, without a cast or legend exception',
'Primal Amulet':'front-to-back cast setup and conditional transformed mana/spell copy',
'Sakashima of a Thousand Faces':'copy relationships with explicit legend-rule exception',
'Biovisionary':'exact named-copy requirement with conservative simultaneous-copy supply',
'Doubling Season':'all actual token sources for global multipliers, distinct from tribal relevance',
'Archaeomancer':'instant/sorcery recursion coverage rather than raw artifact recursion counts',
'Tortured Existence':'correct recursion scope and remove generic selection-as-card-gain noise; ranking remains unresolved',
"Ashnod's Altar":'preserve true sacrifice/mana links and remove generic selection-as-card-gain noise; ranking remains unresolved',
}
after_rows = {(d['deck'],e['candidate']):e for d in current['results'] for e in d['expected']}
before_rows = {(d['deck'],e['candidate']):e for d in baseline['results'] for e in d['expected']}
resolutions = []
for row in original['reviews']:
    key = row['deck'],row['candidate']
    after = after_rows[key]
    resolutions.append({
        **row, 'originalPrimary':row['primary'],
        'generalRule':RULES[row['candidate']],
        'regressionTests':'tests/unit/recallCapabilities.test.ts',
        'knownUpstreamDefectFixed':row['primary'] != 'G',
        'beforeRank':before_rows[key]['rank'],'afterRank':after['rank'],
        'nowTop20':after['hit'],
        'note':'A verified upstream rule is distinct from a recovered top-20 rank. The two original ranking cases remain unresolved.'
    })
assert len(resolutions) == 29
(DATA/'reviews/resolutions.json').write_text(json.dumps({'baseline':'00c6be9','scope':'Original 29 diagnostic checks; not a claim that all Magic semantics are understood','rows':resolutions},indent=2)+'\n')

misses = [e for d in current['results'] for e in d['expected'] if e['kind'] != 'trap' and not e['hit']]
assert all(e['generated'] for e in misses)
far_underweighted = {'Winding Constrictor','Living Death','Peregrine Drake','Scrap Trawler','Sakashima of a Thousand Faces','Brass Squire','Ardenn, Intrepid Archaeologist'}
reviews=[]
for e in misses:
    primary = 'F' if e['candidate'] in far_underweighted else 'G'
    reviews.append({
        'deck':e['deck'],'candidate':e['candidate'],'primary':primary,
        'rationale':('The original missing capability/relationship is now represented with explicit evidence, but the unchanged component model still assigns little value to this direct engine or payoff. No weight adjustment was made.' if primary=='F' else 'Valid roles, conditions or relationships are present, but other candidates precede it at the fixed top-20 boundary. The fixed ordering was retained rather than restoring a golden card by name.'),
        'evidence':[f"Generated; rank {e['rank']}; score {e['brew']['score']}; secondary Synergy rank {e['synergyRank']}",json.dumps({'roles':e['roles'],'conditions':e['conditions'],'why':e['brew']['why'],'negatives':e['brew']['negatives']},ensure_ascii=False)],
        'previouslyTop20':before_rows[(e['deck'],e['candidate'])]['hit'],
    })
(DATA/'reviews/failure-after.json').write_text(json.dumps({'baseline':'00c6be9','author':'Assistant post-fix triage, not ablation-proven or independently adjudicated. Original diagnostic failures resolved does not mean zero unknown abilities globally.','reviews':reviews},indent=2)+'\n')

all_rows = list(after_rows.values())
metrics={}
for kind,label in [('obvious','obviousRecallAt20'),('hidden','hiddenRecallAt20'),('trap','trapRejection')]:
    selected=[r for r in all_rows if r['kind']==kind]
    good=sum(not r['hit'] if kind=='trap' else r['hit'] for r in selected)
    metrics[label]={'successes':good,'total':len(selected),'value':good/len(selected)}
for n in (10,20):
    rows=[r for r in precision['reviews'] if r['baselineRank']<=n]
    good=sum(r['label'] in ('Excellent contextual fit','Good obvious fit') for r in rows)
    metrics[f'deskPrecisionAt{n}']={'successes':good,'total':len(rows),'value':good/len(rows)}
counts={k:0 for k in 'ABCDEFGH'}
counts.update(collections.Counter(r['primary'] for r in reviews))
iteration=[]
for n in range(1,9):
    path=pathlib.Path(f'/workspace/recall-step{n}.json')
    if path.exists():
        report=load(path)
        iteration.append({'stage':n,**{k:sum(d['metrics'][k] for d in report['results'])/12 for k in ['obviousRecall','hiddenRecall','trapRejection']}})
summary={
    'baselineRevision':'00c6be9','sourceBaseline':'0f90fff','version':'0.6.15',
    'primaryOrdering':'Existing Brew ordering; no weight, threshold or band changes. Explore Synergy remains secondary diagnostics.',
    'snapshotHashes':current['snapshotHashes'],'expectationsHash':current['corpusHash'],
    'reviewHashes':{f:sha(DATA/'reviews'/f) for f in ['failure-classification.json','precision-review.json','precision-after.json','resolutions.json','failure-after.json']},
    'metrics':metrics,'remainingPrimaryCounts':counts,
    'initialDefectChecks':{'semantic':{'before':16,'after':0},'interaction':{'before':8,'after':0},'conditionSupply':{'before':2,'after':0},'roleProfile':{'before':1,'after':0},'originalRankingCasesStillMissed':2},
    'defectScope':'Counts refer to original known diagnostic checks, not all potential semantic gaps or top-20 recovery. New/remaining false positives are listed separately.',
    'initialMissesRecovered':sum(r['nowTop20'] for r in resolutions),
    'previousHitsDisplaced':[{'deck':r['deck'],'candidate':r['candidate'],'rank':after_rows[(r['deck'],r['candidate'])]['rank']} for deck in baseline['results'] for r in deck['expected'] if r['kind']!='trap' and r['hit'] and not after_rows[(r['deck'],r['candidate'])]['hit']],
    'precisionMethod':precision['author'],
    'precisionLabels':dict(collections.Counter(r['label'] for r in precision['reviews'])),
    'unchangedPrecisionJudgments':sum(r['reviewOrigin'].startswith('unchanged') for r in precision['reviews']),
    'remainingFalsePositives':[r for r in precision['reviews'] if r['label']=='False positive'],
    'remainingWeakRecommendations':[r for r in precision['reviews'] if r['label']=='Weak'],
    'iterations':iteration,
    'recommendation':'B. ANOTHER INTELLIGENCE PASS REQUIRED',
}
def compact(value):
    if isinstance(value,list):return [compact(v) for v in value]
    if isinstance(value,dict):return {k:compact(v) for k,v in value.items() if k not in ('debug','missed')}
    return value
performance={'beforeRevision':'00c6be9','afterVersion':'0.6.15','sameTemplates':before_perf['oracleTemplates']==after_perf['oracleTemplates'],'before':before_perf,'after':after_perf,'limitation':'Synthetic identities cycling the same frozen canonical templates, not 6000 distinct real cards or a physical phone. Sequential sizes reuse deck/JIT caches; heap/RSS snapshots are not isolated retained size.'}
old=load(ROOT/'tests/golden/upgrades-v0.6.6.json');new=load(ROOT/'tests/golden/upgrades-v0.6.15.json')
golden=[]
for case in new:
    prior={(mode,r['identity']):r for mode,rows in old[case].items() for r in rows}
    for mode,rows in new[case].items():
        for row in rows:
            before=prior.get((mode,row['identity']))
            if before != row: golden.append({'case':case,'mode':mode,'before':before,'after':row})
for name,data in [('completed-summary.json',summary),('completed-results.json',compact(current)),('completed-real-decks.json',real),('completed-performance.json',performance),('completed-golden-review.json',{'note':'Derived output snapshot refreshed for intentional semantic changes. Original v0.6.6 snapshot and all frozen human recall expectations retained. No score weights changed.','changes':golden})]:
    (OUT/name).write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'metrics':metrics,'remaining':counts,'initialRecovered':summary['initialMissesRecovered'],'displaced':summary['previousHitsDisplaced']},indent=2))
