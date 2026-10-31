"""Canonical metadata capture only; never evaluate, score or edit expectations."""
import hashlib, importlib.util, json, pathlib, time
spec=importlib.util.spec_from_file_location('capture',pathlib.Path(__file__).with_name('fetch-recall-data.py'))
capture=importlib.util.module_from_spec(spec);spec.loader.exec_module(capture)
root=pathlib.Path(__file__).resolve().parents[1]/'tests/audit/blind617'
manifest=json.loads((root/'capture.json').read_text())
key=lambda n:n.replace('’',"'").strip().casefold()
output=root/'canonical.json'
baseline=json.loads((root.parent/'recall/cards.scryfall.json').read_text())
cards=json.loads(output.read_text()) if output.exists() else []
known={key(n) for c in baseline+cards for n in [c['name']]+([c['card_faces'][0]['name']]if c.get('card_faces')else[])}
wanted={n for d in manifest['decks']for n in [d['commander']]+d['expected']+d['misleading']+[c['name']for c in d['cards']]}
missing=sorted(n for n in wanted if key(n)not in known)
(root/'scryfall-batches').mkdir(exist_ok=True)
for start in range(0,len(missing),75):
 names=missing[start:start+75]
 raw=capture.request('https://api.scryfall.com/cards/collection',{'identifiers':[{'name':n}for n in sorted(set(n.split(' // ')[0]for n in names))]})
 batch=json.loads(raw)
 if batch.get('object')!='list':raise ValueError('Unexpected canonical response')
 (root/'scryfall-batches'/f'{hashlib.sha256(raw).hexdigest()}.json').write_bytes(raw)
 cards.extend(batch['data']);capture.save(output,cards)
 print('Canonical records captured:',len(batch['data']),'not found:',batch.get('not_found',[]),flush=True)
 if batch.get('not_found'):raise ValueError('Missing canonical names require review; prior batches retained')
 time.sleep(.25)
if not output.exists():capture.save(output,cards)
capture.save(root/'canonical-provenance.json',{'retrievedAt':capture.now(),'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'records':len(cards),'baselineFile':'../recall/cards.scryfall.json','baselineSha256':hashlib.sha256((root.parent/'recall/cards.scryfall.json').read_bytes()).hexdigest(),'purpose':'Offline canonical metadata only; raw popularity fields are not engine inputs.'})
