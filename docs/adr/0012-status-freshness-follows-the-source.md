# 12. Status freshness follows the source's observations

- **Status:** Proposed. The threshold value and the metric change need the product owner's OK.
- **Date:** 2026-10-28
- Refines [ADR 0005](0005-tri-state-accessibility-verdict.md) and [ADR 0010](0010-verdict-rules.md).

## Context

Building the poller (Phase 5) against the real feed showed:

- Every device record has a `time`: when seguimos.cl last checked it. Its history shows checks at
  **12:21 and 20:21**, about twice a day, not every few minutes.
- On 2026-10-28 the newest `time` was **2026-10-16 20:21**: the feed had not updated for 12 days,
  while still answering HTTP 200 with full data.
- A few devices lag the rest (one by 10 days).

If freshness were measured by when _we_ fetched, a poller running every 2 minutes would make
12-day-old statuses look current: the false all-clear ADR 0005 exists to prevent. And ADR 0010's
10-minute threshold can never be met by a source that observes twice a day, so every verdict
would be `unknown` even when the feed is healthy.

## Decision

- A snapshot is dated by the source's **newest observation** (`observedAt`, parsed as Santiago
  time), never by our fetch time. Core's `StatusSnapshot` field is named `observedAt` to make
  this hard to get wrong.
- A device whose record lags the newest by more than a day is dropped from the snapshot, so it
  reads as "no status" (`unknown` if it's an elevator on your path), not as its old state.
- The API passes `maxSnapshotAgeMs` to core from `STATUS_MAX_AGE_MINUTES`, **default 13 hours**:
  one missed check (12 h) plus a margin. Core's own default (10 minutes) stays for sources that
  update often.
- `/v1/status` reports `stale` (the source stopped updating) separately from `degraded` (our
  fetch failed), so the UI and alerts can tell them apart.

## Needs a decision

1. **Is a status up to 13 hours old acceptable to show as confident?** It's the best this source
   offers. The alternative is `unknown` for most of every day.
2. **The brief's metric "status freshness p95 < 3 min" can't be met by this source.** Proposal:
   measure what we control, _poll lag_ (time from a source update to our snapshot, p95 < 3 min),
   and track _data age_ separately with an alert when the source stops updating (> 13 h).
3. **Ask Ariel López** whether the feed is meant to update twice a day, why it stopped on
   2026-10-16, and where elevator status comes from (an official Metro source would be better).

## Consequences

- Right now (feed frozen) every Metro verdict is `unknown` and `/v1/status` says `stale`. That is
  correct behaviour, but it means the product can't launch on this source as it stands.
- Changing the threshold is configuration, not code.
