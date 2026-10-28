# 1. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

The hackathon prototype kept its decisions in `AGENTS.md` and commit messages. That worked for a
weekend, but in a project that will be maintained for years, the _why_ behind a choice gets lost
and gets re-argued.

## Decision

Every significant architectural or product decision gets a short record in `docs/adr/`, numbered
in order, using the format: Status · Context · Decision · Consequences. ADRs are never edited to
change their meaning; a new ADR supersedes an old one and links back to it.

## Consequences

- New contributors (and AI agents) can learn why the system looks the way it does without asking.
- Changing direction is fine, but it takes one written page, which keeps changes deliberate.
