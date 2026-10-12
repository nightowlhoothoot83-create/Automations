# Spew Crew storyboard generation repair

Recovered from the deployed `spewcrewvideocreator.pages.dev` page on 12 October 2026. The current Cloudflare Pages project was uploaded directly and has no Git source configured. This directory preserves the existing design, themes and canonical character descriptions without the public embedded credential.

This is an isolated repair in the Automations repository, not activation of its disabled automation contracts. No existing monitor, policy, schedule, or production configuration is changed.

## Implemented

- Real sequential generation queue instead of the original toast-only Auto Generate handler.
- Storyboard validation: selected characters only, narration, one to eight scenes.
- IndexedDB job storage, migration of existing browser-local packages, and checkpoints after every scene.
- Stop, interrupted-job detection, and explicit resume without repeating saved scenes or scripts.
- One PNG/JPEG reference per character, included with that character's image request.
- Existing server-side story/image connection, rather than browser API keys or hard-coded Gemini models.
- Honest package-ready, failed, stopped and interrupted states. Publishing controls are disabled and labelled.
- Escaped generated text in HTML views.

## Validation

Run `node --test apps/spewcrew-video-creator/pipeline.test.mjs` from the repository root. Nine focused tests cover checkpoints, resumes, references, cancellation, independent failures, concurrency, input validation and response handling. Inline JavaScript and module syntax checks pass. Real-browser testing remains pending: Chromium is not installed in the current execution environment. No live generation requests were made and no provider balance was consumed.

## Remaining before a finished autonomous YouTube workflow

- Confirm real images retain the owner's approved characters. Reference inputs are implemented, but this is not model training and does not prove visual consistency.
- The existing server returns square images; it currently ignores requested video dimensions. Adapt and verify portrait landscape framing before release.
- Add narration, sound, animated scene rendering and a playable MP4 export. Current export remains a storyboard ZIP, not a finished video.
- Add authenticated durable server-side job storage and scheduling, retries with provider task IDs and cost limits. This queue requires the browser page to remain open. Resume skips saved scenes, but a request interrupted before its output is saved may consume provider credits again.
- Add YouTube OAuth, private/test upload verification, channel selection and the owner's publishing rules. Planning dates are not posting schedules.
- Check the existing Worker authentication and abuse controls before exposing new paid automation endpoints.
- Remove the embedded credential from the production page and rotate/restrict it through its provider. The repair removes it from source; production is unchanged.

## Preview

Serve this directory with a local HTTP server. The existing provider connection is prefilled. Generation actions consume the owner's provider balance; do browser acceptance testing with mocked responses first. Do not deploy over the current site until its saved-job migration, layout and live generation are verified.
