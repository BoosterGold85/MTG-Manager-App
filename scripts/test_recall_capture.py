"""Offline regression checks for the developer-only fixture capture client."""
import hashlib
import importlib.util
import json
import pathlib
import tempfile
import unittest
import urllib.error
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('capture',pathlib.Path(__file__).with_name('fetch-recall-data.py'))
capture=importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)

class Reply:
    def __init__(self,raw):self.raw=raw
    def __enter__(self):return self
    def __exit__(self,*_):return False
    def read(self):return self.raw

class CaptureTests(unittest.TestCase):
    def test_429_respects_retry_after(self):
        error=urllib.error.HTTPError('https://api.scryfall.com',429,'rate limit',{'Retry-After':'2'},None)
        with patch.object(capture.urllib.request,'urlopen',side_effect=[error,Reply(b'{"data": []}')]),patch.object(capture.time,'sleep') as sleep:
            self.assertEqual(capture.request('https://api.scryfall.com'),b'{"data": []}')
            sleep.assert_called_once_with(2)

    def test_policy_denial_is_not_retried(self):
        error=urllib.error.HTTPError('https://api.scryfall.com',403,'blocked',{},None)
        with patch.object(capture.urllib.request,'urlopen',side_effect=error) as request,patch.object(capture.time,'sleep') as sleep:
            with self.assertRaises(urllib.error.HTTPError):capture.request('https://api.scryfall.com')
            self.assertEqual(request.call_count,1)
            sleep.assert_not_called()

    def test_html_success_is_not_accepted_as_json(self):
        with patch.object(capture.urllib.request,'urlopen',return_value=Reply(b'<html>not a deck</html>')):
            with self.assertRaises(json.JSONDecodeError):capture.request('https://archidekt.com')

    def test_persistent_network_failure_is_bounded(self):
        with patch.object(capture.urllib.request,'urlopen',side_effect=urllib.error.URLError('timeout')) as request,patch.object(capture.time,'sleep'):
            with self.assertRaises(urllib.error.URLError):capture.request('https://api.scryfall.com')
            self.assertEqual(request.call_count,4)

    def test_capture_is_resumable_and_hash_checked(self):
        with tempfile.TemporaryDirectory() as folder,patch.object(capture,'DATA',pathlib.Path(folder)),patch.object(capture.time,'sleep'):
            data=pathlib.Path(folder);(data/'holdouts').mkdir()
            raw=b'{"cards": [{"quantity": 1}]}'
            manifest={'decks':[{'id':'H05','source':'https://archidekt.com/api/decks/1/?format=json','rawFile':None,'sha256':None}]}
            capture.save(data/'holdouts/manifest.json',manifest)
            with patch.object(capture,'request',return_value=raw) as request:
                capture.capture_holdouts();capture.capture_holdouts()
                self.assertEqual(request.call_count,1)
            saved=json.loads((data/'holdouts/manifest.json').read_text())['decks'][0]
            self.assertEqual(saved['sha256'],hashlib.sha256(raw).hexdigest())
            (data/saved['rawFile']).write_bytes(b'changed')
            with self.assertRaisesRegex(RuntimeError,'Frozen holdout changed'):capture.capture_holdouts()

    def test_prepared_back_face_does_not_satisfy_or_replace_standalone_spell(self):
        prepared={'id':'prepared-print','oracle_id':'prepared-oracle','name':'Grave Researcher // Reanimate','set':'test','collector_number':'1','type_line':'Creature // Sorcery','cmc':3,'color_identity':['B'],'card_faces':[{'name':'Grave Researcher'},{'name':'Reanimate'}]}
        standalone={'id':'spell-print','oracle_id':'spell-oracle','name':'Reanimate','set':'test','collector_number':'2','type_line':'Sorcery','cmc':1,'color_identity':['B']}
        with tempfile.TemporaryDirectory() as folder,patch.object(capture,'DATA',pathlib.Path(folder)),patch.object(capture.time,'sleep'):
            data=pathlib.Path(folder)
            for name,value in [('cards.scryfall.json',[prepared]),('fixed-candidates.json',['Reanimate']),('coverage-cases.json',[]),('fixed-decks.json',[]),('holdouts/manifest.json',{'decks':[]}),('card-provenance.json',{})]:capture.save(data/name,value)
            raw=json.dumps({'object':'list','data':[standalone],'not_found':[]}).encode()
            with patch.object(capture,'request',return_value=raw) as request:
                capture.capture_cards();capture.capture_cards()
                self.assertEqual(request.call_count,1)
                self.assertEqual(request.call_args.args[1]['identifiers'],[{'name':'Reanimate'}])
            saved=json.loads((data/'cards.scryfall.json').read_text())
            self.assertEqual({c['oracle_id'] for c in saved},{'prepared-oracle','spell-oracle'})

    def test_incomplete_cached_metadata_is_refreshed(self):
        card={'id':'print','oracle_id':'oracle','name':'Sol Ring','set':'test','collector_number':'1','type_line':'Artifact','cmc':1,'color_identity':[]}
        with tempfile.TemporaryDirectory() as folder,patch.object(capture,'DATA',pathlib.Path(folder)),patch.object(capture.time,'sleep'):
            data=pathlib.Path(folder)
            for name,value in [('cards.scryfall.json',[{'id':'print','name':'Sol Ring'}]),('fixed-candidates.json',['Sol Ring']),('coverage-cases.json',[]),('fixed-decks.json',[]),('holdouts/manifest.json',{'decks':[]}),('card-provenance.json',{})]:capture.save(data/name,value)
            with patch.object(capture,'request',return_value=json.dumps({'object':'list','data':[card]}).encode()) as request:
                capture.capture_cards()
                request.assert_called_once()
            self.assertEqual(json.loads((data/'cards.scryfall.json').read_text()),[card])

if __name__=='__main__':unittest.main()
