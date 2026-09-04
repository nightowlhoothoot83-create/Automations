# Ascension Automation Hub: one-time live wiring

The Hub is designed to be the owner's normal control surface. GitHub Actions, D1 and Cloudflare stay underneath it.

## Cloudflare Pages project

Project: `ascension-automation-hub`

Required D1 binding:

- Variable name: `HUB_DB`
- Database: `ascension-automation-hub`
- Apply migrations in order: `0001_hub_history.sql`, `0002_automation_controls.sql`, `0003_release_evidence.sql`

Protect the Pages project with Cloudflare Access before enabling write controls.

## Pages secrets / variables

Secrets:

- `GITHUB_CONTROL_TOKEN` — a GitHub token that can read workflow state and dispatch only the workflows the Hub controls.
- `HUB_SCHEDULER_KEY` — a long random value used only for Hub-to-Hub scheduler/release evidence callbacks.
- `HUB_OWNER_CONTROL_KEY` — optional fallback owner key if Cloudflare Access email protection is not being used.

Variables:

- `HUB_OWNER_EMAIL` — preferred owner authorization when Cloudflare Access is enabled.
- `HUB_RELEASE_REF` — normally `main` after the Hub branch is approved and merged.
- `STORE_OPS_URL` — optional live Raven Sharp Store Ops Worker URL so the Hub can open it directly.

`GITHUB_READ_TOKEN` is optional when `GITHUB_CONTROL_TOKEN` is present because the control token is also used for status reads.

## GitHub repository secrets / variables

Repository secrets for `ascension-automation-hub`:

- `MANAGEMENT_HUB` — the Cloudflare API token created specifically for this Hub.
- `CLOUDFLARE_ACCOUNT_ID`
- `HUB_SCHEDULER_KEY` — the same value as the Pages secret above.

Optional repository variables:

- `HUB_EVIDENCE_URL` — defaults to `https://ascension-automation-hub.pages.dev/api/release-evidence`.
- `HUB_SCHEDULER_URL` — defaults to `https://ascension-automation-hub.pages.dev/api/scheduler`.

## Safety behavior

The generic **Run now** control can dispatch only entries marked `safeRun`. Production deployments, SaaS repair agents, marketplace publishing work and other higher-risk jobs cannot use that generic route.

The Hub release lane is enforced server-side:

`Check → Test → Preview → Review → Deploy`

Preview captures desktop and mobile screenshots. Review approval is tied to the exact Git commit SHA. Deploy is refused unless Check, Test and Preview have passed, both screenshots exist, and the owner approved that exact preview.

Existing workflows that already have their own GitHub cron are shown as GitHub-managed schedules. The Hub deliberately refuses to take over those schedules until their native cron is retired, preventing accidental duplicate runs.

## Bootstrap note

The new release-control API and screenshot evidence callback cannot control the live Pages project until this branch has first been reviewed, merged and deployed once through the existing guarded deployment process. After that bootstrap deployment, future Hub releases can use the guided lane from the Hub itself.
