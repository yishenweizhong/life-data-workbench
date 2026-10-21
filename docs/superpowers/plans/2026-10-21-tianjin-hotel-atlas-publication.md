# Tianjin Hotel Atlas Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the existing Tianjin hotel atlas at a stable public GitHub Pages URL.

**Architecture:** Copy the already tested static application into the existing Pages source tree at `docs/tianjin-hotel-atlas/`. Keep all relative assets together, push one deployment commit to `main`, then verify the built public site with HTTP and browser checks.

**Tech Stack:** Static HTML/CSS/JavaScript, AMap JavaScript API 2.0, GitHub Pages, Node.js tests, Playwright browser verification

---

### Task 1: Add The Static Product

**Files:**
- Create: `docs/tianjin-hotel-atlas/index.html`
- Create: `docs/tianjin-hotel-atlas/styles.css`
- Create: `docs/tianjin-hotel-atlas/app.js`
- Create: `docs/tianjin-hotel-atlas/core.js`
- Create: `docs/tianjin-hotel-atlas/api.js`
- Create: `docs/tianjin-hotel-atlas/mock-data.js`
- Create: `docs/tianjin-hotel-atlas/data/tianjin-hotels.json`
- Create: `docs/tianjin-hotel-atlas/data/tianjin-hotels-source.csv`
- Create: `docs/tianjin-hotel-atlas/hotel-import-template.csv`
- Create: `docs/tianjin-hotel-atlas/tests/core.test.js`
- Create: `docs/tianjin-hotel-atlas/tests/marker-ui.test.py`

- [ ] **Step 1: Copy the tested product into the Pages source**

Run:

```bash
cp -R /Users/bytedance/Documents/Trae-CN/temp_20261019_01/tianjin-hotel-atlas \
  /tmp/life-data-workbench-deploy-20261021/docs/tianjin-hotel-atlas
```

Expected: the destination contains the same 11 files as the source.

- [ ] **Step 2: Verify the copied files are byte-identical**

Run:

```bash
diff -qr \
  /Users/bytedance/Documents/Trae-CN/temp_20261019_01/tianjin-hotel-atlas \
  /tmp/life-data-workbench-deploy-20261021/docs/tianjin-hotel-atlas
```

Expected: no output and exit code 0.

### Task 2: Validate Before Publication

**Files:**
- Test: `docs/tianjin-hotel-atlas/tests/core.test.js`
- Test: `docs/tianjin-hotel-atlas/tests/marker-ui.test.py`

- [ ] **Step 1: Run core tests**

Run:

```bash
cd docs/tianjin-hotel-atlas
osascript -l JavaScript tests/core.test.js
```

Expected: all core assertions pass.

- [ ] **Step 2: Serve the Pages source locally**

Run:

```bash
python3 -m http.server 4174 --directory docs
```

Expected: `http://127.0.0.1:4174/tianjin-hotel-atlas/` returns HTTP 200.

- [ ] **Step 3: Run browser marker assertions against the subpath**

Run a Playwright check that loads the local subpath and asserts:

```javascript
document.querySelectorAll(".amap-hotel-marker").length === 169
```

Then select `北京昱海黑科技有限公司` in `#providerFilter` and assert:

```javascript
document.querySelectorAll(".amap-hotel-marker").length === 39
```

Expected: both assertions pass.

### Task 3: Publish Through GitHub Pages

**Files:**
- Commit all files under `docs/tianjin-hotel-atlas/`
- Commit the design and plan documents under `docs/superpowers/`

- [ ] **Step 1: Confirm the change scope**

Run:

```bash
git status --short
git diff --stat
```

Expected: only `docs/tianjin-hotel-atlas/` and `docs/superpowers/` are new.

- [ ] **Step 2: Commit**

Run:

```bash
git add docs/tianjin-hotel-atlas docs/superpowers
git commit -m "Publish Tianjin hotel atlas"
```

Expected: one deployment commit is created.

- [ ] **Step 3: Push directly to the configured Pages branch**

Run:

```bash
git push origin main
```

Expected: `main` advances and triggers `pages-build-deployment`.

### Task 4: Verify The Public Product

**Files:**
- No repository file changes

- [ ] **Step 1: Wait for the Pages build**

Run:

```bash
gh run list --repo yishenweizhong/life-data-workbench \
  --workflow pages-build-deployment --limit 1
```

Expected: the newest run completes with `success`.

- [ ] **Step 2: Verify HTTP availability**

Run:

```bash
curl -I -L \
  https://yishenweizhong.github.io/life-data-workbench/tianjin-hotel-atlas/
```

Expected: final status is HTTP 200.

- [ ] **Step 3: Verify desktop behavior**

Open the public URL in a browser, wait for the map, verify 169 markers, select `北京昱海黑科技有限公司`, and verify 39 markers remain.

Expected: the map and provider filter work without console-level blocking errors.

- [ ] **Step 4: Verify mobile layout**

Load the public URL at a 390 x 844 viewport and confirm:

```javascript
document.documentElement.scrollWidth <= window.innerWidth
```

Expected: true.
