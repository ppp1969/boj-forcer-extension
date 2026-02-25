# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-02-25
- Added day-level completion split (`doneToday`) and preserved clear history while auto-advancing to the next random problem after solve
- Upgraded Check flow: popup-open immediate check, active-state 1 minute polling, and 15 second duplicate check guard
- Renamed UI term from Re-check to Check
- Added Change Today's Problem flow: Random Pick + Problem Number with shared daily change budget
- Added options tag filtering UX: search, Select All/Clear All, default collapsed list with Show More/Show Less, and restored selection state
- Added solved.ac tag catalog caching (weekly refresh + fallback) and normalized legacy tag key mismatch (`tree` -> `trees`)
- Changed popup Change section default state to collapsed
- Improved handle validation flow to save nickname only after explicit Check and apply user tier-based default range (`±5`)

## [1.0.1] - 2026-02-23
- Fixed reroll flow to preserve cleared state/history instead of dropping today's completion record
- Persisted today's completion into `dailyState.history` immediately when solved check succeeds
- Hardened streak computation to honor history-based completion for today
- Replaced raw handle validation errors with user-friendly messages for not found, network, and rate limit cases
- Added multi-page candidate pool fetching (1..5) with criteria-based cache reuse and stale fallback

## [1.0.0] - 2026-02-23
- Initial extension release
- Repository structure reorganized for maintainability
