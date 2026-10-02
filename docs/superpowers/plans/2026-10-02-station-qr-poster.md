# Station QR poster implementation plan

**Goal:** Reproduce Ivan's selected DETECO station poster in the existing QR preview, SVG download and A4 portrait printing.

**Architecture:** One pure poster renderer uses the existing local QR generator and embeds the official logo and standard scan icon. The admin uses the same resulting SVG for all three outputs. QR URLs, tokens, Google authorization and operational records remain unchanged.

**Tech stack:** Existing Apps Script HTML, qrcode-generator 2.0.4, SVG, Node tests and browser QA.

## Approved design and constraints

- Source: codex-clipboard-20a7946b-56ed-48b3-b158-86674fb6dbb0.png, supplied by Ivan.
- Portrait 3:4: white DETECO logo header, orange station-name band and INSPECCIÓN 5S, large black QR, Escanea para iniciar and bottom orange stripe.
- Station name is dynamic and must fit without clipping; preserve accents. Never reuse the example QR pixels.
- Preserve the literal station.qrUrl and a quiet zone of at least four QR modules. No logo overlay on the QR.
- Download is a standalone SVG including the logo/icon; print is A4 portrait on one page. No third-party QR endpoint or runtime image request.
- No writes to Sheet/Drive, configuration, recipients or access permissions. Preserve pre-existing backend/deploy/Core.gs change.
- Publish scoped changes to existing GitHub repository and update the existing Apps Script deployment, preserving Code/manifest and deployment URL.

## Tasks and interfaces

- [x] RED: backend/tests/qr-poster.test.cjs tests createQrPoster({stationName, qrUrl, logoDataUri, scanIconDataUri}), standalone assets, dynamic names, escaping, exact QR geometry and invalid inputs. Add admin integration/build tests for shared output and A4 print.
- [x] GREEN: implement backend/qr-poster.js exporting createQrPoster and exposing app5sQrPoster in browser; integrate generated embedded assets in backend/build-deploy.cjs.
- [x] Use the complete SVG in backend/Admin.html preview, state.qrSvg download and print root. Keep copy-link unchanged. Dialog remains usable on small screens.
- [x] Build generated Admin.html; run node --test tests/*.test.mjs backend/tests/*.test.cjs and git diff --check.
- [x] Review source/rendered design together; test actual QR decoding, download and portrait/mobile/long-name views with synthetic data only. Save design-qa.md.
- [x] Independent read-only code review. Backup authorized remote source, preserve remote Code/manifest, update Admin only, read back and publish new version of the existing deployment. Active version 12 verified; no Critical/Important findings remain.
- [ ] Commit/push scoped source and generated Admin; verify GitHub Pages action and Apps Script version/source before claiming live.

## Verification

`node --test backend/tests/qr-poster.test.cjs backend/tests/build-deploy.test.cjs tests/admin-qr-poster.test.mjs`

`node --test tests/*.test.mjs backend/tests/*.test.cjs`

`git diff --check`

Release checkpoint before Git commit: 261 tests pass; actual SVG download and QR decode verified; Apps Script version 12 read back identical to the reviewed Admin bundle. Public endpoint returns HTTP 200 with the new poster, download and A4 markers. Code, manifest, deployment URL and operational data are unchanged. GitHub/Pages verification follows the commit and push.
