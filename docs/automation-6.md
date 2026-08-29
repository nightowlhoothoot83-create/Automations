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

Product-specific checks extend the common contract. POD currently requires product-preview generation, image-output quality, provider-migration readiness, persistence, and webhook evidence. The owner selected fal.ai FLUX.1 Schnell (`fal-ai/flux-1/schnell`) through `@fal-ai/client` for both artwork and preview generation, replacing Runway where suitable; its credential is referenced only as `FAL_KEY`. Claude Vision remains unchanged as the provider that analyses image suitability for the selected POD product. Generated artwork must still pass the separate product-template-driven print pipeline: correct pixel dimensions for the chosen product and print size, 300 DPI target, suitable PNG/JPEG format, sRGB unless the provider specifies otherwise, transparency where needed, bleed and safe-area validation, and rejection of low-resolution or visibly artifacted output. DPI metadata alone is not accepted because adequate pixel dimensions determine printable resolution.

`config/pod-provider-ab-test.example.json` defines the provider migration benchmark. It is disabled until both credentials and the current Runware model are confirmed. The same prompts, product templates, target sizes, and sample counts are used for each provider. Owner review receives the prompt plus the actual labelled Runware and FLUX outputs side by side in batches; Claude Vision scoring is supplemental rather than a substitute for seeing the images. Cost, latency, and failure rate are also retained. No provider switch occurs until print-readiness and owner review pass.

`config/pod-production-contract.json` defines the branch-only production and entitlement handoff. Fixed-price tiers use one flexible credit balance: exploratory generation, premium generation, analysis, background work, upscaling, storage and provider operations all consume credits based on expected cost and a configurable gross-margin target. Product dimensions come from a versioned provider capability manifest. One approved master is upscaled to the largest selected requirement and smaller outputs are derived without redesign or duplicate processing charges. A mockup must reference the binary-identical final artwork; complete evidence can only create a pending owner approval and never auto-approve a draft, provider switch, price, baseline or deployment.

`config/automation-recovery.json` records the current coordination boundary. Automation 2 is frozen while its AdSense sites are tested outside Codex. Automations 3 and 4 remain disabled because no verified local branches or original scope contracts were found in the integrated inventory. The recovery validator refuses invented commands, schedules or targets until their objective, owner, permission contract, schema, fixtures and status source are verified.

POD production preflights publish `schemas/pod-production-run-v1.schema.json` records for the Management Hub. The summary exposes selected products, largest required master dimensions, estimated credits and missing-evidence count. The detailed evidence remains attached, and a complete run is still `pending-owner-approval`; there is no approved state in this contract.

Run `npm run pod:preflight:fixture` to exercise the complete POD planning path without network access, credentials, paid generation or live provider calls. The fixture intentionally omits the final-artwork hash and provider upload acceptance, so the resulting Hub record is blocked and demonstrates the evidence gate rather than simulating a production pass.

`config/pod-monitoring-policy.json` adds read-only drift monitoring for provider capability versions, evidence age, provider costs, credit estimates, upload acceptance and mockup artwork identity. The schedule remains definition-only and disabled. Any drift or stale/missing evidence blocks approval and requires a new preflight; a clean monitoring result remains pending owner approval rather than becoming an automatic pass.

The disabled `pod-preflight-drift-template` schedule documents the intended recurring check without enabling it. Local POD preflight evidence has a separate bounded retention class of 90 days or 200 items; retention remains dry-run unless explicitly executed and is confined to the local artifact root.

`config/integration-reconciliation.json` records the verified branch heads and their evidence provenance without merging them. The current integrated branch is explicitly blocked because it enables frozen Automation 2 and predates the latest Automation 6 safety work. Automation 1's passing deterministic tests and repository evidence remain snapshots, not claims of a fresh live-site pass. Management Hub sources must continue to label themselves as live or fixture, and Automations 3 and 4 remain guarded until their original contracts are verified.

`config/hub-contract-registry.json` is the non-mutating Automation 5 handoff. It keeps ordinary Automation 6 reports, POD preflight runs and Automation 1 smoke snapshots as separate source contracts with separate status vocabularies. Hub adapters may map display fields but must retain original evidence, show provenance, reject unknown schemas visibly and never map a POD pending approval or Automation 1 snapshot pass into a live pass.

`config/adsense-production-authority.json` supersedes stale Automation 2 repair instructions without editing an AdSense repository. Current production mains are authoritative. WheelNamePicker must retain repair commit `e3e99b193223c402b86b871a9af1966b54927386` or newer, and ADG-MONITOR-V4 must retain fix commit `bcbf694cd43eecad529751e1f378c9bbbc4476d6` or newer. Every future repair must fetch and compare current main, preserve newer commits, remain additive and focused, and stop when the hardened live audit is fully green. Baseline mutation remains explicitly forbidden.

`config/pod-provider-capabilities.json` restores the five-provider architecture without pretending the providers share one ingestion model. Printify uses direct API product creation; Gelato requires a validated pre-existing product template and keeps product pre-publication separate from draft orders; Redbubble uses a bulk-upload/import adapter; Merch by Amazon uses a feed/export adapter; and Printful remains blocked until its exact current contract is verified. Provider selection is always explicit, missing identifiers remain blocked, and publishing/account mutation are unavailable in the local planning interface.
