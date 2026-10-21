from playwright.sync_api import sync_playwright


URL = "http://127.0.0.1:4173/"


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
        "every AMap hotel marker should use the red location-pin icon"
    )
    assert page.locator(".fallback-marker .hotel-pin-icon").count() == 169, (
        "the fallback map should use the same red location-pin icon"
    )

    pin_fill = page.locator(".hotel-pin-icon path").first.get_attribute("fill")
    assert pin_fill == "#d92d20", f"expected red pin fill, got {pin_fill}"

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
