# Ascension Automation Hub control tower UI

The Hub should be the primary owner-facing control for operational automations. GitHub Actions and Cloudflare remain implementation details behind the Hub.

Each automation card should show:

- current status
- last run
- next run
- schedule state
- Run now
- Pause / resume
- review evidence shortcut
- failure reason when unhealthy
- current stage in Check → Test → Preview → Review → Deploy

For production-capable work, later-stage controls stay locked until earlier gates pass. A failed test sends the item back to Check/Test. A failed preview blocks Review and Deploy. Deploy requires completed review plus owner approval.

Review should open one clear evidence view rather than scatter evidence across pages. The view should contain screenshots, preview link, test results, logs, exact changes, and approval history when those items exist.

Scheduled monitoring may run automatically. Heavy repair, production deployment, publishing, destructive changes, and spend changes remain owner-gated by default.
