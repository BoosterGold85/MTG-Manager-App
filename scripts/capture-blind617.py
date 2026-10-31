"""Freeze user-selected public exports without invoking the recommendation engine."""
import hashlib, importlib.util, json, pathlib, re, time
spec=importlib.util.spec_from_file_location('capture',pathlib.Path(__file__).with_name('fetch-recall-data.py'))
capture=importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)
root=pathlib.Path(__file__).resolve().parents[1]/'tests/audit/blind617'
manifest_path=root/'capture.json'
manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {'status':'not-evaluated','decks':[]}
pack=json.loads((root/'source/holdouts.json').read_text())
replacement=root/'source/replacement-zada.json'
if replacement.exists():
 selected=json.loads(replacement.read_text())
 pack['holdouts']=[selected if d['id']==selected['id'] else d for d in pack['holdouts']]
for deck in pack['holdouts']:
 if any(d['id']==deck['id'] for d in manifest['decks']):continue
 deck_id=re.search(r'/decks/(\d+)',deck['url'])[1]
 url=f'https://archidekt.com/api/decks/{deck_id}/?format=json'
 raw=capture.request(url)
 data=json.loads(raw)
 if not isinstance(data.get('cards'),list):raise ValueError('Not a public deck export')
 output=root/'raw'/f'{deck["id"]}.archidekt.json'
 output.write_bytes(raw)
 categories={c['name']:c.get('includedInDeck') for c in data.get('categories',[])}
 main=[]
 for row in data['cards']:
  boards=row.get('categories',[])
  if 'Sideboard' in boards or any(categories.get(c) is False for c in boards):continue
  if not any(categories.get(c) is True or c=='Commander' for c in boards):raise ValueError('Unknown board: '+str(boards))
  main.append({'name':row['card']['oracleCard']['name'],'quantity':row['quantity'],'commander':'Commander'in boards})
 names={r['name'] for r in main}
 record={**deck,'exportUrl':url,'retrievedAt':capture.now(),'sha256':hashlib.sha256(raw).hexdigest(),'cards':main,'total':sum(c['quantity'] for c in main),'alreadyPresentExpected':[n for n in deck['expected'] if n in names],'alreadyPresentMisleading':[n for n in deck['misleading'] if n in names],'status':'captured-not-evaluated' if sum(c['quantity']for c in main)==100 else 'incomplete-source-not-evaluated','excludedSideboardCopies':sum(r['quantity']for r in data['cards']if 'Sideboard'in r['categories'])}
 manifest['decks'].append(record)
 capture.save(manifest_path,manifest)
 print(deck['id'],record['total'],'expected already present:',record['alreadyPresentExpected'],flush=True)
 time.sleep(0.25)
