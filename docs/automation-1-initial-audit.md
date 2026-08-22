# Automation 1 initial Raven Sharp SaaS audit

Date: 22 August 2026 (Australia/Brisbane)

## Scope and safety

Read-only production checks and local repository builds were run for Image Optimiser & Upscaler, POD, Ad Manager, Book Creator, Content Creator, Smart Cleaner web SaaS, and the Raven Sharp hub. Smart Cleaner app was not inspected or modified. No production writes, registrations, checkout starts, paid generations, provider changes, deployments, or credential reads were performed. No shared visual component was changed.

## Results

| Product | Outcome | Evidence |
|---|---|---|
| Image Optimiser & Upscaler | Pass with coverage warning | Production build passes; API root and detailed health return 200 JSON; MongoDB, Runware, and Stripe report healthy; unauthenticated `/api/auth/me` returns 401. Paid generation, download, and owner session remain unproved. |
| POD suite | Pass with expected blocker | Production build passes; API root, root health, and detailed health return 200 JSON; unauthenticated auth gate returns 401. Detailed health reports Gemini `not_configured` while Runware, Claude, Stripe, MongoDB, and R2 are healthy. The missing Print-on-Demand Railway/platform credential remains an expected blocker for provider publishing; no key was requested or changed. |
| Ad Manager | Pass with documentation warning | Four repository smoke tests pass; backend compiles; `/api/health` returns 200 JSON; auth gate returns 401. README claims auth/webhooks are unimplemented although source and smoke tests show both route families, so deployment documentation is stale. |
| Book Creator | Pass with coverage warning | Backend compiles; API root returns 200 JSON; auth gate returns 401; public page renders without captured console errors or desktop overflow. Authenticated creation, generation, export, download, and video handoff remain unproved. |
| Content Creator | Pass with naming warning | Backend compiles; API root returns 200 JSON; auth gate returns 401; public page renders without captured console errors or desktop overflow. API identifies itself as `Raven Sharp Video Creator API`, inconsistent with the current Content Creator product name. Authenticated generation/download remains unproved. |
| Smart Cleaner web SaaS | Pass as marketing web surface | Public page returns 200 and renders without captured console errors or desktop overflow. Repository contains a static marketing/demo surface, not a functional connected-drive cleaner backend. Smart Cleaner app was kept out of scope. |
| RavenSharp.com hub | Warning | HTTP probe returns 200 with Raven Sharp content. The in-app browser twice returned `ERR_NAME_NOT_RESOLVED`, while the same machine's direct HTTPS request succeeded; treat as a browser/runtime DNS warning until reproduced externally. |

## Build and test evidence

- `npm run build` succeeds for Image Optimiser & Upscaler.
- `npm run build` succeeds for POD.
- `python -m compileall` succeeds for all five Python backend directories.
- `python -m unittest discover -s tests -v` passes all four Ad Manager smoke tests.
- Live desktop screenshots were captured under the ignored `artifacts/automation-1/live/` directory for the six product pages that rendered. Hub capture failed at the browser DNS boundary.

## Safe repair delivered

`automation-1/smoke.mjs` adds repeatable, credential-free health-contract and auth-boundary checks. Unlike a status-only monitor, it rejects a misleading 200 HTML SPA fallback when JSON health is expected. `automation-1/visual-checks.json` is the handoff contract for Automation 6; Automation 6 source/reporting infrastructure was not edited.

## Approval or authenticated fixture needed

To prove owner access, forms, real generation, workflow persistence, downloads, Stripe checkout boundaries, and provider publishing, Automation 1 needs a dedicated non-production test account/tenant and explicit approval for any operation that consumes credits or creates external platform drafts. No provider/model change is recommended from current evidence. If Gemini is desired as POD fallback, compare it against the healthy current Runware/Claude path for cost, quality, latency, and data handling before configuration; do not enable it without approval.
