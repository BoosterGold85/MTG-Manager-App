# Universal Synergy Engine — dormant research module

This is the exact `phase4-remediation.1` engine frozen at source commit
`0c36712`, copied without behavioral changes. `manifest.json` pins the source
hashes and records `active: false` and `productionScoringIntegration: false`.
No application or worker entry point imports it; there is no enabled analyzer.
The manifest describes the dormant boundary, not a production-ready feature.

The engine retains typed abilities, explicit hypothetical states, paid resources,
mechanical event traces, bounded producer/consumer discovery, replay, net holdings
and conservative dependency invalidation. It is a Node research module;
`node:crypto` and its dependency boundary require a browser adapter before use
in a recommendation/analyzer worker.

Mechanical correctness is not certified for arbitrary cards. On the previously
exposed Phase 4 regression pack it established 41/104 positive claims, with
0/214 false certifications. The supported-claim precision estimate was 100%
(descriptive 95% Wilson interval 91.4–100%), and recall 39.4% (30.6–49.0%).
Those labels were not independently adjudicated. Parsed nonland coverage was
8.4% Commander and 10.0% Legacy; 30 complete-deck diagnostic projections returned
zero chains. Additional-cost proof provenance and independent explanation review
remain incomplete. None of these numbers is a synergy score or win rate.

`docs/MERGE-REVIEW.md` documents the dormant-merge decision and compatibility
checks. `docs/ANALYZER-DESIGN.md` describes a proposed, disabled, read-only analyzer
and its activation gates. `docs/COVERAGE-PRIORITIES.md` ranks the next mechanical
work using observed unsupported cards. Those are proposals, not active features.

The test-only predecessor Oracle snapshots remain under `research/universal/data`
and `research/validation-phase4/data` to retain original development scenarios
and the four illegal-target regressions. Historical inference/evaluation outputs
remain preserved on the separate remediation research branch; this minimal
integration does not bring its large intermediate reports or old engine into main.
