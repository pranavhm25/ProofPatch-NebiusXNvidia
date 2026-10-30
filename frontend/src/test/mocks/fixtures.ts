import type {
  CreateProjectResponse,
  CreateJobResponse,
  JobStatusResponse,
  JobResult,
  JobListResponse,
  ApiErrorResponse,
} from '../../types/api';

export const mockProjectResponse: CreateProjectResponse = {
  project_id: '3b4a2a14-0b57-4b57-9b6f-82bfc4c19d9d',
  project_name: 'sample-service',
  language: 'python',
  file_count: 18,
  total_uncompressed_bytes: 42891,
  validation_status: 'VALID',
  created_at: '2026-10-30T12:00:00Z',
};

export const mockJobCreateResponse: CreateJobResponse = {
  job_id: '6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
  status: 'QUEUED',
  created_at: '2026-10-30T12:01:00Z',
  status_url: '/api/jobs/6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
};

export const mockJobStatusByStage: Record<string, JobStatusResponse> = {
  QUEUED: {
    job_id: '6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
    status: 'QUEUED',
    stage: 'Queued for execution',
    progress_percent: 5,
    created_at: '2026-10-30T12:01:00Z',
    updated_at: '2026-10-30T12:01:01Z',
    terminal: false,
    events: [
      { timestamp: '2026-10-30T12:01:01Z', stage: 'QUEUED', message: 'Job accepted and queued.' },
    ],
  },
  VALIDATING: {
    job_id: '6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
    status: 'VALIDATING',
    stage: 'Validating repository integrity and security boundaries',
    progress_percent: 15,
    created_at: '2026-10-30T12:01:00Z',
    updated_at: '2026-10-30T12:01:02Z',
    terminal: false,
    events: [
      { timestamp: '2026-10-30T12:01:01Z', stage: 'QUEUED', message: 'Job accepted and queued.' },
      { timestamp: '2026-10-30T12:01:02Z', stage: 'VALIDATING', message: 'Scanning for path traversals and secrets.' },
    ],
  },
  ANALYZING: {
    job_id: '6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
    status: 'ANALYZING',
    stage: 'Inspecting repository context and test suites',
    progress_percent: 30,
    created_at: '2026-10-30T12:01:00Z',
    updated_at: '2026-10-30T12:01:04Z',
    terminal: false,
    events: [
      { timestamp: '2026-10-30T12:01:02Z', stage: 'VALIDATING', message: 'Scanning for path traversals and secrets.' },
      { timestamp: '2026-10-30T12:01:04Z', stage: 'ANALYZING', message: 'Repository context mapped (18 files).' },
    ],
  },
  PLANNING: {
    job_id: '6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
    status: 'PLANNING',
    stage: 'Synthesizing repair plan with Nemotron reasoning model',
    progress_percent: 50,
    created_at: '2026-10-30T12:01:00Z',
    updated_at: '2026-10-30T12:01:08Z',
    terminal: false,
    events: [
      { timestamp: '2026-10-30T12:01:04Z', stage: 'ANALYZING', message: 'Repository context mapped.' },
      { timestamp: '2026-10-30T12:01:08Z', stage: 'PLANNING', message: 'Repair hypothesis generated.' },
    ],
  },
  PATCHING: {
    job_id: '6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
    status: 'PATCHING',
    stage: 'Applying validated patch to isolated disposable working copy',
    progress_percent: 65,
    created_at: '2026-10-30T12:01:00Z',
    updated_at: '2026-10-30T12:01:10Z',
    terminal: false,
    events: [
      { timestamp: '2026-10-30T12:01:08Z', stage: 'PLANNING', message: 'Repair hypothesis generated.' },
      { timestamp: '2026-10-30T12:01:10Z', stage: 'PATCHING', message: 'Unified diff validated and applied.' },
    ],
  },
  TESTING: {
    job_id: '6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
    status: 'TESTING',
    stage: 'Executing pytest in sandboxed subprocess with scrubbed environment',
    progress_percent: 85,
    created_at: '2026-10-30T12:01:00Z',
    updated_at: '2026-10-30T12:01:14Z',
    terminal: false,
    events: [
      { timestamp: '2026-10-30T12:01:10Z', stage: 'PATCHING', message: 'Unified diff applied.' },
      { timestamp: '2026-10-30T12:01:14Z', stage: 'TESTING', message: 'Running pytest tests/test_core.py.' },
    ],
  },
  RETRYING: {
    job_id: '6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
    status: 'RETRYING',
    stage: 'Revising patch using test failure evidence (bounded retry 1 of 1)',
    progress_percent: 70,
    created_at: '2026-10-30T12:01:00Z',
    updated_at: '2026-10-30T12:01:16Z',
    terminal: false,
    events: [
      { timestamp: '2026-10-30T12:01:14Z', stage: 'TESTING', message: 'Attempt 1 tests failed (exit code 1).' },
      { timestamp: '2026-10-30T12:01:16Z', stage: 'RETRYING', message: 'Escalating to advanced model with failure traceback.' },
    ],
  },
  COMPLETED: {
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
  },
  FAILED: {
    job_id: '6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
    status: 'FAILED',
    stage: 'Test suite failed after bounded retry',
    progress_percent: 100,
    created_at: '2026-10-30T12:01:00Z',
    updated_at: '2026-10-30T12:01:22Z',
    terminal: true,
    events: [
      { timestamp: '2026-10-30T12:01:16Z', stage: 'RETRYING', message: 'Retrying repair.' },
      { timestamp: '2026-10-30T12:01:22Z', stage: 'FAILED', message: 'Verdict FAILED established.' },
    ],
  },
  BLOCKED: {
    job_id: '6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
    status: 'BLOCKED',
    stage: 'Model provider quota or budget exhausted (HTTP 402)',
    progress_percent: 100,
    created_at: '2026-10-30T12:01:00Z',
    updated_at: '2026-10-30T12:01:05Z',
    terminal: true,
    events: [
      { timestamp: '2026-10-30T12:01:05Z', stage: 'BLOCKED', message: 'Token Factory quota exhausted.' },
    ],
  },
};

export const mockResultVerified: JobResult = {
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

export const mockResultFailed: JobResult = {
  job_id: '6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
  status: 'FAILED',
  verdict: 'FAILED',
  summary: 'Tests failed after bounded retry.',
  limitations: ['The candidate patch did not satisfy all test assertions.'],
  model: {
    provider: 'Nebius Token Factory',
    model_id: 'nvidia/Nemotron-3-Ultra-550b-a55b',
    prompt_version: 'repair-v1',
  },
  attempts: [
    {
      attempt_number: 1,
      status: 'TESTED',
      patch_hash: 'sha256:bad1...',
      changed_files: ['src/core.py'],
      test_result: {
        status: 'FAILED',
        command_id: 'pytest-default',
        exit_code: 1,
        duration_ms: 980,
        tests_discovered: 5,
        tests_passed: 4,
        tests_failed: 1,
        stdout: 'FAILED tests/test_core.py::test_negative - AssertionError',
        stderr: '',
        output_truncated: false,
      },
    },
  ],
  diff: {
    available: true,
    unified_diff: '--- a/src/core.py\n+++ b/src/core.py\n@@ -1,2 +1,2 @@\n-return 0\n+return -1\n',
    changed_files: ['src/core.py'],
    download_patch_url: '/api/jobs/6f3f98ab-945e-4f53-bd6a-95c5e7b48f32/download?format=patch',
    download_zip_url: null,
  },
  completed_at: '2026-10-30T12:01:22Z',
};

export const mockResultNotVerified: JobResult = {
  job_id: '6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
  status: 'COMPLETED',
  verdict: 'NOT_VERIFIED',
  summary: 'Code executed cleanly, but no automated tests were discovered in the repository.',
  limitations: ['Verification requires automated test execution; zero tests were discovered.'],
  model: {
    provider: 'Nebius Token Factory',
    model_id: 'nvidia/Nemotron-3-Ultra-550b-a55b',
    prompt_version: 'repair-v1',
  },
  attempts: [
    {
      attempt_number: 1,
      status: 'TESTED',
      patch_hash: 'sha256:zerotests...',
      changed_files: ['src/core.py'],
      test_result: {
        status: 'NO_TESTS',
        command_id: 'pytest-default',
        exit_code: 5,
        duration_ms: 320,
        tests_discovered: 0,
        tests_passed: 0,
        tests_failed: 0,
        stdout: 'collected 0 items / no tests ran',
        stderr: '',
        output_truncated: false,
      },
    },
  ],
  diff: {
    available: true,
    unified_diff: '--- a/src/core.py\n+++ b/src/core.py\n@@ -1,1 +1,1 @@\n-pass\n+return 1\n',
    changed_files: ['src/core.py'],
    download_patch_url: '/api/jobs/6f3f98ab-945e-4f53-bd6a-95c5e7b48f32/download?format=patch',
    download_zip_url: '/api/jobs/6f3f98ab-945e-4f53-bd6a-95c5e7b48f32/download?format=zip',
  },
  completed_at: '2026-10-30T12:01:15Z',
};

export const mockResultBlocked: JobResult = {
  job_id: '6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
  status: 'BLOCKED',
  verdict: 'BLOCKED',
  summary: 'Execution halted: Provider rate limit or token budget exhausted (HTTP 402/429).',
  limitations: ['Execution could not proceed due to upstream provider quotas.'],
  model: {
    provider: 'Nebius Token Factory',
    model_id: 'nvidia/Nemotron-3-Ultra-550b-a55b',
    prompt_version: 'repair-v1',
  },
  attempts: [],
  diff: {
    available: false,
    unified_diff: null,
    changed_files: [],
    download_patch_url: null,
    download_zip_url: null,
  },
  completed_at: '2026-10-30T12:01:05Z',
};

export const mockResultWithRetry: JobResult = {
  job_id: '6f3f98ab-945e-4f53-bd6a-95c5e7b48f32',
  status: 'COMPLETED',
  verdict: 'VERIFIED',
  summary: 'Defect repaired successfully on attempt 2 following test evidence revision.',
  limitations: ['Passing tests do not prove absence of unasserted bugs.'],
  model: {
    provider: 'Nebius Token Factory',
    model_id: 'nvidia/Nemotron-3-Ultra-550b-a55b',
    prompt_version: 'repair-v1',
  },
  attempts: [
    {
      attempt_number: 1,
      status: 'TESTED',
      patch_hash: 'sha256:attempt1...',
      changed_files: ['src/calculator.py'],
      test_result: {
        status: 'FAILED',
        command_id: 'pytest-default',
        exit_code: 1,
        duration_ms: 1100,
        tests_discovered: 2,
        tests_passed: 1,
        tests_failed: 1,
        stdout: 'FAILED tests/test_calculator.py::test_neg - AssertionError: assert -5 == 5',
        stderr: '',
        output_truncated: false,
      },
    },
    {
      attempt_number: 2,
      status: 'TESTED',
      patch_hash: 'sha256:attempt2...',
      changed_files: ['src/calculator.py'],
      test_result: {
        status: 'PASSED',
        command_id: 'pytest-default',
        exit_code: 0,
        duration_ms: 1050,
        tests_discovered: 2,
        tests_passed: 2,
        tests_failed: 0,
        stdout: '2 passed in 1.05s',
        stderr: '',
        output_truncated: false,
      },
    },
  ],
  diff: {
    available: true,
    unified_diff: '--- a/src/calculator.py\n+++ b/src/calculator.py\n@@ -1,2 +1,2 @@\n-def abs(n): return n\n+def abs(n): return -n if n < 0 else n\n',
    changed_files: ['src/calculator.py'],
    download_patch_url: '/api/jobs/6f3f98ab-945e-4f53-bd6a-95c5e7b48f32/download?format=patch',
    download_zip_url: '/api/jobs/6f3f98ab-945e-4f53-bd6a-95c5e7b48f32/download?format=zip',
  },
  completed_at: '2026-10-30T12:01:25Z',
};

export const mockJobListResponse: JobListResponse = {
  total: 4,
  jobs: [
    {
      job_id: 'job-verified-001',
      project_id: 'proj-1',
      project_name: 'calculator-service',
      bug_report: 'absolute_value(-5) returns -5 instead of 5',
      status: 'COMPLETED',
      stage: 'Repair verified successfully',
      verdict: 'VERIFIED',
      attempt_count: 1,
      model_id: 'nvidia/Nemotron-3-Ultra-550b-a55b',
      duration_seconds: 12.4,
      created_at: '2026-10-30T10:00:00Z',
      completed_at: '2026-10-30T10:00:12Z',
    },
    {
      job_id: 'job-failed-002',
      project_id: 'proj-2',
      project_name: 'parser-module',
      bug_report: 'Parser crashes on empty input tokens',
      status: 'FAILED',
      stage: 'Tests failed after retry',
      verdict: 'FAILED',
      attempt_count: 2,
      model_id: 'nvidia/Nemotron-3-Ultra-550b-a55b',
      duration_seconds: 24.1,
      created_at: '2026-10-30T11:00:00Z',
      completed_at: '2026-10-30T11:00:24Z',
    },
    {
      job_id: 'job-running-003',
      project_id: 'proj-3',
      project_name: 'auth-service',
      bug_report: 'Token expiration window too narrow',
      status: 'TESTING',
      stage: 'Running pytest in sandbox',
      verdict: null,
      attempt_count: 1,
      model_id: 'nvidia/Nemotron-3-Ultra-550b-a55b',
      duration_seconds: null,
      created_at: '2026-10-30T12:00:00Z',
      completed_at: null,
    },
    {
      job_id: 'job-notverified-004',
      project_id: 'proj-4',
      project_name: 'script-repo',
      bug_report: 'Script prints wrong exit string',
      status: 'COMPLETED',
      stage: 'Zero tests discovered',
      verdict: 'NOT_VERIFIED',
      attempt_count: 1,
      model_id: 'nvidia/Nemotron-3-Ultra-550b-a55b',
      duration_seconds: 4.8,
      created_at: '2026-10-30T13:00:00Z',
      completed_at: '2026-10-30T13:00:05Z',
    },
  ],
};

export const mockErrors: Record<string, { status: number; body: ApiErrorResponse }> = {
  BAD_ARCHIVE: {
    status: 400,
    body: {
      error: {
        code: 'INVALID_ARCHIVE',
        message: 'The submitted file is not a valid ZIP archive.',
        request_id: 'req_err_400',
      },
    },
  },
  UPLOAD_TOO_LARGE: {
    status: 413,
    body: {
      error: {
        code: 'UPLOAD_LIMIT_EXCEEDED',
        message: 'The uploaded file exceeds the 20 MB size limit.',
        request_id: 'req_err_413',
      },
    },
  },
  NOT_FOUND: {
    status: 404,
    body: {
      error: {
        code: 'JOB_NOT_FOUND',
        message: 'The requested job was not found.',
        request_id: 'req_err_404',
      },
    },
  },
  EXPIRED: {
    status: 410,
    body: {
      error: {
        code: 'JOB_NOT_FOUND',
        message: 'This repair job and its workspace artifacts have expired (60-minute cleanup policy).',
        request_id: 'req_err_410',
      },
    },
  },
  RATE_LIMITED: {
    status: 429,
    body: {
      error: {
        code: 'PROVIDER_RATE_LIMIT',
        message: 'The model provider rate limit has been reached. Please pause before submitting.',
        request_id: 'req_err_429',
      },
    },
  },
  BUDGET_EXHAUSTED: {
    status: 402,
    body: {
      error: {
        code: 'PROVIDER_RATE_LIMIT',
        message: 'Model provider quota exhausted (HTTP 402). Execution halted immediately.',
        request_id: 'req_err_402',
      },
    },
  },
  INTERNAL: {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected internal error occurred on the server.',
        request_id: 'req_err_500',
      },
    },
  },
};
