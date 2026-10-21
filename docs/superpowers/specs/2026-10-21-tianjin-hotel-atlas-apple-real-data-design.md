# Tianjin Hotel Atlas Apple Real-Data Redesign

## Goal

Replace the dated embedded demo-style dataset with a verified 2026-10-20 real-store snapshot, remove invented status labels from map markers, and redesign the public read-only product with an Apple-inspired operational interface.

## Data Decision

Three approaches were considered:

1. Parse the 900 KB workbench HTML in every visitor's browser. This stays current automatically but adds latency and couples the product to source-page markup.
2. Generate a versioned snapshot from the latest workbench and operation-score workbook. This is fast, auditable, and stable. **Selected.**
3. Add a database and API. This supports collaborative editing but is outside the approved public-view scope.

The generated snapshot joins:

- Store performance from `docs/workbench_jinhe.html`, period 2026-10-14 through 2026-10-20.
- Operation score and certification from `docs/downloads/经营分_津河省区_2026-10-20.xlsx`, joined by POI ID.
- Address, brand, longitude, and latitude from the verified 169-store Tianjin POI registry already used by the map.

All 169 POIs must match both current store performance and operation-score records. Generated fields named `status`, `tier`, `tags`, or `note` are excluded from the baseline snapshot.

## Product Scope

The published product is read-only:

- Search by hotel, address, provider, or POI.
- Filter by business area, brand, provider, and certification.
- Sort by payment GMV, operation score, payment nights, or name.
- Color markers by real operation score or real payment GMV.
- Export the currently filtered real-store rows.
- Open a hotel detail drawer and launch AMap navigation.

Local import, local editing, invented status/tier filters, and demo-reset controls are removed.

## Map Markers

Markers are compact colored map pins with a white center and no text. The former `正`, `关`, and `风` glyphs represented derived `正常`, `关注`, and `风险` labels and are removed.

Default marker coloring uses operation score:

- 100-120: strong
- 80-99: improve
- below 80: risk

The alternate map mode colors by payment GMV quartile-style thresholds. Colors communicate data only; Apple Action Blue remains the only interaction color.

## Apple-Inspired Interface

- Black 44 px global bar with a compact product identity.
- Frosted 56 px product toolbar below it.
- White and `#f5f5f7` surfaces, `#1d1d1f` text, and `#0066cc` actions.
- SF Pro system font stack with 600-weight headings and 17 px body text.
- No decorative gradients and no shadows on cards, buttons, or text.
- Thin hairlines, 8 px compact controls, 18 px detail/modal surfaces, pill search and primary actions.
- Dense operational layout remains map-first; the Apple treatment improves hierarchy without turning the product into a marketing page.

## Overview

The overview keeps area GMV ranking and replaces the invented status donut with real certification coverage. The secondary list shows the five lowest operation-score stores in the current scope.

## Responsive Behavior

- Desktop keeps a fixed 360 px control rail and full map workspace.
- At 860 px and below, the rail becomes a slide-over panel.
- Mobile keeps the map as the primary surface, uses 44 px touch targets, hides low-priority top-bar actions, and must not horizontally overflow.

## Verification

1. Data synchronization test proves 169/169 store and score matches for 2026-10-20.
2. Core logic tests prove certification filtering and aggregate metrics.
3. Browser test proves 169 text-free markers, provider filtering to 39 markers, real-data source label, and absence of status/tier controls.
4. Desktop and mobile screenshots are visually inspected.
5. Mobile 390 x 844 viewport has no horizontal overflow.
6. Public GitHub Pages URL passes the same marker and filtering assertions.

