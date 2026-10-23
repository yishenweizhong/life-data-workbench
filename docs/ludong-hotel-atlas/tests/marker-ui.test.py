import os

from playwright.sync_api import sync_playwright


URL = os.environ.get(
    "LUDONG_ATLAS_URL",
    "http://127.0.0.1:4176/ludong-hotel-atlas/",
)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 960})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(URL, wait_until="domcontentloaded", timeout=60_000)
    page.wait_for_function("window.HOTEL_SEED && HOTEL_SEED.length === 387")
    page.wait_for_timeout(6_000)

    located = page.evaluate(
        "HOTEL_SEED.filter((h) => Number.isFinite(h.lng) && "
        "Number.isFinite(h.lat)).length"
    )
    missing_scores = page.evaluate(
        "HOTEL_SEED.filter((h) => h.operationScore === null).length"
    )
    assert located >= 320
    assert missing_scores == 58
    assert page.locator(".fallback-marker .hotel-pin-icon").count() == located
    assert page.locator(".marker-pin-value").count() == 0
    assert page.locator("#districtFilter").count() == 1
    assert page.locator("#cityFilter").count() == 1
    assert page.locator("#brandFilter").count() == 1
    assert page.locator("#providerFilter").count() == 1
    assert page.locator("#certificationFilter").count() == 1
    assert page.locator("#scoreAvailabilityFilter").count() == 1
    assert "2026-10-20" in page.locator("#sourceLabel").inner_text()
    assert page.locator("#metricHotels").inner_text() == "387"

    page.select_option("#scoreAvailabilityFilter", "经营分暂缺")
    page.wait_for_function(
        "() => document.querySelector('#resultCount').textContent.trim() === '58 家'"
    )
    assert page.locator("#resultCount").inner_text() == "58 家"

    page.select_option("#scoreAvailabilityFilter", "全部")
    page.select_option("#districtFilter", "青岛北片区")
    expected = page.evaluate(
        "HOTEL_SEED.filter((h) => h.district === '青岛北片区').length"
    )
    page.wait_for_function(
        "(count) => document.querySelector('#resultCount').textContent.trim() "
        "=== `${count} 家`",
        arg=expected,
    )
    assert page.locator("#resultCount").inner_text() == f"{expected} 家"
    assert not errors, f"unexpected page errors: {errors}"

    mobile = browser.new_page(viewport={"width": 390, "height": 844})
    mobile.goto(URL, wait_until="domcontentloaded", timeout=60_000)
    mobile.wait_for_function("window.HOTEL_SEED && HOTEL_SEED.length === 387")
    assert mobile.evaluate(
        "document.documentElement.scrollWidth <= document.documentElement.clientWidth"
    )
    mobile.click("#mobilePanelToggle")
    assert "open" in mobile.locator("#controlRail").get_attribute("class")
    mobile.click("#closeMobilePanel")

    browser.close()

print("PASS marker-ui.test.py")
