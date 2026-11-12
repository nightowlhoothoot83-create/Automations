# Weekly monitor dependency repair

Validated 12 November 2026. Canonical repair: PR 1, `codex/repair-monitor-dependency-install-20261012`. PR 3 duplicates the dependency fix and is superseded; retain both branches/history.

The latest scheduled failure, run 42611307856 on 9 November, stopped at `node --test` with `ERR_MODULE_NOT_FOUND: Cannot find package 'pngjs'`. The dependency was declared and locked, but the original workflow never installed packages.

The repaired workflow installs locked production and development dependencies with scripts disabled before tests. It also validates PRs against the existing default branch. PR validation skips the external example-site check; no new production schedule is added and no paid provider is invoked.

Local validation:

- `npm ci --include=dev --ignore-scripts --fetch-retries=0 --fetch-timeout=15000 --no-audit --no-fund`: passed, 8 packages installed.
- `npm run check`: 49 passed, 0 failed.
- `node src/orchestrate.mjs`: passed in dry-run mode.
- `node src/connections-cli.mjs`: passed with disabled real providers and a mock development adapter; not proof real credentials work.
- `node src/policy-cli.mjs`: passed schedule validation and retention dry-run; no deletion.
- `node src/deployed-branch-compare-cli.mjs`: passed in disabled dry-run mode; no live capture.

No scheduled run was retriggered, no production deployment occurred, and no API/generation credits were used. Local validation does not prove the future scheduled run succeeds in GitHub. In addition, the scheduled command still reads `config/targets.example.json` (example.com), so this infrastructure job is not evidence of coverage of all actual ADG sites. Real targets/connections require a separate reviewed configuration step; existing ADG Cloudflare monitors must not be duplicated.
