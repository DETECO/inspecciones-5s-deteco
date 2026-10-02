# Reliable closure and compact inspection layout

**Goal:** Implement the user-approved visible close progress, safe acknowledgement recovery and compact DETECO layout.

**Architecture:** Final-only submission reports confirmed photo counts then indeterminate server persistence. A lost response is reconciled through final-state; only a matching session and completed materialization proves success. Backend retains idempotence and reduces duplicate per-row writes. The large brand row scrolls; a compact station/status/progress strip remains sticky, and navigation stays in document flow.

**Tech Stack:** Existing ES modules, Google Apps Script, Node test runner and native HTML progress.

## Constraints

- No live inspection submissions, email tests, changes to recipients, schedules, owners, QR tokens or permissions.
- Preserve in-memory answers/photos, upload cache and frozen completion timestamp across retries.
- Never report full success from status closed alone when materialization is incomplete.
- Progress reflects confirmed uploads only; no fake percentage for Google persistence.
- Publish scoped changes to existing GitHub Pages and Apps Script deployment; verify exact files and deployment.

## Tasks

- [x] Backend: tests first for materialization receipt and no duplicate response writes; implement bounded table batching/idempotent closure, verify backend suites.
- [x] Client: tests first for photo count progress, lost-reply reconciliation, mismatched/incomplete state rejection and cache reuse; implement in final-submit.mjs.
- [x] UI: regression tests for progress rendering and compact layout; integrate progress state in app.mjs, preserve DETECO typography/colors, make footer flow and narrow sticky strip.
- [x] Verify: full Node suite/build/diff plus mobile preview. Review independently. No real data tests.
- [ ] Release: preserve remote Apps Script backup, deploy only authorized project, commit scoped source, push existing repository, check Pages and Apps Script publication.

## Test commands

`node --test tests/final-submit.test.mjs tests/final-flow-ui.test.mjs tests/inspection-status.test.mjs`

`node --test backend/tests/*.test.cjs`

`node backend/build-deploy.cjs`

`node --test tests/*.test.mjs backend/tests/*.test.cjs`

## Implementation boundaries

Backend worker owns Code.gs, FinalSubmission.gs and backend tests. Main worker owns client/final-submit.mjs, client/app.mjs, styles.css and frontend tests. Public protocol adds finalMaterialized boolean to state, preserving older fields. A receipt from submit-final itself remains authoritative; final-state recovery requires finalMaterialized === true and matching finalSessionId and station/week. Timeouts are classified by code BRIDGE_TIMEOUT; do not turn server validation errors into automatic mutations.

## Verification evidence

- Full suite: 241 passed, 0 failed; independently repeated by reviewer.
- Build and diff checks passed. Mobile preview 390x844: compact sticky header 73.2px; footer static; no horizontal overflow or question overlap.
- Read-only live check: Inspecciones contained headers only; no closed record from the reported attempt was confirmed. No records were created or removed.
- Remote source backup: ../app5s-close-backup-20261002. Existing deployment updated to version 11; Admin.html and appsscript.json unchanged.
- GitHub Pages publication verification remains the last release check.
- Actual phone-to-Google closure and real Google latency remain user acceptance checks; simulated tests do not prove that live round trip.
