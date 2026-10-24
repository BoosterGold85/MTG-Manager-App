# iPhone smoke checklist

Automated browser tests run on Chromium (five sizes). `TEST_WEBKIT=1 TEST_PRODUCTION=1 npx playwright test --project=webkit-iphone` adds the Safari engine after `npx playwright install webkit`. Neither proves real iOS behavior: Safari suspend/resume, the installed home-screen app, storage quota and eviction. Run this on a physical iPhone before each release. Do it once in Safari and once from the home-screen icon.

Use a test export, not your only copy of real data. Record iOS version, Safari/home-screen mode, app version (header) and pass/fail per step.

1. Open the deployed site. The header shows the expected version; the collection or sample binder appears.
2. **Import:** Import Collection → choose a ManaBox CSV → preview → Confirm once. Totals match the preview.
3. **Background/foreground:** during a large import's card lookup, switch to another app for 30+ seconds and return. Either the lookup continues, or "Retry unresolved" appears and completes without restarting from zero.
4. **Reload:** pull to refresh. The same records and copies appear; no sample binder.
5. **Ownership retry:** start Import Deck with a list containing owned and missing cards. Resolve any printing choices and confirm **once**. Exactly one deck is created, with no duplicate after tapping slowly or twice.
6. **Reopen deck:** close the app fully (swipe away), reopen, and go to Decks → the deck. Assigned copies, missing cards and Deck DNA match. The URL `?view=decks&deck=…` reopens the same deck.
7. **Card navigation:** open a deck card, use Previous/Next through several cards; the sheet stays open and the position updates.
8. **Second tab:** with the site open in two Safari tabs, import in one. The other shows "Your collection changed in another tab" when it is brought forward; Load latest shows the new data.
9. **Backup:** Manage Collection → Export Backup. The JSON downloads (Files app) and contains `collection.decks`.
10. **Storage persistence:** wait a day without opening the app, then reopen. Data is still present. If it isn't, record the iOS version and whether the app was used from the home screen.
