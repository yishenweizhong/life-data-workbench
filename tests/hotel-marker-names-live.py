import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get("ATLAS_BASE", "http://127.0.0.1:4185")
OUT = Path("/tmp/hotel-marker-names-qa")
OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    for atlas, area in [("tianjin-hotel-atlas", "津南片区"),
                        ("ludong-hotel-atlas", "青岛北片区")]:
        for w, h in [(1440, 960), (390, 844)]:
            page = b.new_page(viewport={"width": w, "height": h})
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(f"{BASE}/{atlas}/", wait_until="domcontentloaded")
            page.wait_for_timeout(10000)
            if w < 600:
                page.click("#mobilePanelToggle")
            page.select_option("#districtFilter", area)
            if w < 600:
                page.click("#closeMobilePanel")
            page.wait_for_timeout(1500)
            names = page.locator(".amap-hotel-marker .hotel-marker-name")
            visible = names.evaluate_all("""nodes=>nodes.filter(n=>
                getComputedStyle(n).visibility === 'visible').length""")
            assert visible > 0, "真实高德地图应显示门店名称"
            assert not errors, errors
            assert page.locator(".hotel-pin-icon text").count() == 0
            page.screenshot(path=str(OUT / f"{atlas}-{w}.png"))
            print("PASS live", atlas, w, "visible names", visible)
            page.close()
    b.close()
