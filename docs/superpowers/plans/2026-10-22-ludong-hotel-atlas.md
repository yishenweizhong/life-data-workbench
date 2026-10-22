# 鲁东省区酒店经营地图实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建并发布一个包含鲁东省区 387 家真实组织门店的只读地图看板。

**Architecture:** 复用天津看板的静态 HTML/CSS/JavaScript 架构，新增鲁东专用数据同步器与坐标注册表。数据生成阶段合并经营工作台、经营分文件、组织台账和高德 POI 坐标；浏览器运行时只读取生成后的静态快照。

**Tech Stack:** Python 3、openpyxl、标准库 HTMLParser、Playwright、原生 JavaScript、AMap JavaScript API、GitHub Pages。

---

### Task 1: 数据契约测试

**Files:**
- Create: `docs/ludong-hotel-atlas/tests/sync_real_data_test.py`
- Create: `docs/ludong-hotel-atlas/tests/core.test.js`

- [ ] **Step 1: 写失败测试**

测试要求：

```python
assert result["meta"]["count"] == 387
assert result["meta"]["scoreMatches"] == 329
assert result["meta"]["scoreMissing"] == 58
assert len({hotel["district"] for hotel in result["hotels"]}) == 10
assert all(hotel["operationScore"] is None for hotel in missing_score_hotels)
```

- [ ] **Step 2: 运行测试并确认因同步器尚不存在而失败**

Run: `python3 docs/ludong-hotel-atlas/tests/sync_real_data_test.py`

Expected: FAIL，提示 `sync_real_data.py` 不存在。

- [ ] **Step 3: 增加核心筛选测试**

覆盖 `district`、`city`、`provider`、`certification`、`scoreAvailability` 和搜索组合筛选，并验证空经营分不进入平均值。

- [ ] **Step 4: 运行核心测试并确认因鲁东字段尚未实现而失败**

Run: `osascript -l JavaScript docs/ludong-hotel-atlas/tests/core.test.js`

Expected: FAIL，提示城市或经营分状态筛选不符合预期。

### Task 2: 生成门店主数据与 POI 注册表

**Files:**
- Create: `docs/ludong-hotel-atlas/scripts/sync_real_data.py`
- Create: `docs/ludong-hotel-atlas/scripts/geocode_registry.py`
- Create: `docs/ludong-hotel-atlas/data/ludong-hotel-registry.json`
- Create: `docs/ludong-hotel-atlas/data/ludong-hotels.json`
- Create: `docs/ludong-hotel-atlas/data/ludong-hotels-source.csv`
- Create: `docs/ludong-hotel-atlas/real-data.js`

- [ ] **Step 1: 实现门店、经营分与组织台账合并**

从 `workbench_ludong.html` 解析 387 条经营记录，从 `经营分_鲁东省区_2026-10-20.xlsx` 按 POI ID合并 329 条经营分，从组织台账补齐 POI ID；无经营分记录保留 `null`。

- [ ] **Step 2: 生成高德 POI 坐标注册表**

用城市和门店名查询高德 POI，记录名称、POI ID、地址、经纬度与匹配状态；重名或无结果项进入异常清单，不静默猜测。

- [ ] **Step 3: 运行同步器**

Run: `python3 docs/ludong-hotel-atlas/scripts/sync_real_data.py`

Expected: 输出 `387 stores, 329 scores`，并生成 JSON、CSV 和 JavaScript 快照。

- [ ] **Step 4: 运行数据测试**

Run: `python3 docs/ludong-hotel-atlas/tests/sync_real_data_test.py`

Expected: PASS。

### Task 3: 鲁东应用骨架与核心逻辑

**Files:**
- Create: `docs/ludong-hotel-atlas/index.html`
- Create: `docs/ludong-hotel-atlas/core.js`
- Create: `docs/ludong-hotel-atlas/api.js`
- Create: `docs/ludong-hotel-atlas/.gitignore`

- [ ] **Step 1: 复制已验收的天津只读骨架**

保留地图、概览、详情、导出和移动端结构，改为鲁东标题、城市筛选与经营分状态筛选。

- [ ] **Step 2: 实现空经营分语义**

`aggregateMetrics` 只对有分数门店求平均；`filterHotels` 支持 `scoreAvailability`；CSV 导出空分数保持为空。

- [ ] **Step 3: 运行核心测试**

Run: `osascript -l JavaScript docs/ludong-hotel-atlas/tests/core.test.js`

Expected: PASS。

### Task 4: 地图、概览与详情

**Files:**
- Create: `docs/ludong-hotel-atlas/app.js`
- Create: `docs/ludong-hotel-atlas/styles.css`
- Create: `docs/ludong-hotel-atlas/tests/marker-ui.test.py`

- [ ] **Step 1: 写失败的浏览器测试**

断言真实数据日期、387 家门店、无文字图钉、六类筛选、空分灰色图钉、片区筛选和自动缩放。

- [ ] **Step 2: 运行测试并确认应用尚未完成**

Run: `LUDONG_ATLAS_URL=http://127.0.0.1:4176/ python3 docs/ludong-hotel-atlas/tests/marker-ui.test.py`

Expected: FAIL。

- [ ] **Step 3: 实现地图与只读交互**

地图按坐标渲染图钉；经营分缺失用灰色；筛选后更新清单、指标、概览与地图视口；详情提供高德导航。

- [ ] **Step 4: 实现桌面与移动端样式**

沿用 Apple 风格令牌和地图优先布局，移动端为侧滑筛选面板与底部详情抽屉。

- [ ] **Step 5: 运行浏览器测试**

Run: `LUDONG_ATLAS_URL=http://127.0.0.1:4176/ python3 docs/ludong-hotel-atlas/tests/marker-ui.test.py`

Expected: PASS。

### Task 5: 本地视觉和交互验收

**Files:**
- Modify: `docs/ludong-hotel-atlas/app.js`
- Modify: `docs/ludong-hotel-atlas/styles.css`

- [ ] **Step 1: 启动静态服务器**

Run: `python3 -m http.server 4176 --bind 127.0.0.1`

- [ ] **Step 2: Playwright 桌面验收**

在 1440x960 检查地图、概览、详情、导出、片区筛选和浏览器控制台。

- [ ] **Step 3: Playwright 移动端验收**

在 390x844 检查地图、筛选面板、详情抽屉、文本溢出和横向滚动。

- [ ] **Step 4: 修复发现的问题并重跑全部测试**

Expected: 数据、核心、浏览器测试全部 PASS，控制台无错误。

### Task 6: 发布与公网验证

**Files:**
- Create: `/Users/bytedance/Documents/Trae-CN/temp_20261019_01/ludong-hotel-atlas/*`

- [ ] **Step 1: 同步成品到工作区**

将 `docs/ludong-hotel-atlas` 同步到工作区同名目录，排除缓存文件。

- [ ] **Step 2: 提交并推送**

Run: `git add docs/ludong-hotel-atlas docs/superpowers && git commit -m "Publish Ludong hotel atlas" && git push origin main`

- [ ] **Step 3: 等待 GitHub Pages**

Run: `gh run watch <run-id> --exit-status`

Expected: `pages build and deployment` 成功。

- [ ] **Step 4: 公网回归**

在 `https://yishenweizhong.github.io/life-data-workbench/ludong-hotel-atlas/` 运行核心浏览器测试，确认真实数据、筛选和移动端页面可用。
