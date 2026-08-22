# Automation 6: Autonomous Operations and Automation Infrastructure

## Inventory (2026-08-22)

The repository began empty. It had no Git remote, GitHub Actions workflows, Cloudflare/Wrangler configuration, package manifest, deployment scripts, credentials, or monitoring components to reuse. The initial baseline commit contains only `README.md` and `.gitignore`. Automation 6 adds a read-only Actions workflow, but it remains local and inactive until a remote is deliberately configured and the branch is published.

## Safety model

- Read-only HTTP `GET`/`HEAD` monitoring is the default; no authenticated targets are in the example.
- Build and regression commands use an executable plus argument array with `shell: false`; configuration cannot enable a shell.
- Response bodies, link counts, command output, and execution time are bounded.
- Deployment, remediation, repository writes, credential use, and browser installation are outside the runner.
- A requested action that needs extra authority becomes a pending approval item instead of being executed.
- Generated evidence is ignored by Git and contains no request/response headers or environment-variable values.

## Reporting contract

`schemas/report-v1.schema.json` is the stable ingestion contract. Every report and JSONL event includes `schemaVersion: 1.0.0`; incompatible changes require a new schema version. Reports contain run timing, aggregate status, per-check evidence, and approval items. This is the boundary intended for future Management Hub ingestion.

## Check types

- `health`: final URL, HTTP status, and content type.
- `seo`: title, meta description, canonical URL, and missing-field warnings. AdSense-specific policy/account checks remain an approval-gated future adapter because they require account context.
- `links`: up to 50 discovered HTTP(S) links probed with `HEAD`, with failures recorded.
- command checks: explicitly configured local build, test, or E2E executables with captured output and exit status.
- screenshots: durable request records for a future approved Playwright/browser renderer; no browser is downloaded implicitly.

## Scheduling and integrations

The CLI is scheduler-neutral so Windows Task Scheduler, GitHub Actions, or a Management Hub worker can invoke it later. `.github/workflows/automation-6.yml` defines a Monday 03:17 UTC read-only run and manual trigger with `contents: read`; it cannot run until the repository is intentionally connected and published. Cloudflare support should be added as an adapter only after account/environment ownership is known; no Wrangler configuration or Worker is created speculatively.
