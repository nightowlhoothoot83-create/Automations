# Raven Sharp visual verification gate

Verified: 22 August 2026, Australia/Brisbane

Fresh deployed renders were captured at 1280×720 and 390×844. Earlier monitor output and screenshots were not used as evidence. The approved shell was treated as locked: dark Raven background, top-left Raven mark and two-line product lockup, centred Raven mark where present, Cabinet Grotesk/Outfit typography, purple/blue/gold accents, shared suite navigation, Ascension Digital Group footer branding, and no horizontal overflow.

Evidence directory: `artifacts/automation-1/visual-2026-08-22T01-01-40-820Z/` (ignored generated output).

## Verification matrix

| Page / area | Expected approved state | Actual deployed state | Gate | Issue | Development fix | Evidence | Retest |
|---|---|---|---|---|---|---|---|
| RavenSharp.com hub | Raven Sharp top-left; Creative Suite label; suite and ADG navigation; centred hero imagery; responsive shell | Correct lockup, naming, hero, imagery, typography and footer. Mobile nav wraps densely but remains visible with no overlap or overflow. | Pass | None | None | `hub-desktop-top-verified.png`, `hub-mobile-correct-top.png`, `hub-desktop-footer-final.png`, `hub-mobile-footer-final.png` | 1280 and 390 DOM bounds pass; no console errors |
| POD suite public | Raven Sharp top-left; `POD SUITE`; centred black Raven Sharp mark; shared footer | Correct header name and position, centred mark, hero spacing, suite footer and ADG branding. | Pass | None | None | `pod-desktop-top-verified.png`, `pod-mobile-correct-top.png`, `pod-desktop-footer-final.png`, `pod-mobile-footer-final.png` | 1280 and 390 pass; no overflow/errors |
| POD sign-in | Same Raven/POD identity retained around authentication | Header remains `RAVEN SHARP / POD SUITE`; sign-in form present; footer retained. | Pass | None | None | `pod-login-desktop-top-verified.png`, `pod-login-mobile-top-verified.png` | Form and lockup present at both widths; no overflow/errors |
| Book Creator public | Raven Sharp top-left; `BOOK CREATOR` beneath; centred Raven mark without black/white square panel; name aligned in lockup; shared footer | Correct. Centre asset is transparent `ravenCentre.png`; no square panel is rendered. Product name sits under Raven Sharp in header. | Pass | None | None | `book-desktop-top-verified.png`, `book-mobile-correct-top.png`, `book-desktop-footer-final.png`, `book-mobile-footer-final.png` | 1280 and 390 pass; no overflow/errors |
| Book Creator studio entry | Persistent Raven Sharp / Book Creator branding | Correct persistent header and product name; account state shown without removing shell. | Pass | None | None | `book-studio-desktop-top-verified.png`, `book-studio-mobile-top-verified.png` | No overflow/errors at either width |
| Image Optimiser & Upscaler public | Restored Raven Sharp header branding; Image Optimiser tool label; centred mark; Optimiser navigation; shared footer | Correct top-left mark and `IMAGE OPTIMISER`, centred Raven mark, tool link, hero and footer. Full product title remains `Image Optimiser & Upscaler`. | Pass | None | None | `image-desktop-top-verified.png`, `image-mobile-correct-top.png`, `image-desktop-footer-final.png`, `image-mobile-footer-final.png` | Live DOM places logo at x=16 and CTA within x=369 at 390px; no overflow/errors |
| Image Optimiser sign-in | Product identity and shell persist around form | Correct header, centred Raven branding, form and shared footer. | Pass | None | None | `image-login-desktop-top-verified.png`, `image-login-mobile-top-verified.png` | Form and lockup present at both widths; no overflow/errors |
| Content Creator public | Restored Raven Sharp header; `CONTENT CREATOR`; centred mark; shared footer | Correct product lockup, centred mark, hero typography, spacing, suite nav and ADG footer. | Pass | None | None | `content-desktop-top-verified.png`, `content-mobile-correct-top.png`, `content-desktop-footer-final.png`, `content-mobile-footer-final.png` | 1280 and 390 pass; no overflow/errors |
| Content Creator studio entry | Persistent Raven Sharp / Content Creator identity | Correct persistent header and product name. | Pass | None | None | `content-studio-desktop-top-verified.png`, `content-studio-mobile-top-verified.png` | No overflow/errors at either width |
| Ad Manager public/auth | Raven Sharp top-left; `AD MANAGER`; centred mark; shared footer; mobile remains readable | Correct lockup, centred mark, CTA stack, campaign imagery and footer. Login/register forms exist without replacing brand shell. | Pass | None | None | `ads-desktop-top-verified.png`, `ads-mobile-correct-top.png`, `ads-desktop-footer-final.png`, `ads-mobile-footer-final.png` | 1280 and 390 pass; no overflow/errors |
| Smart Cleaner public web SaaS | Raven Sharp top-left; `SMART CLEANER`; centred mark; shared footer; responsive CTAs | Correct lockup, centre mark, imagery, buttons and footer. | Pass | None | None | `cleaner-desktop-top-verified.png`, `cleaner-mobile-correct-top.png`, `cleaner-desktop-footer-final.png`, `cleaner-mobile-footer-final.png` | 1280 and 390 pass; no overflow/errors |
| Smart Cleaner web-SaaS `/app` auth/workspace shell | Persistent top-left 44px Raven mark and Smart Cleaner label; no intrinsic-image overflow; responsive auth composition | **Deployed failure:** missing `.rs-persistent-*` CSS lets the 1536px logo render at intrinsic width, producing a 1536px document inside a 1265px viewport. | Fail pending deploy | Locked-shell CSS was referenced by markup but absent from `app.html`. | Added only the missing persistent-shell CSS on `codex/automation-1-smart-cleaner-shell`; no redesign and no separate Smart Cleaner app changes. | Deployed: `active-interface-data.json`. Fixed: `cleaner-app-local-fixed-desktop.png`, `cleaner-app-local-fixed-mobile.png` | Local pass: logo 44×44; 1265/1265 desktop and 375/375 mobile document widths; no overflow |

## Gate decision

The visual baseline is **not approved or locked**. Public landing pages and inspected sign-in/studio entries pass, but Smart Cleaner web SaaS `/app` still fails in production until the isolated development fix is reviewed, deployed with approval, and retested on the deployed URL.

## Remaining approval queue

1. Owner reviews Smart Cleaner web-SaaS commit `767ca0e` on `codex/automation-1-smart-cleaner-shell`.
2. Owner authorises production deployment through the normal repository workflow.
3. Automation 1 reruns fresh deployed `/app` screenshots at 1280×720 and 390×844, verifies the 44×44 top-left mark, product label, auth/workspace shell, footer, console, and zero overflow.
4. Only after that deployed retest passes may the owner approve or lock the visual baseline.

No shared component, provider, model, paid service, credential, production deployment, or separate Smart Cleaner app repository was changed.
