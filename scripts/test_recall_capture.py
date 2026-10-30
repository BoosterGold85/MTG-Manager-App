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

if __name__=='__main__':unittest.main()
