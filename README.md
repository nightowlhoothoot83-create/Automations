# Automations

Safe, local-first automation infrastructure. Individual automations are developed on feature branches and must not deploy or mutate production by default.

## Automation 6: operations infrastructure

Automation 6 runs read-only health, SEO, link, repository, build, and regression checks and writes machine-readable evidence for a future Management Hub. It never deploys and never requires secrets for its example configuration.

```powershell
Copy-Item config/targets.example.json config/targets.local.json
node src/cli.mjs --config config/targets.local.json
node src/orchestrate.mjs
node --test
```

Generated runs are stored under `artifacts/runs/<run-id>/` with a `report.json`, `events.jsonl`, and screenshot request records. See [docs/automation-6.md](docs/automation-6.md) for the safety model and integration contract.
