import os
import time
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

os.makedirs('docs/screenshots', exist_ok=True)

options = Options()
options.add_argument('--headless=new')
options.add_argument('--window-size=1440,900')
options.add_argument('--force-device-scale-factor=2')

driver = webdriver.Chrome(options=options)

jobs_fixture = [
    {
        'jobId': '2eead0e5-2f3b-4105-9582-d6dfa85fbea7',
        'projectName': 'sample_buggy_repo',
        'bugReport': 'Function absolute_value(-5) returns -5 instead of 5',
        'createdAt': '2026-10-30T02:21:00Z',
        'status': 'COMPLETED',
        'stage': 'COMPLETED',
        'verdict': 'VERIFIED',
        'attemptCount': 2,
        'durationSeconds': 1.51,
        'modelId': 'mock-nvidia-nemotron-advanced'
    },
    {
        'jobId': '79cb5983-9839-430a-b845-0c6a82bae128',
        'projectName': 'calculator_service',
        'bugReport': 'Context mismatch error on revision attempt',
        'createdAt': '2026-10-30T02:18:00Z',
        'status': 'FAILED',
        'stage': 'COMPLETED',
        'verdict': 'FAILED',
        'attemptCount': 2,
        'durationSeconds': 2.30,
        'modelId': 'mock-nvidia-nemotron-reasoning'
    },
    {
        'jobId': '91ea892a-7f24-4715-92ce-f07717f623b7',
        'projectName': 'fixture_wrong_operator',
        'bugReport': 'Comparison operator <= inverted to >=',
        'createdAt': '2026-10-30T02:15:00Z',
        'status': 'COMPLETED',
        'stage': 'COMPLETED',
        'verdict': 'VERIFIED',
        'attemptCount': 1,
        'durationSeconds': 1.88,
        'modelId': 'mock-nvidia-nemotron-advanced'
    }
]

# 1. New Repair Page
driver.get('http://127.0.0.1:5173/')
time.sleep(1.5)
driver.execute_script('sessionStorage.setItem("proofpatch_session_jobs", JSON.stringify(arguments[0]));', jobs_fixture)
driver.save_screenshot('docs/screenshots/01_new_repair.png')
print('Captured 01_new_repair.png')

# 2. Jobs List Page
driver.get('http://127.0.0.1:5173/jobs')
time.sleep(1.5)
driver.save_screenshot('docs/screenshots/02_jobs_list.png')
print('Captured 02_jobs_list.png')

# 3. Verified Result Page
driver.get('http://127.0.0.1:5173/jobs/2eead0e5-2f3b-4105-9582-d6dfa85fbea7/result')
time.sleep(2)
driver.save_screenshot('docs/screenshots/03_result_verified.png')
print('Captured 03_result_verified.png')

# 4. Failed Result Page
driver.get('http://127.0.0.1:5173/jobs/79cb5983-9839-430a-b845-0c6a82bae128/result')
time.sleep(2)
driver.save_screenshot('docs/screenshots/04_result_failed.png')
print('Captured 04_result_failed.png')

# 5. Models & Roles Page
driver.get('http://127.0.0.1:5173/models')
time.sleep(1.5)
driver.save_screenshot('docs/screenshots/05_models.png')
print('Captured 05_models.png')

# 6. Security Boundaries Page
driver.get('http://127.0.0.1:5173/security')
time.sleep(1.5)
driver.save_screenshot('docs/screenshots/06_security.png')
print('Captured 06_security.png')

# 7. About Page
driver.get('http://127.0.0.1:5173/about')
time.sleep(1.5)
driver.save_screenshot('docs/screenshots/07_about.png')
print('Captured 07_about.png')

# 8. Mobile View (375x812)
driver.set_window_size(375, 812)
driver.get('http://127.0.0.1:5173/')
time.sleep(1.5)
driver.save_screenshot('docs/screenshots/08_mobile_view.png')
print('Captured 08_mobile_view.png')

driver.quit()
print('All screenshots captured successfully!')

