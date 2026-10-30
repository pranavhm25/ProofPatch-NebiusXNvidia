import { test, expect } from '@playwright/test';

const mockProjectResponse = {
  project_id: '3b4a2a14-0b57-4b57-9b6f-82bfc4c19d9d',
  project_name: 'sample_service.zip',
  language: 'python',
  file_count: 18,
  total_uncompressed_bytes: 42891,
  validation_status: 'VALID',
  created_at: '2026-10-30T12:00:00Z',
};

const mockJobCreateResponse = {
  job_id: '6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
  status: 'QUEUED',
  created_at: '2026-10-30T12:01:00Z',
  status_url: '/api/jobs/6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
};

const mockJobStatusCompleted = {
  job_id: '6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
  status: 'COMPLETED',
  stage: 'Repair verified successfully against test suite',
  progress_percent: 100,
  created_at: '2026-10-30T12:01:00Z',
  updated_at: '2026-10-30T12:01:20Z',
  terminal: true,
  events: [
    { timestamp: '2026-10-30T12:01:14Z', stage: 'TESTING', message: 'Pytest passed with exit code 0.' },
    { timestamp: '2026-10-30T12:01:20Z', stage: 'COMPLETED', message: 'Verdict VERIFIED established.' },
  ],
};

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

test.describe('Mocked E2E User Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept backend API requests
    await page.route('**/api/projects', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(mockProjectResponse),
      });
    });

    await page.route('**/sample_buggy_repo.zip', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/zip',
        body: Buffer.from('PK\x05\x06' + '\x00'.repeat(18)),
      });
    });

    await page.route('**/api/jobs/6f3f98ab-945e-4f53-bd6a-95c5e7b48f32/result', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockJobResultVerified),
      });
    });

    await page.route('**/api/jobs/6f3f98ab-945e-4f53-bd6a-95c5e7b48f32', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockJobStatusCompleted),
      });
    });

    await page.route('**/api/jobs?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockJobListResponse),
      });
    });

    await page.route('**/api/jobs', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(mockJobCreateResponse),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockJobListResponse),
        });
      }
    });

    await page.route('**/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', database: 'ready', version: '1.0.0' }),
      });
    });
  });

  test('Full happy path: upload zip -> fill bug report -> progress -> result page with diff', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // 1. Visit root
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'New Repair', exact: true })).toBeVisible();

    // 2. Click "Try Sample Bug" (pre-populates repo and defect description)
    await page.getByRole('button', { name: 'Try Sample Bug' }).click();

    // 3. Submit button should now be enabled
    const submitBtn = page.getByRole('button', { name: 'Analyze and Repair' });
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.click();

    // 4. Should navigate to progress or directly result
    await page.waitForURL(/.*(\/jobs\/6f3f98ab-945e-4f53-bd6a-95c5e7b48f32).*/);

    // Wait until result page displays
    await expect(page.getByRole('heading', { name: 'Repair Verification Result' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('All tests passed cleanly inside the sandbox')).toBeVisible();

    // Assert diff content renders
    await expect(page.getByText('def compute(): return 42')).toBeVisible();

    // Assert test summary and download buttons
    await expect(page.getByText('8 passed in 1.24s').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download .patch' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download patched .zip' })).toBeVisible();

    // Assert no console errors or uncaught exceptions
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Jobs history page renders with stats, tabs, and table', async ({ page }) => {
    await page.goto('/jobs');
    await expect(page.getByRole('heading', { name: 'Repair Jobs', exact: true })).toBeVisible();
    await expect(page.getByText('Fix off-by-one error in pagination math.')).toBeVisible();
    await expect(page.getByRole('tab', { name: /All Jobs/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Verified/ })).toBeVisible();
  });

  test('Static info pages render correctly: Security, Models, and About', async ({ page }) => {
    // Security page
    await page.goto('/security');
    await expect(page.getByRole('heading', { name: 'Security & Sandbox Boundaries', exact: true })).toBeVisible();
    await expect(page.getByText('Environment Variable Scrubbing')).toBeVisible();

    // Models page
    await page.goto('/models');
    await expect(page.getByRole('heading', { name: 'Models & Role Architecture', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'nvidia/Nemotron-3-Ultra-550b-a55b' })).toBeVisible();

    // About page
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: 'About ProofPatch', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The Philosophy: Evidence Over Assertion' })).toBeVisible();
  });
});
