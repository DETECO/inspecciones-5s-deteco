# Station QR poster — design QA

Date: 2026-10-02. Scope: QR preview/download/print only. Station links/tokens, authorization, records, schedule and notifications are unchanged.

## Source and comparison setup

- Source visual truth: `C:/Users/DELL/AppData/Local/Temp/codex-clipboard-20a7946b-56ed-48b3-b158-86674fb6dbb0.png`, supplied/selected by Ivan. Portrait 1086 × 1448 pixels (3:4), BODEGA.
- Implementation: `http://127.0.0.1:59825/compare.html` and `/admin.html`, private preview with synthetic station URLs. No preview/stub is committed to the app, and no operational backend is called.
- Poster SVG: 1080 × 1440 logical pixels (3:4). Both source and implementation are displayed at 543 × 724 CSS px in one comparison input. Source scale 0.5, implementation scale 543/1080; visual density normalized to equal display size.
- Full-view evidence: `../qr-poster-evidence/comparison-final.jpg` contains source and browser-rendered implementation together, including the bottom orange stripe. Default desktop viewport approximately 1273 × 715 CSS px; full-page capture includes the 724px poster plus 24px label.
- Admin evidence: `../qr-poster-evidence/admin-bodega.jpg`, `admin-long-name.jpg`, `admin-mobile.jpg`. Mobile viewport requested 393 × 852 CSS px; observed DOM width 394px, dialog 340.4px, poster 300.4 × 400.525px. Screenshot content scaling is not used for pixel-matching judgments.
- State: BODEGA, OBRA SANTA JULIA, and 58-character accented station name. Synthetic payload differs from the sample QR; matrix differences are expected and necessary.
- Focused crop not required: logo, station text, subtitle, QR margins and footer are readable in the combined capture. Additional mobile/long-name captures validate wrapping and controls.

## Comparison history

1. Initial combined screenshot: P2 — logo about 6% smaller than source and black QR footprint smaller/lower. Corrected logo width to 700 logical pixels and black QR footprint to 680px at y565. Quiet zone remains four modules, independent of payload density. Blocked pending recapture.
2. Final combined screenshot above: header, orange band, large white station name, black-on-white QR and footer proportions align. No actionable P0/P1/P2 visual differences remain. Captured again after the final footer-margin correction.
3. Integration regression discovered during inspection: descendant CSS would resize the nested QR SVG. Changed to direct-child `.qr-preview>svg` and `#qr-print-svg>svg`; failing regression test then passed. Actual inline preview matches standalone export.
4. Quiet-zone regression: the footer icon's stroke could invade the QR white frame. Bounded the whole QR to 795px and placed the icon at y1294. A stroke-aware test checks at least 2px clearance for short and long URLs; RED then GREEN. Final source/implementation, long-name and mobile captures were refreshed.

## Required fidelity surfaces

- Typography: heavy uppercase station, bold INSPECCIÓN 5S and bold dark call-to-action preserve the hierarchy. Portable Arial Black/Arial fallbacks and bounded textLength prevent clipping. Names over 24 characters use two balanced lines instead of compressed single-line lettering. Accents remain intact.
- Spacing/layout: 3:4 white poster, official centered logo, edge-to-edge orange band, centered large QR and bottom stripe. No extra frame/shadow/URL/week on the exported poster. Modal/help/buttons remain outside artwork.
- Colors/tokens: existing corporate orange #f26522, white and dark gray #494741; black QR on pure white. Flat brand color intentionally replaces mock raster texture. Print color adjustment is exact.
- Assets: unchanged official DETECO JPEG embedded, not recreated. Existing licensed Tabler scan icon embedded in dark gray. Real QR generated locally with existing qrcode-generator 2.0.4 from exact station.qrUrl, never sampled from reference. No logo overlay; four-module white margins.
- Copy: dynamic uppercase station, INSPECCIÓN 5S, Escanea para iniciar. No invented contacts/URLs/grades. Copy link preserves literal URL. Export instructions explain SVG and PDF through print.

## Interaction and technical evidence

- Admin QR dialog opens/closes. Preview and print root receive the same SVG; download uses the same state.qrSvg.
- Final Descargar cartel click created `C:/Users/DELL/Downloads/DETECO-5S-BODEGA (1).svg` (560572 bytes). Independent filesystem comparison verified exact equality with the final built renderer and embedded assets.
- Existing app scanner decoded the complete poster SVG, confirming the expected synthetic BODEGA payload unchanged. Initial harness used a CSS-scaled Image whose rendered width was interpreted as source dimensions, causing a false decode failure; reading the SVG at intrinsic dimensions corrected the harness. No production QR/scanner code changed for this test issue.
- Mobile: no horizontal overflow; all actions reachable. Long names wrap without clipping. Browser console error/warn inspection returned an empty list.
- A4 portrait CSS: 10mm margins; single poster 190 × 253.333mm fits available 190 × 277mm, break-inside avoid. Print hides admin chrome including the dialog and shows only the shared poster. No physical printer was used; exact driver margins remain a device check.
- Fresh suite: 261 passing, zero failing. RED: eight missing-feature failures, then regressions for long-name wrapping, nested SVG CSS and footer quiet-zone/stroke clearance; all subsequently green.
- No live inspections, Sheet/Drive records, recipients, authorization scopes or QR tokens changed. Pre-existing dirty Core.gs excluded.
- Independent read-only review: no Critical/Important findings remain. Generated Admin matches the build. Published only Admin to existing Apps Script deployment version 12; read-back matches local bundle and public endpoint returns HTTP 200 with poster/download/A4 markers. Code and manifest are unchanged.

## Findings / residual differences

- No actionable P0/P1/P2 findings remain.
- P3: standard scan icon includes a center scan line; reference shows empty corners. Existing coherent licensed icon used, not a custom approximation.
- Expected: QR matrix changes with genuine station URL. Evidence uses synthetic QR data, not a station access credential.
- Residual checks: physical printer and physical iPhone SVG viewing not exercised. Responsive layout and intrinsic QR decoding passed.

## Checklist

- [x] Source and rendered implementation compared together at normalized size.
- [x] Official assets embedded; dynamic station and genuine QR.
- [x] Shared full poster for preview, download and print.
- [x] Long names, mobile width and console checked.
- [x] Actual download verified and complete poster decoded.
- [x] Full test suite passing.

final result: passed
