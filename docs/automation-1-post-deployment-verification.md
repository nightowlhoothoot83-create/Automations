# Automation 1 post-deployment verification runbook

Use this runbook only after the owner has approved and completed deployment through the normal product workflow. It does not authorise a deployment, production write, credential use, visual-baseline update, authenticated workflow, paid generation, checkout, provider call, or Smart Cleaner app change.

## Preconditions

- Record the deployed product commit and deployment identifier.
- Confirm the target is the Smart Cleaner **web SaaS**, Content Creator, or Ad Manager repository—not the separate Smart Cleaner app or an AdSense site.
- Keep the previous known-good deployment available for rollback.
- Run Automation 1 from `codex/automation-1-raven-sharp-qa` with no credentials in commands or artifacts.

## Shared credential-free smoke gate

Run:

```text
node --test automation-1/smoke.test.mjs
node automation-1/smoke.mjs
```

Expected: 4/4 deterministic tests and 12/12 deployed probes pass. Each API response must retain its declared JSON media type; public pages must retain HTML media type. Auth boundaries must continue returning the expected unauthenticated 401 response. Archive the generated `artifacts/automation-1/smoke.json` with the deployment evidence.

Rollback signal: any new failed probe, HTML fallback from an API URL, unexpected redirect/domain, 5xx response, or auth boundary returning success without authentication. Do not roll back automatically; stop, preserve evidence, and request owner approval through the product deployment workflow.

## Smart Cleaner web SaaS — `767ca0e`

Target: `https://cleaner.raven-sharp.com/app`.

1. Fetch `/app` without cookies and confirm HTTP 200 with `text/html`.
2. Confirm the returned document contains the `.rs-persistent-top` and `.rs-persistent-logo` CSS rules and constrains the persistent logo to 44×44px.
3. Capture fresh screenshots at 1280×720 and 390×844. Do not reuse pre-deployment images.
4. At both widths, verify the top-left Raven Sharp mark and `SMART CLEANER` name, shared shell/navigation/footer and ADG branding, approved typography/spacing, and no black/white square logo background.
5. Verify `document.documentElement.scrollWidth <= document.documentElement.clientWidth`, the logo's computed size is 44×44px, the primary auth/workspace composition remains visible, and the console contains no new errors.

Rollback signals: intrinsic-size logo reappears, horizontal overflow, missing product identity, shell/footer loss, broken auth/workspace composition, new console exception, or HTTP/resource failure. The separate Smart Cleaner app is never a fallback target and must not be modified.

Baseline gate: screenshots may be recorded as post-deployment evidence, but the visual baseline must remain unlocked until the owner reviews the fresh desktop/mobile result and explicitly approves the baseline update.

## Content Creator — `e071085`

Target: `https://content.raven-sharp.com/api/` plus the public and studio-entry pages already listed in `automation-1/visual-checks.json`.

1. Fetch `/api/` without credentials and confirm HTTP 200, `application/json`, `status: "ok"`, and exact service name `Raven Sharp Content Creator API`.
2. Confirm `/api/auth/me` still returns HTTP 401 JSON containing `Not authenticated`.
3. Run the product branch's deterministic tests and backend syntax check: `python -m unittest discover -s tests -v` and `python -m compileall -q backend`.
4. Capture fresh public and studio-entry screenshots at 1280×720 and 390×844. Verify the top-left Raven Sharp / `CONTENT CREATOR` lockup, centred mark, shared navigation/footer and ADG branding, responsive layout, zero overflow, and no new console errors.

Rollback signals: old `Video Creator API` identity remains or returns after deployment, non-JSON API fallback, new 5xx, auth gate regression, missing Content Creator header identity, overflow, or new console error.

Password-reset email delivery is not part of this credential-free gate. Testing it requires an approved non-production account and approval for the external email action.

## Ad Manager documentation — `c5002d4`

This commit changes repository documentation and its deterministic regression test; it does not require a production deployment to alter runtime behaviour.

1. On the reviewed product commit, run `python -m unittest discover -s tests -v` and `python -m compileall -q backend`.
2. Expected: 5/5 tests pass, including the README architecture assertion.
3. Confirm README configuration names still match `backend/.env.example` and source: FastAPI, MongoDB, stable `JWT_SECRET`, `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, optional R2, and optional Anthropic configuration.
4. If the documentation commit is included in a runtime deployment, rerun the shared Automation 1 smoke gate and confirm `/api/health` is HTTP 200 JSON while `/api/auth/me` remains HTTP 401 JSON.

Rollback signals: documentation again describes Express/in-memory storage, required variables contradict current source, deterministic tests fail, or the coincident deployment changes runtime health/auth behaviour. Documentation rollback does not authorise changing credentials or providers.

## Evidence and approval handoff

For each product, record: deployed commit, deployment identifier/time, test command and result, HTTP status/media type/body marker, screenshot paths where applicable, console and overflow result, pass/fail, rollback recommendation, and unresolved approval items.

Stop and request owner direction for any deployment/rollback, credential or test-account use, baseline update, paid checkout/generation, provider call/change, or material business decision. A credential/provider blocker in one product does not block independent read-only verification elsewhere.
