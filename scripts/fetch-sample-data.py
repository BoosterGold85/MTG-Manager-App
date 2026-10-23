"""Explicit maintainer-only refresh. Never runs on app load or during build.
Downloads 32 sample printings in one collection request, then caches their artwork.
Requires public api.scryfall.com and cards.scryfall.io access; no credentials.
"""
import json
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = [
 ('Adeline, Resplendent Cathar','mid',1,False,['Tokens']),
 ('Swords to Plowshares','cmm',3,False,['Removal']),
 ('Sun Titan','m11',1,True,['Graveyard']),
 ('Smothering Tithe','rna',1,False,['Ramp','Tokens']),
 ('Counterspell','cmr',4,False,['Removal']),
 ('Ponder','m12',3,False,['Card Draw']),
 ('Rhystic Study','jmp',1,False,['Card Draw']),
 ('Mulldrifter','cmr',2,False,['Card Draw']),
 ('Blood Artist','2x2',2,False,['Graveyard','Tokens']),
 ('Reanimate','tmp',1,False,['Graveyard']),
 ('Zulaport Cutthroat','bfz',3,False,['Tokens','Graveyard']),
 ('Victimize','cmr',2,False,['Graveyard']),
 ('Lightning Bolt','m11',4,False,['Removal']),
 ('Chaos Warp','c20',2,False,['Removal']),
 ('Young Pyromancer','m14',2,True,['Tokens']),
 ('Goblin Instigator','m19',3,False,['Tokens']),
 ('Birds of Paradise','m12',2,False,['Ramp']),
 ('Cultivate','m21',4,False,['Ramp']),
 ('Hardened Scales','ktk',1,True,['+1/+1 Counters']),
 ('Scute Swarm','znr',2,False,['Landfall','Tokens']),
 ('Avenger of Zendikar','cmr',1,False,['Landfall','Tokens','+1/+1 Counters']),
 ('Tatyova, Benthic Druid','dom',1,False,['Landfall','Card Draw']),
 ("Atraxa, Praetors\' Voice",'2xm',1,True,['+1/+1 Counters']),
 ('Meren of Clan Nel Toth','cmm',1,False,['Graveyard']),
 ('Solemn Simulacrum','m21',2,False,['Artifacts','Ramp','Card Draw']),
 ('Sol Ring','cmm',4,False,['Artifacts','Ramp']),
 ('Arcane Signet','eld',4,False,['Artifacts','Ramp']),
 ('Skullclamp','c14',2,True,['Artifacts','Card Draw','Tokens']),
 ('Command Tower','cmm',4,False,['Ramp']),
 ('Evolving Wilds','m20',4,False,['Landfall']),
 ('Forest','m21',8,False,[]),
 ('Island','m21',6,False,[]),
]
HEADERS = {'User-Agent': 'MTGManager/0.1.0 (local sample binder)', 'Accept': 'application/json'}
def request(url, data=None):
    return urllib.request.urlopen(urllib.request.Request(url, data=data, headers=HEADERS), timeout=40)

def main():
    payload = json.dumps({'identifiers': [{'name': n,'set': s} for n,s,*_ in SAMPLES]}).encode()
    HEADERS['Content-Type'] = 'application/json'
    with request('https://api.scryfall.com/cards/collection', payload) as response:
        result = json.load(response)
    if result.get('not_found'):
        raise RuntimeError(f"Unresolved samples: {result['not_found']}")
    by_name = {c['name']: c for c in result['data']}
    records = []
    (ROOT / 'public/cards').mkdir(parents=True, exist_ok=True)
    for name, set_code, quantity, foil, tags in SAMPLES:
        c = by_name[name]
        record = dict(id=c['id'], scryfallId=c['id'], name=c['name'], setCode=c['set'], setName=c['set_name'], collectorNumber=c['collector_number'], manaCost=c.get('mana_cost',''), manaValue=c['cmc'], colorIdentity=c['color_identity'], typeLine=c['type_line'], rarity=c['rarity'], quantity=quantity, foil=foil, oracleText=c.get('oracle_text',''), tags=tags, artist=c.get('artist',''))
        for size, key in [('normal','thumbnailUrl'),('large','imageUrl')]:
            path = f"/cards/{c['id']}-{size}.jpg"
            target = ROOT / 'public' / path.lstrip('/')
            if not target.exists():
                time.sleep(.12)
                with request(c['image_uris'][size]) as response:
                    body = response.read()
                    if not body.startswith(b'\xff\xd8'): raise RuntimeError('Expected JPEG artwork')
                    target.write_bytes(body)
            record[key] = path
        records.append(record)
        print('Cached',name)
    (ROOT / 'src/data/sampleCards.json').write_text(json.dumps(records, indent=2, ensure_ascii=False)+'\n')
    print(f'Saved {len(records)} cards; {sum(c["quantity"] for c in records)} physical copies.')

if __name__ == '__main__': main()
