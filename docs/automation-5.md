# Automation 5: Ascension Digital Management Hub

## MVP outcome

The hub is a local-first owner dashboard for immediate operational triage. It highlights the next approval and highest-priority failed or warning result before showing portfolio health, run totals, test evidence, activity, and expandable operational modules.

## Contract ownership

Automation 6 owns `schemas/report-v1.schema.json` and `schemas/hub-runs-v1.schema.json`. Automation 5 reads those version `1.0.0` artifacts directly and preserves each result's opaque `evidence` object. It does not change either schema or infer a competing worker result shape. Unsupported versions fail visibly.

The hub API response is a presentation view, not a worker reporting contract. Manual approval decisions are stored locally in ignored `data/hub/decisions.json`. Recording a decision does not execute a merge, deployment, DNS change, secret change, or other production mutation.

## Modular source adapters

`schemas/hub-source-v1.schema.json` defines a small Automation 5-owned envelope for content, assets, finance, repairs, and approval queues. `config/hub-sources.example.json` configures JSON-file adapters; real integrations can replace paths using `HUB_SOURCES_CONFIG` without changing the UI. Every envelope must declare `mode: live` or `mode: fixture`, and the dashboard exposes that provenance.

The checked-in `fixtures/hub/` records make each module testable without credentials or external mutations. A broken adapter degrades independently and produces a visible source warning instead of taking down Automation 6 monitoring evidence.

## Current boundaries and decision points

- When `artifacts/hub/runs-v1.json` is absent, the dashboard enters a prominent demonstration mode. Sample data is never represented as a live run.
- Content, assets, finance, expenses, income, tax, repair, preview, and approval seams now have fixture-backed file adapters. Real provider adapters still require source ownership and credentials.
- Preview and branch-ready repair metadata remain separate from Automation 6 evidence and carry explicit adapter provenance.
- Production hosting, authentication, deployment execution, and external account connections require explicit user decisions. The current server binds only to `127.0.0.1`.
