from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    page.goto('http://127.0.0.1:5173')
    
    # Test Scene 1 locators
    assert page.get_by_role("heading", name="New Repair").first.is_visible()
    assert page.get_by_text("Submit a Python repository archive").first.is_visible()
    assert page.get_by_text("Python MVP").first.is_visible()
    print("Scene 1 locators verified!")

    # Test Scene 2 locators
    assert page.get_by_text("Isolated Workspace & Retention Policy").first.is_visible()
    assert page.locator('nav a[href="/"]').first.is_visible()
    assert page.locator('nav a[href="/jobs"]').first.is_visible()
    assert page.locator('nav a[href="/models"]').first.is_visible()
    assert page.locator('nav a[href="/security"]').first.is_visible()
    print("Scene 2 locators verified!")

    # Test Security page
    page.goto('http://127.0.0.1:5173/security')
    assert page.get_by_text("Security & Sandbox Boundaries").first.is_visible()
    print("Security locators verified!")

    # Test Models page
    page.goto('http://127.0.0.1:5173/models')
    assert page.get_by_text("Models & Role Architecture").first.is_visible()
    assert page.get_by_text("Planning & Source Inspection").first.is_visible()
    assert page.get_by_text("Unified Diff Patch Generation").first.is_visible()
    assert page.get_by_text("Bounded Retry & Failure Revision").first.is_visible()
    print("Models locators verified!")

    browser.close()
