import os
from playwright.sync_api import sync_playwright

BASE = os.environ.get("ATLAS_BASE", "http://127.0.0.1:4185")
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for atlas in ["tianjin-hotel-atlas", "ludong-hotel-atlas"]:
        for width, height in [(1440, 960), (390, 844)]:
            page = browser.new_page(viewport={"width": width, "height": height})
            page.route("**/*amap.com/**", lambda route: route.abort())
            page.goto(f"{BASE}/{atlas}/", wait_until="networkidle")
            page.wait_for_selector(".fallback-map:not([hidden])", timeout=15000)
            page.wait_for_timeout(500)
            assert page.locator(".hotel-pin-icon text").count() == 0
            assert page.locator(".marker-pin-value").count() == 0
            labels = page.locator(".fallback-marker .hotel-marker-name")
            assert labels.count() > 0, "门店名称应显示在水滴图钉旁"
            visible = labels.evaluate_all("""nodes => nodes.filter(n =>
                getComputedStyle(n).visibility !== 'hidden').map(n => {
                    const r=n.getBoundingClientRect();
                    return {text:n.textContent, x:r.x,y:r.y,w:r.width,h:r.height};
                })""")
            assert len(visible) > 3, "默认范围应显示多个门店名称"
            for i, a in enumerate(visible):
                for b in visible[i + 1:]:
                    assert not (a["x"] < b["x"]+b["w"] and
                        a["x"]+a["w"] > b["x"] and a["y"] < b["y"]+b["h"]
                        and a["y"]+a["h"] > b["y"]), "门店名称不能重叠"
            name = visible[0]["text"]
            page.locator(".fallback-marker .hotel-marker-name").filter(
                has_text=name).first.click()
            assert page.locator("#detailContent h2").inner_text() == name
            if width < 600:
                page.click('[data-detail-action="close"]')
            page.fill("#globalSearch", name)
            page.wait_for_timeout(300)
            assert page.locator(".fallback-marker .hotel-marker-name").count() == 1
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            print("PASS", atlas, width, "labels", len(visible))
            page.close()
    browser.close()
