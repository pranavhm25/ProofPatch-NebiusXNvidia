// ProofPatch API Types — mirrors BACKEND_SCHEMA.md contracts exactly

export type JobStatus =
  | 'QUEUED'
  | 'VALIDATING'
  | 'ANALYZING'
  | 'PLANNING'
  | 'PATCHING'
  | 'TESTING'
  | 'RETRYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'BLOCKED'
  | 'CANCELLED';

export type FinalVerdict = 'VERIFIED' | 'NOT_VERIFIED' | 'FAILED' | 'BLOCKED';

export type TestStatus = 'PASSED' | 'FAILED' | 'TIMED_OUT' | 'ERROR' | 'NOT_RUN' | 'NO_TESTS';

export type AttemptStatus =
  | 'PLANNED'
  | 'PATCH_REJECTED'
  | 'PATCH_APPLIED'
  | 'PATCH_APPLY_FAILED'
  | 'TESTED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'BLOCKED';

export type ErrorCode =
  | 'INVALID_ARCHIVE'
  | 'UNSUPPORTED_PROJECT'
  | 'UPLOAD_LIMIT_EXCEEDED'
  | 'EXTRACTED_SIZE_LIMIT_EXCEEDED'
  | 'ARCHIVE_PATH_REJECTED'
  | 'PROJECT_NOT_FOUND'
  | 'JOB_NOT_FOUND'
  | 'INVALID_BUG_REPORT'
  | 'PROVIDER_AUTH_ERROR'
  | 'PROVIDER_RATE_LIMIT'
  | 'PROVIDER_TIMEOUT'
  | 'MODEL_OUTPUT_INVALID'
  | 'PATCH_REJECTED'
  | 'PATCH_APPLY_FAILED'
  | 'SANDBOX_UNAVAILABLE'
  | 'SANDBOX_TIMEOUT'
  | 'TESTS_FAILED'
  | 'NO_TESTS_DISCOVERED'
  | 'EXPORT_FAILED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  request_id: string;
}

export interface ApiErrorResponse {
  error: ApiError;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface CreateProjectResponse {
  project_id: string;
  project_name: string;
  language: string;
  file_count: number;
  total_uncompressed_bytes: number;
  validation_status: 'VALID' | 'REJECTED';
  created_at: string;
}

// ─── Job ──────────────────────────────────────────────────────────────────────

export interface CreateJobRequest {
  project_id: string;
  bug_report: string;
  expected_behavior?: string;
  observed_behavior?: string;
  idempotency_key?: string;
}

export interface CreateJobResponse {
  job_id: string;
  status: JobStatus;
  created_at: string;
  status_url: string;
}

export interface JobEvent {
  timestamp: string;
  stage: string;
  message: string;
}

export interface JobListItem {
  job_id: string;
  project_id: string;
  project_name: string;
  bug_report: string;
  status: JobStatus;
  stage: string;
  verdict: FinalVerdict | null;
  attempt_count: number;
  model_id: string | null;
  duration_seconds: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface JobListResponse {
  total: number;
  jobs: JobListItem[];
}

export interface JobStatusResponse {
  job_id: string;
  status: JobStatus;
  stage: string;
  progress_percent: number;
  created_at: string;
  updated_at: string;
  terminal: boolean;
  events: JobEvent[];
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface TestResult {
  status: TestStatus;
  command_id: string;
  exit_code: number | null;
  duration_ms: number | null;
  tests_discovered: number | null;
  tests_passed: number | null;
  tests_failed: number | null;
  stdout: string;
  stderr: string;
  output_truncated: boolean;
}

export interface Attempt {
  attempt_number: number;
  status: AttemptStatus;
  patch_hash: string | null;
  changed_files: string[];
  test_result: TestResult | null;
}

export interface DiffInfo {
  available: boolean;
  unified_diff: string | null;
  changed_files: string[];
  download_patch_url: string | null;
  download_zip_url: string | null;
}

export interface ModelAttribution {
  provider: string;
  model_id: string;
  prompt_version: string;
}

export interface JobResult {
  job_id: string;
  status: JobStatus;
  verdict: FinalVerdict | null;
  summary: string;
  limitations: string[];
  model: ModelAttribution;
  attempts: Attempt[];
  diff: DiffInfo;
  completed_at: string | null;
}
