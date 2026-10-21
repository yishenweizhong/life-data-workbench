import os

from playwright.sync_api import sync_playwright


URL = os.environ.get("HOTEL_ATLAS_URL", "http://127.0.0.1:4173/")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 960})
    page.goto(URL, wait_until="domcontentloaded", timeout=60_000)
    page.wait_for_selector(".amap-maps", timeout=15_000)
    page.wait_for_timeout(1_500)

    markers = page.locator(".amap-hotel-marker")
    assert markers.count() == 169, (
        f"expected 169 visible hotel markers, got {markers.count()}"
    )
    assert page.locator(".amap-hotel-marker .hotel-pin-icon").count() == 169, (
        "every AMap hotel marker should use the text-free colored location-pin icon"
    )
    assert page.locator(".fallback-marker .hotel-pin-icon").count() == 169, (
        "the fallback map should use the same text-free location-pin icon"
    )

    assert page.locator(".marker-pin-value").count() == 0, (
        "map pins should not contain derived status letters"
    )
    assert page.locator("#tierFilter").count() == 0
    assert page.locator("#statusFilter").count() == 0
    assert page.locator("#certificationFilter").count() == 1
    assert page.locator("#markerMetric option").count() == 2
    assert "2026-10-20" in page.locator("#sourceLabel").inner_text()

    page.select_option("#providerFilter", "北京昱海黑科技有限公司")
    page.wait_for_function(
        "() => document.querySelectorAll('.amap-hotel-marker').length === 39"
    )
    assert page.locator("#resultCount").inner_text() == "39 家"
    assert markers.count() == 39, "provider filter should hide all other map markers"

    page.select_option("#providerFilter", "全部")
    page.wait_for_function(
        "() => document.querySelectorAll('.amap-hotel-marker').length === 169"
    )
    assert markers.count() == 169, "all providers should restore every map marker"

    browser.close()

print("PASS marker-ui.test.py")
