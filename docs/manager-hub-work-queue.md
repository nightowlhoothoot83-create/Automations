# Manager Hub Work Queue

This queue captures the current integration and repair scope for the Ascension Manager Hub. It is intentionally branch-only and does not authorise production changes, merges, ad spend, publishing, destructive actions, or deployment.

## Control model

Keep risky actions behind the existing release sequence:

**Check → Test → Preview → Review → Approve → Deploy**

Controls should be contextual rather than shown everywhere. Supported actions should include, where appropriate:

- Run / Rerun
- Retest
- Review evidence
- Create repair
- Fix
- Approve
- Reject / Send back
- Dismiss
- Already fixed
- Pause / Resume
- Schedule
- Protect / Lock where technically supported
- View history
- Open site / repo / preview
- Deploy only after all required gates pass

`Dismiss` and `Already fixed` must preserve history rather than deleting evidence.

## Managed property coverage

Manager Hub should treat all of the following as first-class managed properties, not SaaS-only entries:

### Raven Sharp SaaS

1. Image Optimiser & Upscaler
2. POD Suite
3. Content Creator
4. Ad Manager
5. Book Creator
6. Smart Cleaner

### AdSense / utility sites

- MyCalcTools.net
- MyCalendarTools.net
- WheelNamePicker.com.au
- Any additional approved AdSense properties discovered by inventory

Integrate the existing AdSense and site monitors, including ads.txt, indexing/SEO, mobile/performance, broken links, visual checks, latest monitor run, outstanding repair requests, and repository/deployment status where available.

### Hubs and websites

- Ascension Automation / Manager Hub
- Raven Sharp Hub
- Mystical Moments
- Other managed Ascension Digital properties discovered by inventory
- 3–4 personal/content sites to be identified and converted into their intended working automations

### Store / Shop Ops / QA

Integrate Shop Ops and QA rather than creating a duplicate orchestration layer. Show health, last run, next run, findings, evidence, repair state, and safe actions.

## Repair request model

Repair requests must work for websites, AdSense properties, SaaS, Shop Ops, and supporting automations.

Suggested states:

- Open
- In review
- Repair proposed
- Testing
- Ready for approval
- Resolved
- Dismissed
- Blocked

Severity should distinguish:

- Launch blocker
- Important
- Minor / visual

Minor issues still belong in the queue. Examples: card colours/glows, old or wrong logos, button colours, spacing/alignment, inconsistent headers/footers, mobile layout quirks, duplicate elements, odd symbols, typography and similar visual regressions.

## End-to-end pipeline testing

For each SaaS, test the real customer journey rather than page-load only:

**Visit → register → login → account isolation → create/upload → process/generate → save → download/export → billing/plan limits → logout/login → persistence**

Also verify relevant API/backend calls, database ownership/isolation, file storage, external providers, error/fallback behaviour, and mobile behaviour.

Ad Manager and Content Creator require explicit two-account privacy tests proving Account B cannot see Account A brands, projects or assets.

Record stages as **Pass / Partial / Fail / Blocked** and create repair requests for genuine failures.

## Brand privacy cleanup

### Ad Manager

- Remove mojibake / broken symbols from brand cards.
- Stop using global unscoped browser seed brands as the source of truth.
- Customer accounts should see only their authenticated account brands.
- New customers should start clean, without Emma/ADG business references.
- Owner ADG presets may be available only to the owner account.
- If browser storage is retained for caching, key it to the authenticated user and never let it replace backend ownership controls.

### Content Creator

- Keep backend user_id isolation.
- Replace hard-coded owner-brand instructional wording with generic customer wording.
- Verify the owner account can seed/load the intended presets without exposing them to other users.

## Git repository coverage

Audit every live property and classify:

- Connected
- Missing repo
- Wrong repo
- Unknown

Known repository coverage already discovered:

- Ascension Manager Hub: `nightowlhoothoot83-create/ascension-automation-hub`
- Raven Sharp Hub: `nightowlhoothoot83-create/Raven-Sharp-Hub`
- Mystical Moments: `nightowlhoothoot83-create/Mystical-Moments`

Do not connect or change a live Cloudflare Pages/Railway repository binding without separate explicit production/infrastructure approval.

Personal/content sites need more than repository linkage: identify the intended automation for each site, implement the missing real features, then integrate monitoring and controls into Manager Hub.

## POD Suite

Separate mockup quality from original artwork generation.

- Mockup generation: retain as a separate passing feature if current tests continue to support that result.
- Original image generation: quality repair required.
- Add a minimum Production Ready standard so a returned image is not automatically considered complete.

Production checks should cover prompt match, composition, detail, print dimensions/resolution, artefacts, text quality, unwanted borders/cropping, watermark/signature issues, background suitability, and product fit.

Preferred pipeline:

**Generate → Quality Check → Reject/Regenerate below threshold → Print-Safe Check → Mockup → Final Review**

Only mark an asset `Production Ready` after all critical checks pass.

## Smart Cleaner

Smart Cleaner is a SaaS and needs standard account authentication plus separate OAuth connections for supported cloud storage.

Target workflow:

**Login → connect storage with OAuth → scan → detect duplicates/near-duplicates/junk/large/old versions → suggest organisation → preview changes → user approval → move/rename/archive/delete only approved items → verify → history/undo → disconnect**

Requirements:

- Google Drive OAuth first where supported by product scope
- Dropbox/OneDrive only when intentionally supported
- Minimum OAuth permissions
- Secure server-side token handling
- Expired/revoked token recovery
- Account isolation
- Protected folders/exclusions
- Duplicate and near-duplicate detection
- Photo/document categorisation
- Large/old file detection
- Suggested folder structures
- Batch rename/move
- Preview before mutations
- Archive option where suitable
- Undo/recovery history
- Storage-saved estimates
- Change report
- User rules such as never touch folder, keep newest copy, keep RAW, archive instead of delete, organise invoices by year

OAuth connection health must be tested separately from ordinary SaaS login health.

No automatic deletion merely because OAuth permission exists.

## Protection / locking

Expose protection controls only where the underlying system can enforce them. Examples:

- Visual Lock
- Production Protect
- Require Approval
- Pause Automation

If unsupported or not yet configured, show that state clearly rather than claiming protection.

## Current release note

This document is a planning/integration queue only. Production remains governed by the existing approval gates and no item in this file grants merge or deploy authority.
