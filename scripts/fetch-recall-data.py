#!/usr/bin/env python3
"""Developer-only, resumable public fixture capture. No usage/popularity data or app writes.
Run only after Scryfall/Archidekt destinations are enabled in environment settings.
"""
import argparse, datetime, hashlib, json, pathlib, time, urllib.error, urllib.request
from email.utils import parsedate_to_datetime

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'tests/audit/recall'
AGENT = 'MTG-Manager-Recall-Research/0.6.15 (public fixture validation)'

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.replace(path)

def request(url, body=None):
    for attempt in range(4):
        req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                     headers={'User-Agent':AGENT,'Accept':'application/json','Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                raw=response.read()
                json.loads(raw)  # A successful HTML response is not a JSON fixture.
                return raw
        except urllib.error.HTTPError as error:
            if not (error.code in (408,429) or 500 <= error.code < 600) or attempt==3:
                raise
            delay=error.headers.get('Retry-After','')
            try:
                delay=float(delay)
            except ValueError:
                if delay:
                    try:
                        delay=max(0,(parsedate_to_datetime(delay)-datetime.datetime.now(datetime.timezone.utc)).total_seconds())
                    except (ValueError,TypeError) as invalid:
                        raise RuntimeError('Unrecognized Retry-After; stop safely and retry later') from invalid
                else:
                    delay=0
            if delay>30:
                raise RuntimeError('Service requested a long Retry-After; rerun later. Saved earlier snapshots are intact.') from error
            time.sleep(max(delay,0.5*2**attempt))
        except (urllib.error.URLError,TimeoutError):
            if attempt==3:
                raise
            time.sleep(0.5*2**attempt)
    raise RuntimeError('Request did not complete')

def capture_holdouts():
    path=DATA/'holdouts/manifest.json'
    manifest=json.loads(path.read_text())
    for deck in manifest['decks']:
        if deck['rawFile']:
            raw=(DATA/deck['rawFile']).read_bytes()
            if hashlib.sha256(raw).hexdigest()!=deck['sha256']:
                raise RuntimeError('Frozen holdout changed: '+deck['id'])
            continue
        raw=request(deck['source'])
        parsed=json.loads(raw)
        if not isinstance(parsed,dict) or not isinstance(parsed.get('cards'),list):
            raise RuntimeError('Invalid public deck export: '+deck['id'])
        output=DATA/'holdouts'/f"{deck['id']}.archidekt.json"
        output.write_bytes(raw)
        deck.update(status='captured-not-evaluated',retrievedAt=now(),rawFile=str(output.relative_to(DATA)),sha256=hashlib.sha256(raw).hexdigest())
        save(path,manifest)
        print('Captured',deck['id'],len(parsed['cards']),'rows; evaluation not run')
        time.sleep(0.25)

def card_aliases(card):
    return [card['name']]+[face['name'] for face in card.get('card_faces',[])]

def key(name):
    return name.replace('’',"'").casefold().strip()

def capture_cards():
    path=DATA/'cards.scryfall.json'
    cards=json.loads(path.read_text())
    known={key(alias) for card in cards for alias in card_aliases(card)}
    wanted=set(json.loads((DATA/'fixed-candidates.json').read_text()))
    wanted.update(row['name'] for row in json.loads((DATA/'coverage-cases.json').read_text()))
    for deck in json.loads((DATA/'fixed-decks.json').read_text()):
        wanted.update(row['name'] for row in deck['cards'])
        wanted.update(deck['obvious']+deck['hidden']+deck['traps'])
    manifest=json.loads((DATA/'holdouts/manifest.json').read_text())
    for deck in manifest['decks']:
        if not deck['rawFile']:
            continue
        raw=json.loads((DATA/deck['rawFile']).read_text())
        for row in raw['cards']:
            oracle=row.get('card',{}).get('oracleCard',{})
            if oracle.get('name'):
                wanted.add(oracle['name'])
    remaining=sorted(n for n in wanted if key(n) not in known)
    provenance_path=DATA/'card-provenance.json'
    provenance=json.loads(provenance_path.read_text())
    for offset in range(0,len(remaining),75):
        names=remaining[offset:offset+75]
        raw=request('https://api.scryfall.com/cards/collection',{'identifiers':[{'name':name} for name in names]})
        result=json.loads(raw)
        if result.get('object')!='list' or not isinstance(result.get('data'),list):
            raise RuntimeError('Unexpected Scryfall batch; previous successful snapshots retained')
        digest=hashlib.sha256(raw).hexdigest()
        snapshot=DATA/'scryfall-batches'/f'{digest}.json'
        snapshot.parent.mkdir(parents=True,exist_ok=True)
        snapshot.write_bytes(raw)
        for card in result['data']:
            if not card.get('oracle_id') or not card.get('id'):
                raise RuntimeError('Incomplete canonical card; batch was saved for diagnostics')
            cards=[old for old in cards if old.get('oracle_id')!=card['oracle_id']]+[card]
            provenance.setdefault('canonicalRequests',{})[card['oracle_id']]={'url':'https://api.scryfall.com/cards/collection','retrievedAt':now(),'rawFile':str(snapshot.relative_to(DATA)),'sha256':digest}
        provenance.setdefault('confirmedNotFound',[]).extend(result.get('not_found',[]))
        save(path,cards)
        save(provenance_path,provenance)
        print('Scryfall batch',offset//75+1,'resolved',len(result['data']),'confirmed not_found',len(result.get('not_found',[])))
        time.sleep(0.18)  # Sequential batches, at most ~5.5 requests/second, plus response time.

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--holdouts',action='store_true')
    parser.add_argument('--cards',action='store_true')
    args=parser.parse_args()
    if not args.holdouts and not args.cards:
        parser.error('Select --holdouts and/or --cards; no requests made by default')
    if args.holdouts:
        capture_holdouts()
    if args.cards:
        capture_cards()
