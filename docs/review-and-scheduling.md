# Review and scheduling contract

The Ascension Automation Hub is the owner-facing control plane. Every production-capable automation must expose a clear evidence trail before the owner can deploy or publish.

## Review path

The default production path is:

**Check → Test → Preview → Review → Deploy**

The Review step must surface, when applicable:

- concise result summary
- test results and failed checks
- desktop and mobile screenshots
- before/after screenshots for visual, layout, or branding changes when available
- preview URL
- logs and failure reason
- exact files/changes or proposed scope
- approval history and who approved it

Visual changes cannot be treated as visually verified from source checks alone. They require screenshot or live-browser evidence. Fixture/demo evidence must remain clearly labelled and cannot unlock production approval.

## Scheduling controls

Automations that benefit from recurring execution should expose all four controls in the Hub:

- **Run now**
- **Schedule** with only sensible cadences for that automation
- **Pause / resume**
- visible **Last run** and **Next run** timestamps

Heavy repair, deployment, publishing, spend-changing, destructive, and account-mutating actions default to manual even when their monitoring stage is scheduled.

Recommended defaults:

| Area | Default |
| --- | --- |
| Site & AdSense health | every 6 hours |
| SaaS lightweight health | daily / rotating |
| SaaS repair agent | manual, usually launched from a failed health check |
| Store/listing preparation | manual or scheduled batch |
| Publishing listings | manual approval |
| Marketing generation | manual or scheduled batch |
| Marketing publishing / spend | manual approval |
| Automation infrastructure health | weekly |

The Hub should eventually translate these owner choices to the underlying Cloudflare cron or GitHub Actions schedule without requiring the owner to edit YAML or cron expressions directly.
