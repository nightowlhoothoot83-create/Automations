# Automation 1–6 coverage audit

This is the owner-facing source of truth for the original Automation 1–6 workstreams. The goal is to keep useful capability while avoiding duplicate jobs and duplicate schedules.

## Automation 1 — Raven Sharp SaaS QA

**Original role:** read-only Raven Sharp SaaS audit, smoke checks, visual evidence handoff, and guarded repair evidence.

**Current coverage:** consolidated into the Ascension Automation Hub plus ADG SaaS monitor. The Hub exposes safe manual tests for all six SaaS products: POD Suite, Image Optimiser & Upscaler, Ad Manager, Book Creator, Content Creator, and Smart Cleaner. The SaaS maintainer remains branch-only and review-gated for repair work. Production deployment is a separate approval-gated action.

**Status:** covered. Do not create a second Automation 1 scheduler.

## Automation 2 — final review/content checks

**Original evidence found:** no standalone Automation 2 branch or production workflow exists. The Management Hub carried only a fixture labelled `Final review checks`, with draft generation and owner-review evidence.

**Current coverage:** consolidated rather than duplicated. Draft marketing/content preparation is handled by the Marketing Pack Worker and related guarded content tools. Final owner review is handled by the Hub's Review queue and the Check → Test → Preview → Review → Deploy release lane.

**Status:** covered by consolidation. The old fixture must never be represented as a live worker.

## Automation 3 — safe asset inventory

**Original role:** inventory an explicitly supplied directory, record provenance, classify likely use, and identify exact duplicates using SHA-256 and byte size. It never moves, renames, overwrites or deletes originals.

**Current coverage:** retained as a source-scoped utility on `Automations/codex/automation-3-asset-inventory`. It is intentionally not scheduled from GitHub because a GitHub runner does not have the owner's local or cloud asset directory by default. The Hub's Assets & Previews area is the review destination once a real asset source is connected.

**Status:** ready, source-dependent. No automatic schedule should be created until the source directory/provider is explicitly connected.

## Automation 4 — asset-to-product preparation

**Original role:** consume an Automation 3 inventory and produce a `READY`, `NEEDS WORK`, or `BLOCKED` product queue while preserving master provenance. It never publishes, spends, orders, mutates accounts, or overwrites masters.

**Current coverage:** retained as a preparation utility on `Automations/codex/automation-4-product-pipeline`. It must run only after Automation 3 has produced a real inventory. Store Ops, POD Suite and marketplace agents then remain the separate owner-reviewed execution surfaces.

**Status:** ready, dependent on Automation 3 input. No independent recurring schedule is required.

## Automation 5 — Ascension Digital Management Hub

**Original role:** owner dashboard and management surface.

**Current coverage:** this repository is now the active implementation. It includes live GitHub status, safe Run now controls, grouped operations, owner-friendly schedule presentation, D1-backed action/schedule state, screenshot-first review, and the server-enforced Check → Test → Preview → Review → Deploy release gate.

**Status:** active implementation, awaiting bootstrap merge/deploy and Cloudflare runtime wiring.

## Automation 6 — monitoring and operations infrastructure

**Original role:** read-only health, SEO, link, repository, build, connection-readiness, retention, visual-gate and regression checks with structured evidence.

**Current coverage:** retained as the single scheduled monitoring layer. Its native weekly workflow remains the source of truth for this infrastructure run. Other existing monitors keep their own native schedules, and the Hub prevents duplicate schedule takeover.

**Status:** active. Do not duplicate its schedule.

## Final consolidation rule

The numbered automations are now capability groups, not six independent cron jobs. Automation 1 and 2 are represented by the newer SaaS/marketing/review controls; Automation 3 and 4 are input-driven utilities; Automation 5 is the Hub; Automation 6 is the scheduled monitoring infrastructure. Production-changing actions remain manual and owner-approved.

## Remaining bootstrap work before calling the system live

1. Merge and bootstrap-deploy the Hub PR only after owner approval.
2. Apply the documented D1 migrations and `HUB_DB` binding.
3. Configure the Hub runtime GitHub read/control token, scheduler key, owner/Access protection, Cloudflare account details, and optional Store Ops URL as documented in `docs/live-control-setup.md`.
4. Run the Hub release Check → Test → Preview stages, review desktop/mobile screenshots, then obtain explicit owner approval before production deploy.
5. After deployment, verify all six SaaS Run tests controls, the AdSense/site monitors, Store Ops link, marketing/review controls, and Automation 6 status from the live Hub.

No new production mutation, publishing, ad spend, baseline reset, or automatic repair permission is implied by this audit.
