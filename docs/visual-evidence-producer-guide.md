# Live Visual Evidence Producer Guide

Green test ticks validate the gate only. They are never a live visual pass.

1. Copy `config/visual-matrix.live.template.json` to a run-specific ignored artifact location.
2. Include only explicitly approved page targets. Keep fixture and live matrices in separate files.
3. For every required item, describe the approved expectation and observed state, attach the screenshot/reference, and record its capture time.
4. Record failures immediately with the issue and proposed fix. Keep `retestResult` as `not-run` until a new capture verifies the fix.
5. Run the visual gate CLI against the matrix. Evidence older than `maxEvidenceAgeHours`, future timestamps, missing references, any issue, any failure, or an incomplete retest blocks eligibility.
6. Deliver the matrix and referenced screenshots to the owner for review. The runner never updates a baseline; a fully eligible matrix creates only a pending approval item.

No live-site mutation, production deployment, or baseline update is part of evidence collection.
