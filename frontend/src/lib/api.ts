import type {
  CreateProjectResponse,
  CreateJobRequest,
  CreateJobResponse,
  JobStatusResponse,
  JobResult,
  ApiErrorResponse,
} from '../types/api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export class ProofPatchApiError extends Error {
  code: string;
  details?: Record<string, unknown>;
  requestId: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode: number, requestId = '', details?: Record<string, unknown>) {
    super(message);
    this.name = 'ProofPatchApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.details = details;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorBody: ApiErrorResponse | null = null;
    try {
      errorBody = await res.json();
    } catch {
      // Non-JSON or network body
    }

    const code = errorBody?.error?.code ?? (res.status === 404 ? 'JOB_NOT_FOUND' : 'INTERNAL_ERROR');
    const message = errorBody?.error?.message ?? `Request failed with status ${res.status}: ${res.statusText}`;
    const requestId = errorBody?.error?.request_id ?? '';
    const details = errorBody?.error?.details;

    throw new ProofPatchApiError(message, code, res.status, requestId, details);
  }

  const data = await res.json();
  if (data === null || data === undefined) {
    throw new ProofPatchApiError('Empty response received from server', 'INTERNAL_ERROR', res.status);
  }
  return data as T;
}

export async function uploadProject(file: File): Promise<CreateProjectResponse> {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    throw new ProofPatchApiError('Only .zip archives are accepted.', 'INVALID_ARCHIVE', 400);
  }
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    body: form,
  });
  return handleResponse<CreateProjectResponse>(res);
}

export async function createJob(payload: CreateJobRequest): Promise<CreateJobResponse> {
  if (!payload.project_id) {
    throw new ProofPatchApiError('Project ID is required', 'PROJECT_NOT_FOUND', 400);
  }
  if (!payload.bug_report || !payload.bug_report.trim()) {
    throw new ProofPatchApiError('Bug report description is required', 'INVALID_BUG_REPORT', 400);
  }

  const res = await fetch(`${BASE_URL}/api/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<CreateJobResponse>(res);
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  if (!jobId) {
    throw new ProofPatchApiError('Job ID is required', 'JOB_NOT_FOUND', 400);
  }
  const res = await fetch(`${BASE_URL}/api/jobs/${encodeURIComponent(jobId)}`);
  return handleResponse<JobStatusResponse>(res);
}

export async function getJobResult(jobId: string): Promise<JobResult> {
  if (!jobId) {
    throw new ProofPatchApiError('Job ID is required', 'JOB_NOT_FOUND', 400);
  }
  const res = await fetch(`${BASE_URL}/api/jobs/${encodeURIComponent(jobId)}/result`);
  return handleResponse<JobResult>(res);
}

export async function getHealth(): Promise<{ status: string; database: string; version: string }> {
  const res = await fetch(`${BASE_URL}/health`);
  return handleResponse<{ status: string; database: string; version: string }>(res);
}

export function downloadUrl(jobId: string, format: 'patch' | 'zip'): string {
  return `${BASE_URL}/api/jobs/${encodeURIComponent(jobId)}/download?format=${format}`;
}
