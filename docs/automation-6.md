# Automation 6: Autonomous Operations and Automation Infrastructure

## Inventory (2026-08-22)

The repository began empty. It had no Git remote, GitHub Actions workflows, Cloudflare/Wrangler configuration, package manifest, deployment scripts, credentials, or monitoring components to reuse. The initial baseline commit contains only `README.md` and `.gitignore`. Automation 6 adds a read-only Actions workflow, but it remains local and inactive until a remote is deliberately configured and the branch is published.

## Safety model

- Read-only HTTP `GET`/`HEAD` monitoring is the default; no authenticated targets are in the example.
- Build and regression commands use an executable plus argument array with `shell: false`; configuration cannot enable a shell.
- Response bodies, link counts, command output, and execution time are bounded.
- Safe local and feature-branch infrastructure is autonomous. `config/permission-policy.json` is the shared coordination contract for Automations 1, 5, and 6.
- Only material production actions listed in that contract become approval items. Missing optional local capabilities are recorded as `skipped`, not approvals.
- Generated evidence is ignored by Git and contains no request/response headers or environment-variable values.

## Reporting contract

`schemas/report-v1.schema.json` is the stable ingestion contract. Every report and JSONL event includes `schemaVersion: 1.0.0`; incompatible changes require a new schema version. Reports contain run timing, aggregate status, per-check evidence, and approval items. This is the boundary intended for future Management Hub ingestion.

Each run atomically updates `artifacts/hub/runs-v1.json`, a bounded, deduplicated index described by `schemas/hub-runs-v1.schema.json`. `config/orchestration.json` registers Automation 6 and reserves disabled entries for Automations 1 and 5 so their status sources can be connected without changing the coordination contract.

## Check types

- `health`: final URL, HTTP status, and content type.
- `seo`: title, meta description, canonical URL, and missing-field warnings. AdSense-specific policy/account checks remain an approval-gated future adapter because they require account context.
- `links`: up to 50 discovered HTTP(S) links probed with `HEAD`, with failures recorded.
- command checks: explicitly configured local build, test, or E2E executables with captured output and exit status.
- screenshots: durable request records for a future approved Playwright/browser renderer; no browser is downloaded implicitly.

## Scheduling and integrations

The CLI is scheduler-neutral so Windows Task Scheduler, GitHub Actions, or a Management Hub worker can invoke it later. `.github/workflows/automation-6.yml` defines a Monday 03:17 UTC read-only run and manual trigger with `contents: read`; it cannot run until the repository is intentionally connected and published. Cloudflare support should be added as an adapter only after account/environment ownership is known; no Wrangler configuration or Worker is created speculatively.

All GitHub, Railway, Cloudflare, URL, workflow, monitoring, storage, logging, and Hub destinations are external configuration. `config/connections.example.json` contains disabled templates and environment-variable names only. `src/connections-cli.mjs` validates and reports readiness without contacting live services; `docs/connections-required.md` tracks verified discovery, gaps, and exact activation steps.

Discovered systems remain `candidate` entries in `config/target-inventory.json`; target-selection validation refuses them until their state is explicitly changed to `approved`. `config/capability-map.json` describes the reusable handoff surface for Automations 1, 2, 5, and 6. Schedule, retention, and approval-routing contracts are separately versioned and validated by `src/policy-cli.mjs`; retention is dry-run by default and restricted to generated local artifact roots.

## Visual verification gate

`schemas/visual-verification-v1.schema.json` defines a per-page matrix containing the expected approved state, actual state, pass/fail result, issue, fix, screenshot/reference, capture time, and retest result for every item. Every matrix is explicitly classified as `test-fixture` or `live-site`; fixture passes prove only that the gate works and can never authorize a baseline. A baseline approval item is created only for `live-site` evidence when every required item has a captured screenshot/reference, both an initial and retest pass, and no item has a known issue or failure. The matrix must keep `baselineUpdatesEnabled` set to `false`; the CLI never writes a baseline and routes an eligible update as a pending Management Hub approval instead.

Live capture timestamps must also fall within the matrix's bounded `maxEvidenceAgeHours` window and cannot be in the future. Producers start from `config/visual-matrix.live.template.json`, which is intentionally blocked until real evidence is supplied; detailed handoff steps are in `docs/visual-evidence-producer-guide.md`.

## Deployed versus branch comparison

`config/deployed-branch-comparison.example.json` defines approved production/branch-preview pairs and identical desktop/mobile viewports. Capture is disabled by default and refuses unapproved pages. When activated for an approved preview, the comparator captures both versions, calculates a pixel difference overlay and side-by-side image, and compares headings, text/word count, images, FAQs, examples, use cases, informational sections, internal links, and major components. Completely unchanged comparisons are suppressed and their temporary captures removed, so the review report contains only actual differences. Changed comparisons are divided into configurable, bounded owner-review batches. This remains read-only and never deploys or updates a baseline.

`config/saas-verification-contract.json` defines the six verified Raven Sharp products and the mandatory visual, functional, legal, backend, and billing surfaces. Backend health and Stripe test URLs remain configurable until discovered. Each capability advertised on public or pricing pages must map to a passing test and retained evidence. Public pricing must match Stripe read-only/test data for tier name, amount, currency, billing interval, trial, included features or limits, and checkout destination. End-to-end checks must exercise API calls, core workflows, preview/rendering, output, save-and-reload persistence, and storage read/write using safe test data. A visual pass can never override any claim or functional failure; any mismatch returns to development and requires new passing evidence. Billing verification never completes a live charge.

Product-specific checks extend the common contract. POD currently requires product-preview generation, image-output quality, provider-migration readiness, persistence, and webhook evidence. The possible replacement provider is deliberately recorded as unconfirmed until the owner verifies it; credentials are always runtime environment references and never stored in configuration.
