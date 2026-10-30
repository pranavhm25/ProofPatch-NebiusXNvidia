import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const mockJobResultVerified = {
  job_id: '6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
  status: 'COMPLETED',
  verdict: 'VERIFIED',
  summary: 'The approved test command completed successfully and tests were discovered.',
  limitations: [
    'Passing tests do not prove that all possible defects have been eliminated.',
  ],
  model: {
    provider: 'Nebius Token Factory',
    model_id: 'nvidia/Nemotron-3-Ultra-550b-a55b',
    prompt_version: 'repair-v1',
  },
  attempts: [
    {
      attempt_number: 1,
      status: 'TESTED',
      patch_hash: 'sha256:4a3b8c...',
      changed_files: ['src/core.py'],
      test_result: {
        status: 'PASSED',
        command_id: 'pytest-default',
        exit_code: 0,
        duration_ms: 1240,
        tests_discovered: 8,
        tests_passed: 8,
        tests_failed: 0,
        stdout: '8 passed in 1.24s',
        stderr: '',
        output_truncated: false,
      },
    },
  ],
  diff: {
    available: true,
    unified_diff: '--- a/src/core.py\n+++ b/src/core.py\n@@ -1,2 +1,2 @@\n-def compute(): return 0\n+def compute(): return 42\n',
    changed_files: ['src/core.py'],
    download_patch_url: '/api/jobs/6f3f98ab-945e-4f53-bd6a-95c5e7b48f32/download?format=patch',
    download_zip_url: '/api/jobs/6f3f98ab-945e-4f53-bd6a-95c5e7b48f32/download?format=zip',
  },
  completed_at: '2026-10-30T12:01:20Z',
};

const mockJobListResponse = {
  total: 1,
  jobs: [
    {
      job_id: '6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
      project_name: 'sample-service',
      status: 'COMPLETED',
      verdict: 'VERIFIED',
      stage: 'Repair verified successfully against test suite',
      bug_report: 'Fix off-by-one error in pagination math.',
      created_at: '2026-10-30T12:01:00Z',
      attempt_count: 1,
      duration_seconds: 20,
      model_id: 'nvidia/Nemotron-3-Ultra-550b-a55b',
    },
  ],
};

test.describe('WCAG 2.1 AA Accessibility Pass', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/jobs/6f3f98ab-945e-4f53-bd6a-95c5e7b48f32/result', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockJobResultVerified),
      });
    });

    await page.route('**/api/jobs*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockJobListResponse),
      });
    });

    await page.route('**/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', database: 'ready', version: '1.0.0' }),
      });
    });
  });

  const routes = [
    { path: '/', name: 'New Repair Page' },
    { path: '/jobs', name: 'Job History Page' },
    { path: '/security', name: 'Security Guardrails Page' },
    { path: '/models', name: 'Supported Models Page' },
    { path: '/about', name: 'About & FAQ Page' },
    { path: '/jobs/6f3f98ab-945e-4f53-bd6a-95c5e7b48f32/result', name: 'Result Page' },
  ];

  for (const { path, name } of routes) {
    test(`${name} (${path}) has zero critical accessibility violations`, async ({ page }) => {
      await page.goto(path);
      // Wait for page hydration
      await page.waitForTimeout(500);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  }
});
