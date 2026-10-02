# Final result summary implementation plan

**Goal:** Match the three approved final-score references with an accurate 4.5 threshold and verified save status.

**Architecture:** A small pure client view formats and renders the existing server result; scoring and persistence remain unchanged. The app supplies confirmed-save context and provides a guarded return-home action. Summary uses a scrolling header and in-flow CTA, not the inspection's sticky status strip.

**Tech stack:** Existing ES modules, Node tests, CSS, official Tabler icons and a Google Material star-medal icon, with their licenses.

## Constraints

- Exact 5 only: green Excelente and award. 4.5 <= score < 5: green Satisfactoria. Score < 4.5: red Requiere mejora. Classification uses unrounded score.
- Display one decimal when exact at that precision, two otherwise; never show a sub-4.5 number as 4.5 or a sub-5 number as 5.0.
- Separate GD result, No aplica gray; no arithmetic changes.
- Guardada requires closed + finalMaterialized true in bridge mode. Local previews and unconfirmed states must be labeled honestly.
- Include inspector and Chile-time closure date plus actual findings; preserve incomplete/late closure semantics.
- No writes to Sheet/Drive, changes to schedules, email or Apps Script deployment. Publish only scoped frontend source and vendored icons.
- Preserve pre-existing backend/deploy/Core.gs dirty change.

## Tasks

- [x] Add failing view tests: boundary classification 4/4.49/4.5/4.99/5, invalid scores, separate GD, safe HTML, save flag, counts and metadata.
- [x] Implement client/result-summary.mjs with scorePresentation(score) and renderResultSummary({inspection, stationName, mode}); use official icon files and their licenses.
- [x] Add failing integration tests: summary has no sticky inspection header, guard return-home to closed summaries, clear active QR and reset next-inspection session.
- [x] Integrate view in app.mjs; style faithful white layout, semantic cards, score rows, neutral GD, in-flow orange CTA; update entry cache versions.
- [x] Run full frontend/backend suite and diff checks. Inspect three states at reference/mobile sizes plus desktop, return-home action and console errors, without real data writes.
- [ ] Save design-qa.md with evidence, publish GitHub, verify deployment action and exact HTTP files.

## Test/verification commands

`node --test tests/result-summary.test.mjs tests/final-flow-ui.test.mjs`

`node --test tests/*.test.mjs backend/tests/*.test.cjs`

`git diff --check`

## Implementation interfaces

`scorePresentation(score)` returns {tone, label, icon, text}; invalid scores yield neutral Sin nota without an award. `renderResultSummary` consumes only the existing inspection.result, inspection.week, inspection.closedBy, inspection.closedAt and inspection.findings. It returns escaped HTML, never changes records or performs requests. `return-home` is accepted only on a finalized, materialized summary (or local completed preview).

## Verification to date

- View RED: six missing-feature failures before implementation; GREEN: six passed.
- Integration RED: summary and return-home tests failed against the old app; GREEN: all 16 flow tests passed after integration.
- Full suite: 250 passed, zero failures. Existing branding selector updated from the removed summary-hero to the approved result-hero.
- Independent read-only reviewer found no Critical/Important issues and independently reproduced 250 passes.
- Preview server is outside this repository and seeds sample results only in local responses. No fake result route or seed is published; no real inspection was submitted.
