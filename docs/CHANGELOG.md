# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - Unreleased
- Fixed reroll flow to preserve cleared state/history instead of dropping today's completion record
- Persisted today's completion into `dailyState.history` immediately when solved check succeeds
- Hardened streak computation to honor history-based completion for today
- Replaced raw handle validation errors with user-friendly messages for not found, network, and rate limit cases
- Added multi-page candidate pool fetching (1..5) with criteria-based cache reuse and stale fallback

## [1.0.0] - 2026-02-23
- Initial extension release
- Repository structure reorganized for maintainability
