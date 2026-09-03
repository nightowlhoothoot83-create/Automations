# Automations

Safe, local-first automation infrastructure. Individual automations are developed on feature branches and must not deploy or mutate production by default.

Automation 1's initial Raven Sharp SaaS audit, repeatable read-only smoke checks, and Automation 6 visual-test handoff are in `automation-1/` and `docs/automation-1-initial-audit.md`.

Running `node automation-1/smoke.mjs` writes both the original Automation 1 snapshot and an Automation 6 `report-v1` compatible review package. The compatible report remains a warning until credentialed workflow coverage is explicitly authorized and completed.
