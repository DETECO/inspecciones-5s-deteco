# Inspection status Implementation Plan

**Goal:** Replace duplicate identity-page banners with a clickable traffic-light status and repair the final-only bridge protocol.

**Architecture:** A pure status function consumes confirmed server state, schedule and server time. A read-only final-state query runs after rendering the scanned station; begin-final remains the only reservation action. No answer polling, draft resumption or Sheet write before final submission.

**Tech Stack:** Existing ES modules, native dialog, Node tests and Google Apps Script.

## Global Constraints

- Preserve DETECO styling, QR access, permissions, schedules and historical records.
- Green requires confirmed access, server time and an available configured window; the server rechecks at begin-final and submit-final.
- Red exposes its reason on click; amber means validation/sending or permitted late closure. Text accompanies each color.
- No real reservations, inspection submissions or email tests during verification.

### Task 1: Final bridge operations

- [x] Add tests using makeBridgeRequest and the real form transport for begin-final, final-state, upload-final-photo and submit-final. Observe the operation-invalid failures.
- [x] Add only those four existing backend operations to the allowlist; preserve token, nonce, endpoint and source checks.
- [x] Run transport regression tests, including unknown-operation rejection.

### Task 2: State semantics and identity UI

- [x] Test a pure inspectionStatus function: checking is amber, unknown access never green, offline/error/occupied/closed window red, server-confirmed available green, confirmed closure green, and editable in-progress state preserved.
- [x] Implement client/inspection-status.mjs using inspectionWindow with the received schedule and server clock.
- [x] Test actual app rendering and a read-only preflight; verify no reservation before inspector action, no overlapping identity banners, a native accessible status dialog and retry action.
- [x] Integrate a final-state read after first render, record receipt time, update status after start/errors/send, and keep answers untouched on retry.
- [x] Update status CSS with green/amber/red, keyboard focus and mobile layout; bump changed import URLs and stylesheet/app entry versions.

### Task 3: Verification and publication

- [x] Run the complete suite and build deploy bundle. Read and review the diff.
- [x] Test local mobile UI with simulated read-only receipts, including red reason dialog and green availability.
- [ ] Commit scoped changes and publish GitHub Pages; check successful deployment and exact live module content. No Apps Script deployment is needed if its source remains unchanged.

## Verification before publication

230 tests passed on 2026-10-02; build-deploy and diff checks passed. Independent read-only review found no publication blockers. Mobile browser UI verified available/closed states and the reason dialog with simulated read-only receipts. Added regressions for server-clock closure, status expiry without requests, browser focus and stale preflight replies preserving a newly opened scanner. No real inspection, lease, photo or email was created during verification. Publication remains to be confirmed against the committed SHA and live files.
