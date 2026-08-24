# Automation 5: Ascension Digital Management Hub

## MVP outcome

The hub is a local-first owner dashboard for immediate operational triage. It highlights the next approval and highest-priority failed or warning result before showing portfolio health, run totals, test evidence, activity, and expandable operational modules.

## Contract ownership

Automation 6 owns `schemas/report-v1.schema.json` and `schemas/hub-runs-v1.schema.json`. Automation 5 reads those version `1.0.0` artifacts directly and preserves each result's opaque `evidence` object. It does not change either schema or infer a competing worker result shape. Unsupported versions fail visibly.

The hub API response is a presentation view, not a worker reporting contract. Manual approval decisions are stored locally in ignored `data/hub/decisions.json`. Recording a decision does not execute a merge, deployment, DNS change, secret change, or other production mutation.

## Modular source adapters

`schemas/hub-source-v1.schema.json` defines a small Automation 5-owned envelope for content, assets, finance, repairs, and approval queues. `config/hub-sources.example.json` configures JSON-file adapters; real integrations can replace paths using `HUB_SOURCES_CONFIG` without changing the UI. Every envelope must declare `mode: live` or `mode: fixture`, and the dashboard exposes that provenance.

The checked-in `fixtures/hub/` records make each module testable without credentials or external mutations. A broken adapter degrades independently and produces a visible source warning instead of taking down Automation 6 monitoring evidence.

## Worker results and durable history

`config/hub-workers.example.json` registers Automation 6 as a live hub-index reader and Automation 2 as an unmistakable fixture report. Both declare `automation-6/report-v1@1.0.0`; this reuses Automation 6's schema ownership rather than creating a competing result shape. Override the registry with `HUB_WORKERS_CONFIG`. Missing indexes and incompatible results degrade into dashboard warnings.

Owner decisions append v1 events to ignored `data/hub/activity-v1.jsonl` and update the local current-state index. The dashboard shows event ID, actor, timestamp, decision, and provenance. Malformed journal lines are skipped with visible warnings, preserving valid history. `HUB_HISTORY_PATH` supports isolated local testing and future storage adapters.

History export produces a portable `ascension-hub-history-export` v1 bundle. Import validates every event, preserves original IDs and provenance, and skips duplicates. Retention never silently discards history: older records are written to ignored `data/hub/archives/` before the active JSONL journal is compacted. `HUB_HISTORY_ARCHIVE_DIR` supports isolated storage.

The worker drill-down API (`/api/workers/:id/runs`) follows the configured adapter: report-file sources expose one run, while Automation 6 hub indexes expose every retained run and its unchanged evidence. Missing artifacts return an explicit degraded state. No drill-down action invokes a worker or live system.

## Automation 1 snapshot integration

Automation 1's committed Raven Sharp audit predates the worker report contract and is intentionally ingested through `hub-evidence-snapshot-v1`, not converted into a live Automation 6 run. The checked-in snapshot cites source commit `d5ed6f2d891c3bdab378623030f7786bfdee689f`, capture time, per-product coverage, caveats, and its non-production test-tenant approval need. The dashboard always labels these conclusions `snapshot` and separately states whether canonical Automation 6 live evidence is available.

`config/hub-evidence.example.json` configures snapshot-file adapters and `HUB_EVIDENCE_CONFIG` supports alternative local registries. Missing or invalid snapshots degrade independently. No Automation 1 code, Raven Sharp product repository, AdSense repository, or live site is read or modified at runtime.

## Current boundaries and decision points

- When `artifacts/hub/runs-v1.json` is absent, the dashboard enters a prominent demonstration mode. Sample data is never represented as a live run.
- Content, assets, finance, expenses, income, tax, repair, preview, and approval seams now have fixture-backed file adapters. Real provider adapters still require source ownership and credentials.
- Preview and branch-ready repair metadata remain separate from Automation 6 evidence and carry explicit adapter provenance.
- Production hosting, authentication, deployment execution, and external account connections require explicit user decisions. The current server binds only to `127.0.0.1`.
