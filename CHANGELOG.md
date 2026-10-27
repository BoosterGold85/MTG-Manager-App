# Changelog

## 0.6.9 — Pings / punisher decks (Valgavoth)

- New Deck DNA theme **Pings / Punisher**: decks that make opponents lose life a little at a time and punish what every player does. Card Intelligence (ruleset 0.3.5) adds **Opponent Life Loss** (opponents or every player lose life or take damage; your own life payments never count; plain "any target" burn is not a ping), **Punisher** (triggers on what players or opponents do, then damages that player) and **Symmetric Draw** (each player draws or wheels). Cards that reward opponents losing life are explicit payoffs for the theme.
- "Whenever an opponent loses life" (and "is dealt damage") is now a Commander trigger the engine understands, instead of "acts every turn". Every card that makes opponents lose life is verified against it. When the reward only triggers on opponents' own turns, punisher, upkeep and draw-step pings count fully and your-turn bursts count less. The Commander Blueprint shows "Rewards opponents losing life".
- Shroud counts as (partial) protection, e.g. Lightning Greaves. Reanimation worded "put(s) … from a graveyard onto the battlefield" counts as recursion, e.g. Exhume.
- Added the supplied 100-card Valgavoth, Harrower of Souls deck as a permanent regression fixture. It reads as Pings / Punisher + Sacrifice (no longer Spells), the Commander reinforces Pings / Punisher, key cards are punisher engines, and Protection and Recursion are no longer zero. Upgrade scoring architecture and the golden engine fixture are unchanged.

## 0.6.8 — Evaluator fixes from the Miles "Tails" Prower Vehicles deck

- **Mass removal**: wipes are detected from the removal clause itself, so modal bullets ("Choose one — • Destroy all creatures"), choices and earlier clauses ("Return a creature you control …, then destroy all other creatures") count as board wipes. Cleansing Nova and Time Wipe now count toward Board Wipes in Deck Health.
- **Key Cards** use strategic centrality instead of general deck fit: primary-theme connections (payoffs and enablers weigh most), verified Commander relationships and the number of verified relationships with other deck cards. A card with no primary-theme or Commander connection is never a key card, however good its fit score; fit only breaks ties.
- **Core Plan payoff**: an explicit payoff signal is still preferred, but a payoff is now also derived from typed relationships. A Commander trigger verified against several primary-theme cards (for example "Whenever a Vehicle you control enters, … draw a card") is named with its full ability line, or failing that, the primary-theme card connected to the most deck cards.
- **Vehicles** are a recognized trigger object: Vehicle cards and Vehicle tokens satisfy "Whenever a Vehicle … enters/attacks" relationships, and the Vehicles plan reads "crew Vehicles and attack with them".
- **Finishers and threats**: Vehicles count as threat bodies (slightly discounted for crewing), large evasive Vehicles count as finishers, and a repeatable attack trigger that adds attacking creatures (e.g. Parhelion-style engines) is a finisher. No card names are used.
- Added the supplied 100-card Miles "Tails" Prower deck as a permanent regression fixture with tests for each behavior, plus generic modal/multi-clause wipe and attack-engine tests.
- Commander Fit, Build Priority and Upgrade Value architecture is unchanged. The golden engine fixture moved in one reviewed way: Utvara Hellkite (attacking Dragon tokens) gained finisher credit, which reorders three near-tie alternative cuts in Reign of Dragons; all values, labels, best cuts and rankings are unchanged.

## 0.6.7 — Deck Workspace UX & Actionability

- An open deck is now a workspace with four sections: **Overview**, **Cards**, **Upgrades** and **Settings**. The section is part of the URL (`&tab=cards|upgrades|settings`; Overview is the default and older deck links still work), so refresh, Back and Forward keep your place; unknown tabs fall back to Overview.
- The deck header shows identity and status only (name, Commander, card count, Complete or cards to go, missing count, colors). Upgrades, rename and delete moved to their sections.
- **Overview** reads top-down: Commander, What This Deck Does, **Deck Health**, Core Plan, Deck DNA, Basic Composition (collapsed) and How this analysis was calculated (collapsed). Deck Health shows each structural role against this Commander's blueprint target (Good / Slightly Low / Low / High), using the same card roles and targets as Upgrade Value; partial protection appears as a fraction. Each DNA theme has an explicit **View Cards** action that opens Cards with a removable theme chip.
- **Cards**: search, a Sort control, a Filters sheet (DNA theme, card type, ownership) with removable chips, a missing-cards notice with **View Missing**, and **+ Add Card** as a focused dialog. The grid shows artwork, name and quantity, with Missing or the active sort metric only when relevant; printing and allocation details live in Card Detail, which also holds **Remove one {card}**.
- **Upgrades** is an in-page section instead of a modal. It keeps the v0.6.6 goal chooser, both goals, the delayed "Analyzing owned cards…" status, the Commander Blueprint and every score unchanged. Candidate cards are shorter (name, label and value, best swap, one-line reason, actions) with **Why?** and **Detailed Analysis** disclosures; Card Details keeps Commander Fit, Build Priority and Upgrade Value side by side.
- **Saved**: Save Upgrade (Improve) and Save Candidate (Build) store only the candidate, intent, preferred copy and suggested cut on the deck (`savedCandidates`). Scores are always recalculated when shown, unavailable copies say so, and nothing is moved automatically.
- **Build mode actions**: Add to Deck adds an available owned copy to an incomplete deck through the existing add action and stays in Upgrades; full decks offer **Evaluate as Upgrade** instead of adding a 101st card.
- **Review Swap → Confirm Swap**: review the best cut, an alternative or any other deck card (evaluated with the existing compareSwap, invalid swaps explained and blocked), see the expected impact per deck component and choose the physical copy. Confirm performs one atomic repository transaction (one revision): the outgoing card leaves once (missing and basic copies release nothing), one owned copy joins, the deck count is unchanged, copies are never taken from another deck, and a stale or unavailable copy rejects the swap with no write. A fulfilled saved upgrade is removed automatically.
- **Settings**: deck name, Commander (changing it is not supported and says so), decklist source and import problems, and a Danger Zone with Delete Deck.
- Readability: decision text (what the deck does, recommendation reasons, deck health, swap impact) uses primary-color 15–16px prose; set codes, finishes, allocation and methodology use small secondary text.
- Recommendation scores are unchanged: a golden regression fixture captured from v0.6.6 asserts identical candidates, order, Commander Fit, Build Priority, Upgrade Value, best cuts, alternatives, labels and confidence.

## 0.6.6 — Upgrades I Own: two separate questions, and Mayhem

- Upgrades I Own now asks **What are you trying to do?** and answers two questions that are never combined: **Build Around My Commander** (Commander Fit + Build Priority) and **Improve My Current Deck** (Upgrade Value). The v0.6.3 factual engine (canonical card → CardFacts → typed effects → mechanical relationships) is shared by both.
- Commander Blueprint: derived from the Commander's typed mechanics, token types, features and cost plus a normal 100-card structure, with generic adjustments (high-cost Commander → more ramp, self-attacking Commander → more protection, graveyard/spells/tokens/sacrifice/lands/discard plans). No empty-99 deck analysis, no card-name exceptions.
- Commander Fit (Exceptional ≥90, Excellent ≥80, Strong ≥68, Good ≥55, Situational ≥35, Weak) and Build Priority (Core ≥85, High Priority ≥72, Strong Consideration ≥60, Consider ≥47, Situational ≥34, Low Priority) are separate scores. Default order: Build Priority → Commander Fit → confidence → name; optional Fit, Priority, mana value and name sorts.
- Upgrade Value: deck utility after the best valid one-for-one swap minus current utility, from a weighted utility vector with diminishing returns, tribal saturation, effective mana value for self-reducing costs, low-impact body analysis and Commander dependency. Bands: Major ≥2, Strong ≥1, Moderate ≥0.45, Minor ≥0.15, Sidegrade ≥−0.15, Downgrade. Best swap, close alternatives, reasons, concerns, confidence and a developer trace (`?trace`) are reported. Low confidence caps at Minor Upgrade and ranks after confident results in the same band.
- Cut validity protects functions: lands only for lands; essential role floors (ramp, card advantage, interaction, protection, wipes, finishers); the only creature/artifact/enchantment answer; controlled discard when the deck needs it.
- CardFacts 1.2.0: controller/beneficiary scope (never widened from "any" to "you"), damage sources and multipliers, combat roles and attack triggers, scoped token multipliers (e.g. Treasure only), answer coverage by permanent type, discard roles.
- **Mayhem** (ruleset 0.3.4): Card Intelligence tags Mayhem Discard-Cast, Madness Discard-Cast and discard payoffs (tag labels differ from the Mayhem/Madness keyword filters). CardFacts model Mayhem as a conditional cast from the graveyard after being discarded this turn; controlled discard, looting and rummaging are enablers; opponent discard is not; Mayhem is not reusable recursion. New **Discard / Mayhem** Deck DNA family surfaces with the deck's real discard outlets; recommendations and upgrades use actual discard support. DNA and synergy versions are 0.6.6.
- Feedback fixes: Archenemy schemes, planes, phenomena, Vanguard, Conspiracy, dungeons, tokens, emblems, art-series cards and attractions/contraptions are never candidates or deck additions (battles remain eligible: they are Commander legal). Chandra's Ignition-style wipes ("each other creature and each opponent") are no longer read as one-sided; they count as a wipe that spares your chosen creature plus reach to each opponent, so they stop being the default cut.
- Protection is graded: a single protection mode (only hexproof, only indestructible) counts as partial protection, and the protection component rises gradually, so one Equipment such as Mithril Coat is a Moderate rather than Strong upgrade.
- Card Detail opened from Upgrades I Own shows the three scores separately. The Deck screen button is renamed **Upgrades I Own**.
- Tests: Reign of Dragons regressions (Dragon Hatchling, Hoarding Dragon, Fiery Emancipation, Savage Beating, Combat Celebrant, Xorn, Vandalblast, Chaos Warp, Death by Dragons), mutation tests (Treasure sources, attack triggers, damage engines, Dragon density, broad answers), eight cross-archetype fixtures, Mayhem and scope tests; browser specs rewritten for the two-goal flow.

## 0.6.5 — Clones & Copies theme

- Fixed clone/copy decks (e.g. Jackal, Genius Geneticist) not being identified. Card Intelligence had no tag for copying permanents, and it labelled "copy that creature spell" as Copy Spells, pulling such decks toward Spellslinger.
- Added Card Intelligence tags **Clones / Copies** (strategy: "enter as a copy of", "become a copy of", "create … token(s) that are copies of") and **Copy Creature Spells** (enabler). Copy Spells is now limited to instant, sorcery and noncreature spells. Reminder text such as populate's is ignored for clone detection.
- Added a **Clones & Copies** Deck DNA family and a **Clones / Copies** Synergy Explorer archetype.
- Ruleset 0.3.3: saved auto-tags recalculate once on next load; manual tag corrections are preserved. DNA and synergy versions are 0.6.5.
- Added a Jackal clone regression deck and 5 unit tests.

## 0.6.4 — Basic Land Import Exception

- Basic lands are detected from card data (the Basic supertype in the type line, front face first), never by name. This covers Plains–Forest, Snow-Covered basics and Wastes; Command Tower, Dryad Arbor and other nonbasic lands are excluded.
- Deck import treats basic lands as decklist resources: no quantity, printing, allocation or shortage checks; never "needs review"; never blocking. The imported or requested printing is kept on the entry (`requestedPrinting` / reference `scryfallId`), which is flagged `basicLand: true`. No physical copy is reserved and owned basics stay available to every deck.
- Deck summaries, rows, filters and Card Detail show basics as "Basic land — allocation not tracked" rather than missing or assigned. They still count toward deck size, land counts, mana value statistics and Deck DNA.
- Adding a basic land from Add Cards to an imported (decklist) deck grows the decklist without consuming a copy. Decks made with New Deck before v0.4.1 keep their existing allocation behavior.
- Nonbasic lands and all other cards keep strict allocation, including "owned but fully assigned" and no taking copies from other decks.
- Added 7 unit tests (A–G scenarios, detection and editor behavior). Updated v0.4.1 tests that used Forest as the multi-printing example to Command Tower, and deck browser expectations for basic Forests.

## 0.6.3 — Recommendation Engine vNext

- Replaced the seven-part tag-informed per-card scorer with typed canonical facts, validated rules relationships, six configurable weighted components, signed penalties, a separate confidence level and an evidence gate for 80+. Broad tags remain discovery/descriptive data rather than independent point sources.
- Added typed tutors, tokens, mana and tribal effects; basic-land-to-hand is smoothing rather than unrestricted tutoring/ramp. Corrected reminder-text, ability-word, controller and sacrifice-versus-death relationship errors.
- Added typed role-gap/token-priority profiles, saturation/curve/conflict analysis, exact score evidence and developer-only traces. Updated bands and confidence/interaction/need/efficiency tie-breakers.
- Added optional conservative potential replacements and component deltas to existing Compare; never writes a deck or moves a copy. Preserved compact candidate hierarchy and lazy Why this score? disclosures.
- Added the supplied exact 100-card Reign of Dragons fixture with 69 confirmed printing snapshots and the canonical Wayfinder/Fire Nation cases. Existing non-scoring regression contracts remain intact; scoring assertions now reflect the requested model. No dependencies, accounts, cloud sync, external recommendations or v0.7.0 work.

## 0.6.2 — Synergy Explorer UX Polish

- Compact candidate cards now show concise ownership and one or two deterministic evidence-based sentences instead of repeated technical explanations, utility lists and conflicts. Fully assigned copies retain deck usage.
- Renamed the lazy collapsed diagnostic section to Why this score?; all exact components, counts, penalties, raw/final totals and interaction evidence remain available. Compare precedes printing diagnostics.
- Reduced candidate spacing without shrinking approved type or artwork. Preserved v0.6.1 scores, tier boundaries, ranking, caches, full-set search, progressive rendering, comparisons and saved data. No v0.7.0 work.

## 0.6.1 — Deck-aware Synergy Scoring

- Replaced the generic overlap score with a cached DeckStrategyProfile and seven bounded components: Commander 30, primary strategy 25, role need 15, packages 10, contextual efficiency 10, generic overlap 5 and curve fit 5. Signed penalties can override generic value; scores clamp to 0–100 without artificial distribution or five-point rounding.
- Added canonical object/type/action matching, own-vs-other triggers, nontoken/noncreature and keyword constraints, contextual counters, exact damage requirements, compatible trigger amplification, nonlegendary copy, blink and combat support. No card/deck-name recommendation tables, price or owned-quantity scoring.
- Retained descriptive Deck DNA themes, card tags, manual corrections, imports, ownership and printing logic. Candidate order is now final score first, then copy availability as a tie-breaker. Recommended ≥70; Worth Considering 50–69; Other Legal Cards <50 is collapsed and clearly labeled.
- Added exact collapsed score breakdowns and component/negative evidence to candidates and shared deck-relative detail, with bounded local caches and lazy breakdown rendering. No automatic swaps/moves, suggested cuts, database migration or later-roadmap work.

## 0.6.0 — Synergy Explorer / Upgrades I Own

- Added Explore Synergy from a saved deck: owned canonical cards outside the full decklist and within Commander color identity, with grouped printings and available-copy priority. Fully assigned candidates show where copies are used.
- Extracted the existing per-card scorer without changing Deck DNA behavior; candidate scores use frozen deck themes and the same evidence, Commander connections and five-point scale. Availability affects ordering only.
- Added local search, copy-availability views, bounded initial rendering, printing counts, shared card details and explicit manual comparison against a current deck card. No swaps, deck edits, assignments, ownership changes, remote analysis or suggested cuts.
- Preserved storage recovery, imports, allocations, browsing, intelligence, backups and design tokens. No schema migration.

## 0.5.2 — Audit fixes

- Other open tabs now detect a newer saved revision (BroadcastChannel after each committed save, plus a check when the tab becomes visible) and offer **Load latest**. Nothing is replaced silently, so open previews keep their input; revision-checked writes still reject stale saves.
- Screen and deck identity live in the URL (`?view=decks`, `?view=decks&deck=<id>`) with browser history and document titles (`MTG Manager — <deck name>`). Reload and Back/Forward restore the screen; overlay Back behavior is unchanged; an unknown deck link falls back to the library. Tapping Decks returns to the deck library.
- Deck empty state explains both paths: Import Deck works without owned cards; New Deck and copy assignments need the imported collection.
- Consistent units: the binder results line and footer show records (printing/finish/condition groups) and physical copies; deck summaries say copies assigned vs. decklist cards.
- Larger mobile supporting text: tile names 12px (11px under 375px), tile subtitles/rarity 10px, bottom navigation labels 11px, version/footer 10px, sample label 9px. Grid and artwork hierarchy unchanged.
- README request pacing corrected to the actual 250 ms contract.
- Added an opt-in `webkit-iphone` Playwright project (`TEST_WEBKIT=1`) and `docs/IPHONE-SMOKE-CHECKLIST.md` for physical-device verification. WebKit is not run by default and was not run for this release.
- Added cross-tab unit tests and three browser workflows across five sizes.

## 0.5.1 — Storage / Deck Import Reliability

- Recover once from closing/invalid cached IndexedDB connections when starting load/save transactions; invalidate on close/versionchange and guard against late older-connection events. No retry after requests have started, duplicate writes or weakened revision checks.
- Wait for read transaction completion and retain technical causes behind controlled storage messages.
- Verify collection ownership freshly before deck preview. Read failure blocks reconciliation and confirmation, retains source text and offers Retry ownership check / Cancel; failure never becomes a false all-Missing preview. No database clear, ownership reset or collection re-import.
- Added deterministic connection/revision/failure tests and five-size 100-card import/retry/atomic-save browser workflows. Deck DNA and prior collection/deck behavior are unchanged.

## 0.5.0 — Deck DNA Core

- Added a local deterministic derived Deck DNA engine over canonical Card Intelligence: bounded theme families, repeated-strategy weighting, capped Commander reinforcement and normalized explanatory weights. Missing/unassigned cards count equally; no taxonomy, ownership or persistence schema changes.
- Added evidence-led What This Deck Does, Core Plan and strategy anchors, with explicit weak-evidence fallbacks and inspectable contributing subthemes/cards. No generated win claims or LLM services.
- Added coarse per-card Synergy with theme overlap, Commander connections, payoff/enabler roles, actual evidence and score components; excluded price, popularity and generic power.
- Added In This Deck to shared deck Card Detail, Synergy sorts and lightweight DNA theme filtering. Previous/Next uses the same filtered/sorted sequence; ordinary Collection detail is unchanged.
- Added canonical-content/ruleset caching, ownership-neutral reuse and semantic-change invalidation. Shared the existing canonical analysis cache through a small extraction to avoid duplicate per-printing analysis and a module dependency cycle. Backups retain all original fields with the new app version.
- Added four strategy regression decks, analytical/caching/performance tests and responsive browser workflows. Preserved all approved importer/collection/allocation/navigation/intelligence/PWA regressions. No v0.6.0 features.

## 0.4.2 — Deck Browsing & Card Navigation

- Deck cards open the shared Card Detail (the same component as Collection) with Oracle text, Keywords, Card Intelligence, manual tag overrides, evidence and Deck Usage. Collection detail is unchanged when no deck context is supplied.
- Added an in-place Previous/Next bar with a position indicator (e.g. `3 of 9`), disabled boundaries, no wraparound, keyboard arrows (ignored while typing) and scroll-to-top per card. Mobile uses large thumb targets.
- Added deck sorting (Card Type → Mana Value → Name default, Name, Mana Value, Color, Set & Collector Number) with deterministic Name and printing tie-breaks, plus deck search, card-type and owned/missing filters. Navigation follows the exact visible filtered and sorted sequence.
- Unified deck grid: one tile per assigned printing group plus one per entry's unassigned remainder. A Deck entry section distinguishes the assigned printing, "Physical assignment: None", owned elsewhere, and not currently owned. No printing is substituted or fabricated.
- Card Intelligence for unowned decklist cards is computed locally once per canonical card and ruleset and reused; browsing causes no recalculation or network requests. Detail artwork resets per card.
- Added a direct Delete this deck action on the deck screen (same confirmation and safety).
- Added a release regression uploading 4,421 CSV rows with a transient batch failure and one malformed printing, repairing only that row on re-import and verifying cache reuse across all five sizes.
- Added 8 unit tests and 3 browsing workflows (15 cases across five sizes). All prior suites remain green. No Deck DNA or v0.5.0 work.

## 0.4.1 — ManaBox Deck Import

- Added Decks → Import Deck with ManaBox deck file upload or pasted text, preview-first; nothing is saved before explicit confirmation. No account connection, scraping or Cloud Sync.
- Added a tolerant ManaBox/MTGA text parser: quantity, name, optional set code and collector number, blank lines, Commander/Deck/Sideboard/Maybeboard/Companion/About headings, category headings, `SB:` and commander markers, split/double-faced name normalization. Malformed and non-imported rows are retained with reasons.
- Added offline-first resolution (saved/bundled metadata → Scryfall printings → exact names) on the existing paced/retrying/cached client. Exact printings are preferred; a missing or conflicting printing falls back to the name with a visible note. Lookup outages offer Retry rather than producing problem rows.
- Commander detection uses an explicit section/marker when canonically eligible; otherwise the user must select among canonical candidates. Up to two commanders (Partner/Background, not validated); more are refused.
- Ownership reconciliation classifies exact, alternate printing, owned-but-allocated, missing and ambiguous cards. It auto-assigns exact available copies, visibly suggests a single available alternative, requires choices for multiple printing groups, and never takes copies from other decks. Summary shows cards, exact, alternate, owned-unassigned, missing and needs-review counts.
- Introduced `DecklistEntry` separate from `DeckCardAssignment` (linked by `entryId`), optional commander copy references, retained `importIssues` and import source. Missing cards are imported without fake ownership or Collection changes. Color identity conflicts are surfaced and receive no copy. Duplicate deck names are never overwritten (Import as new deck / Cancel).
- Deck editor shows owned/assigned/missing counts, a Missing / Unassigned section with reasons, and retained import problem rows (copy/download). Add Cards fills matching missing entries. Validation, backup and collection clear handle entry decks. Legacy v0.4.0 decks are unchanged.
- Importer reliability fix: one unexpected Scryfall card no longer stalls a whole lookup batch. Reversible cards use face type line/mana value/oracle ID; malformed metadata and mismatched answers become problems for their own rows; a migrated Scryfall ID is accepted only for an exact set/collector-number/name match. Short or failed responses still interrupt, and the interruption message now names the underlying cause.
- Added 18 unit tests and 2 browser workflows across all five sizes. All v0.4.0, v0.3.2 and v0.3.1 suites remain green. No v0.5.0 features.

## 0.4.0 — Commander Library

- Added artwork-first Decks navigation/library, name → owned commander creation, saved editor, basic composition, rename and confirmed deletion.
- Added canonical commander eligibility and color-identity subset enforcement; reused collection search, tags, Keywords and filters for owned-card additions. Full format validation remains explicitly limited.
- Introduced Deck/DeckCommander/DeckCardAssignment references and a DeckRepository boundary using the existing revision-checked IndexedDB transaction. Commander reservations and printing-level assignments derive assigned/available quantities atomically; no automatic copy movement or over-allocation.
- Added per-printing owned/assigned/available captions, exhausted-copy deck usage, release actions and subordinate Collection Card Detail Deck Usage.
- Preserved assignments across ManaBox re-import/recalculation. Reduced quantities produce visible recoverable conflicts rather than deleted assignments; zero-owned deck records remain manageable. Allocated collection removal/clear is guarded to prevent dangling references.
- Extended JSON backup with decks, commander references and assignments without removing existing fields. Added allocation/re-import/storage regressions and five-size production browser flows. Preserved v0.3.2 intelligence/brand/PWA and v0.3.1 importer systems. No v0.5.0 features.

## 0.3.2 — Intelligence Polish & Tagging Accuracy

- Formalized the approved visual identity into centralized palette/semantic tokens for surfaces, text, borders, focus, selection, disabled/destructive states, spacing, radii, typography and shadows. Existing layout and functionality are retained.
- Added temporary diamond SVG/ICO/PNG app icons, Apple touch asset and PWA/maskable manifest references, generated from token colors. Added brand/asset validation; no naming change, offline service worker or rebrand.

- Fixed self-type Oracle references being mistaken for Artifacts/Enchantments Matter; require actual strategic references.
- Replaced capitalized-word subtype inference with a bundled Scryfall creature-type catalog, validated dynamic IDs and explicit payoff/enabler detection. Fixed Éowyn Human synergy and rejected Eachs Matter/other junk types.
- Separated generic Death Triggers from Sacrifice Payoff while retaining valid aristocrats drain classification.
- Distinguished self-exile graveyard resources from Graveyard Hate, added token-copy reanimation, tightened self-cast versus Recursion, and recognized optional discard outlets.
- Added waived equip costs as Cost Reduction; protected Doubling Season, Diregraf Colossus, Desecrated Tomb and Ghirapur Orrery results with canonical fixtures.
- Added canonical Keywords filtering/detail metadata as a separate layer from strategic tags, plus optional Name/Oracle Text/All search across faces.
- Bumped ruleset to 0.3.2 for one-time recalculation with manual overrides preserved. Added ten real-card snapshots, rule-quality/unit/browser regressions and accessibility checks. Card tile names use natural text with printing/quantity descriptions, preserving visuals and action names even when art is unavailable.
- Preserved v0.3.1 importer reliability and all collection-management behavior. No v0.4.0 functionality.

## 0.3.1 — Importer Reliability

- Fixed service/batch failures being converted into one false Problem Row per card. Interrupted lookups now block preview and offer Retry unresolved with retained parsed input and successful lookups.
- Added conservative exponential retries for timeouts, 429, 5xx and network/CORS failures; honored full numeric/date Retry-After and slowed request pacing to at most four starts/second, further reduced after 429.
- Added per-batch persistent canonical metadata checkpoints outside ownership storage, with session fallback if cache persistence fails. Reopening/re-importing reuses successful metadata without restarting lookups from zero.
- Require explicit identifier-level not_found for missing collection results; incomplete/failed batch responses remain service interruptions. Printing IDs stay authoritative.
- Added a 4,421-row deterministic regression interrupted after 1,839 successes, full recovery across resolver recreation, stale-problem cleanup, cache reuse and unchanged re-import assertions. Added transport/backoff/cancellation tests and browser interruption/retry coverage.
- Preserved collection quantities, confirmed-import atomicity, management and existing Card Intelligence. No further intelligence features or v0.4 work.

## 0.3.0 — Card Intelligence & Auto-Tags

- Added a centralized 78-tag taxonomy and dynamic creature-type synergy signals, with 13 explainable rule modules and canonical-identity deduplication.
- Added structured assignments with evidence, face/field provenance, confidence heuristics and ruleset version; retained richer Scryfall metadata where available.
- Added worker-based import/upgrade/recalculation lifecycle, progress, persisted auto-tag caches and canonical-input fingerprint invalidation. No model API, API key or new network provider.
- Added searchable ANY/ALL synergy filtering and restrained quick-tag browsing, combined with all approved binder filters and Commander Colors.
- Replaced sample intelligence previews with real grouped tags, keyboard-accessible evidence, manual add/hide/restore and preserved automatic evidence. Corrections survive reload, re-import and recalculation.
- Added Recalculate Auto-Tags to management; backups include intelligence and clear resets it through the existing atomic repository. Existing inventory behavior is preserved.
- Added curated/negative/multi-face/lifecycle/filter/performance fixtures and browser tests. Updated only obsolete sample-preview expectations and strengthened evidence focus checks in prior tests.
- Fixed detail-shell scrolling when focusing the expanded tag editor, keeping the close control reachable.
- No Commander Library, deck assignment, Deck DNA, recommendations, accounts, cloud sync or v0.4+ features.

## 0.2.1 — Collection Management & Multi-Select

- Added stable-ID multi-select, selected indicators, hidden-selection retention and a safe-area-aware sticky action bar. Select all includes every filtered/searched result, beyond rendered tiles.
- Added confirmed bulk and Card Detail removal through the existing atomic, revision-checked repository. Local removals can return on later ManaBox import.
- Added Manage Collection with stored-record and physical-copy statistics, last successful import, persistence guidance and JSON backup export.
- Added deliberate full clear requiring typed confirmation, persistent empty state, and reset of import/problem/selection/filter state. Failed writes retain the existing UI and support retry.
- Added management persistence, browser, accessibility, backup and re-import regression tests across all five approved viewports. Preserved v0.2.0 tests and import architecture.
- No backup restore, accounts, cloud sync or v0.3.0 functionality.

## 0.2.0 — Real Collection Foundation

- Added a premium ManaBox CSV upload → parse → preview → confirm → binder flow with success, partial-success and error states.
- Added deterministic ID / printing / exact-name matching, explicit ambiguity handling and retained original problem rows.
- Added non-destructive absolute-quantity re-imports, duplicate-row aggregation and distinct printing/finish/language/condition/binder records. Groups with problematic duplicate rows retain their old totals until corrected.
- Added atomic IndexedDB persistence behind a repository interface, revision conflict protection and saved canonical metadata.
- Added quantityOwned / quantityAssigned / quantityUnassigned, original source and purchase-field preservation, and compact ownership details.
- Added worker-based CSV parsing, deduplicated Scryfall batches and persisted unique-name resolutions; no API calls while browsing.
- Preserved the approved v0.1.1 binder, Commander Colors and original tests. Added import, sync, persistence, large-collection and accessibility tests.
- No accounts, automated tagging, AI, Commander management, recommendations or v0.3.0 work.

## 0.1.1 — Binder Polish

- Added a separate Commander Colors collection filter covering all 32 color identities, including colorless. Cards match only when their Scryfall color identity is a subset of the selected identity; colorless cards always qualify.
- Preserved the normal Color filter and combined-filter, apply/cancel, active-state and reset behavior.
- Added subset-rule unit tests and responsive browser coverage. No later roadmap features added.

## 0.1.0 — Digital Binder Foundation

- Added a premium, dark mobile-first collection binder with 32 sample printings and 82 copies.
- Bundled real Scryfall artwork and local fonts; no runtime API calls.
- Added immediate name search, combined color/type/mana/rarity/set/finish/sample-tag filters and four sort modes.
- Added accessible card details, preview-only curated tags, modal focus management and natural browser-back dismissal.
- Added responsive shell, mobile bottom navigation, future Commanders placeholder, loading skeletons, empty states and broken-image fallbacks.
- Added unit and five-viewport browser acceptance tests and static Cloudflare Pages build instructions.
- No accounts, imports, persistence, deck management, recommendations or automated intelligence.
