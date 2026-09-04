# Ascension Automation Hub release gate

Production changes follow one ordered path:

1. **Check and test** runs the complete test suite and builds the Pages bundle.
2. **Preview** becomes eligible only after the check job succeeds and deploys a Cloudflare Pages preview.
3. **Deploy** becomes eligible only after preview succeeds and then re-runs tests immediately before the production deployment.

The workflow is intentionally manual and approval-friendly. It does not merge branches or publish unrelated content.

The Management Hub should use this release gate as the backend contract for future UI controls. The UI should present **Check**, then **Preview** after checks pass, then **Deploy** only after preview succeeds and owner approval is present.
