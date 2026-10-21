# Tianjin Hotel Atlas Apple Real-Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a redesigned Apple-inspired Tianjin hotel map backed by the verified 2026-10-20 real-store snapshot.

**Architecture:** A deterministic Python sync script parses store rows from the latest generated workbench, joins operation scores by POI ID from the exported workbook, and merges both into the existing verified coordinate registry. The static frontend loads the generated snapshot, exposes only public read-only workflows, and renders text-free map markers colored by real metrics.

**Tech Stack:** Python 3, `html.parser`, `openpyxl`, static HTML/CSS/JavaScript, AMap JavaScript API 2.0, Playwright, GitHub Pages

---

### Task 1: Prove The Real-Data Contract

**Files:**
- Create: `docs/tianjin-hotel-atlas/tests/sync_real_data_test.py`
- Modify: `docs/tianjin-hotel-atlas/tests/core.test.js`
- Modify: `docs/tianjin-hotel-atlas/tests/marker-ui.test.py`

- [ ] **Step 1: Write a failing data synchronization test**

The test imports `scripts/sync_real_data.py`, parses the current workbench and workbook, and asserts:

```python
assert result["meta"]["asOf"] == "2026-10-20"
assert len(result["hotels"]) == 169
assert result["meta"]["storeMatches"] == 169
assert result["meta"]["scoreMatches"] == 169
assert all("status" not in hotel for hotel in result["hotels"])
assert all("tier" not in hotel for hotel in result["hotels"])
```

- [ ] **Step 2: Write failing UI assertions**

Update the browser test to assert:

```python
assert page.locator(".amap-hotel-marker").count() == 169
assert page.locator(".marker-pin-value").count() == 0
assert page.locator("#statusFilter").count() == 0
assert page.locator("#tierFilter").count() == 0
assert page.locator("#certificationFilter").count() == 1
```

- [ ] **Step 3: Run the tests and verify expected failures**

Run:

```bash
cd docs/tianjin-hotel-atlas
python3 tests/sync_real_data_test.py
python3 tests/marker-ui.test.py
```

Expected: synchronization fails because the script does not exist; UI assertions fail because old status/tier controls and marker labels still exist.

### Task 2: Generate The Verified Snapshot

**Files:**
- Create: `docs/tianjin-hotel-atlas/scripts/sync_real_data.py`
- Create: `docs/tianjin-hotel-atlas/real-data.js`
- Modify: `docs/tianjin-hotel-atlas/data/tianjin-hotels.json`
- Modify: `docs/tianjin-hotel-atlas/data/tianjin-hotels-source.csv`
- Delete: `docs/tianjin-hotel-atlas/mock-data.js`

- [ ] **Step 1: Implement HTML parsing with the standard library**

Create `StoreRowParser(HTMLParser)` that collects `tr` attributes inside `section#stores`.

- [ ] **Step 2: Join operation scores by POI ID**

Read sheet `门店经营分`, index rows by string `POI ID`, and copy `经营分`, `近7天变化`, `金冠认证`, `未满分维度`, and `区域户名称`.

- [ ] **Step 3: Merge into the coordinate registry**

For every existing Tianjin POI, require an exact store-name match and POI score match. Copy current payment/redeem values and provider from the workbench attributes. Preserve verified brand, address, longitude, and latitude. Raise an error unless both match counts are exactly 169.

- [ ] **Step 4: Write deterministic outputs**

Write:

```javascript
var HOTEL_DATASET = {...};
var HOTEL_SEED = [...];
```

to `real-data.js`, plus equivalent JSON and CSV exports. Exclude `status`, `tier`, `tags`, and `note`.

- [ ] **Step 5: Run the synchronization test**

Run:

```bash
python3 tests/sync_real_data_test.py
```

Expected: `PASS sync_real_data_test.py`.

### Task 3: Refactor The Read-Only Product

**Files:**
- Modify: `docs/tianjin-hotel-atlas/index.html`
- Modify: `docs/tianjin-hotel-atlas/app.js`
- Modify: `docs/tianjin-hotel-atlas/api.js`
- Modify: `docs/tianjin-hotel-atlas/core.js`

- [ ] **Step 1: Point the page at the real snapshot**

Replace:

```html
<script defer src="./mock-data.js"></script>
```

with:

```html
<script defer src="./real-data.js"></script>
```

- [ ] **Step 2: Remove local-maintenance UI**

Delete the import/settings buttons and both modals. Keep export as the only data action.

- [ ] **Step 3: Replace derived filters with certification**

Remove `tierFilter` and `statusFilter`, add:

```html
<label>
  <span>金冠认证</span>
  <select id="certificationFilter">
    <option>全部</option>
    <option>已认证</option>
    <option>未认证</option>
  </select>
</label>
```

- [ ] **Step 4: Render text-free markers**

`markerGraphic()` returns only the pin SVG, with its fill driven by `--marker-color`. Default coloring uses `operationScore`; the alternate mode uses `paymentGmv`.

- [ ] **Step 5: Replace invented status UI with real data**

Hotel rows show certification and area. The overview donut shows certification coverage. The detail drawer shows current payment, redeem, growth, operation score, provider, owner, and POI values, with navigation as its only command.

- [ ] **Step 6: Make baseline loading read-only**

`HotelAPI.loadHotels()` returns a clone of `HOTEL_SEED`; no `localStorage` override is applied. Export remains client-side.

### Task 4: Apply The Apple Visual System

**Files:**
- Modify: `docs/tianjin-hotel-atlas/styles.css`

- [ ] **Step 1: Replace the token layer**

Use:

```css
--primary: #0066cc;
--primary-focus: #0071e3;
--ink: #1d1d1f;
--canvas: #ffffff;
--parchment: #f5f5f7;
--hairline: #e0e0e0;
```

- [ ] **Step 2: Build the two-row navigation**

Use a 44 px black global bar and a 56 px frosted product bar. Keep search pill-shaped and all controls at least 44 px high on touch layouts.

- [ ] **Step 3: Restyle the rail and map chrome**

Use flat white/parchment surfaces, hairline separators, Action Blue active states, 8 px compact utility radii, and no card shadows.

- [ ] **Step 4: Restyle text-free markers**

Use compact 24 x 32 px map pins with a white center, metric-driven fill, and no interior text.

- [ ] **Step 5: Validate responsive layouts**

Keep the desktop rail fixed and switch it to a slide-over at 860 px. Ensure the mobile map remains the first surface and the document does not horizontally overflow.

### Task 5: Verify And Publish

**Files:**
- Test: `docs/tianjin-hotel-atlas/tests/core.test.js`
- Test: `docs/tianjin-hotel-atlas/tests/sync_real_data_test.py`
- Test: `docs/tianjin-hotel-atlas/tests/marker-ui.test.py`

- [ ] **Step 1: Run all automated tests**

Run:

```bash
osascript -l JavaScript tests/core.test.js
python3 tests/sync_real_data_test.py
python3 tests/marker-ui.test.py
```

Expected: all tests pass.

- [ ] **Step 2: Inspect desktop and mobile screenshots**

Capture 1440 x 960 and 390 x 844 screenshots. Confirm visible map, readable controls, no overlapping text, no marker glyphs, and no horizontal overflow.

- [ ] **Step 3: Commit and push**

Run:

```bash
git add docs/tianjin-hotel-atlas docs/superpowers
git commit -m "Redesign hotel atlas with real store data"
git push origin main
```

- [ ] **Step 4: Verify GitHub Pages**

Wait for `pages-build-deployment` to succeed, then run the marker UI test against:

```text
https://yishenweizhong.github.io/life-data-workbench/tianjin-hotel-atlas/
```

Expected: 169 markers initially, 39 for `北京昱海黑科技有限公司`, 0 marker text labels, and a 2026-10-20 source label.

