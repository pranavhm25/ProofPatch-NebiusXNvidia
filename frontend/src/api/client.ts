import type {
  CreateProjectResponse,
  CreateJobRequest,
  CreateJobResponse,
  JobStatusResponse,
  JobResult,
} from '../types/api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({
      error: { code: 'INTERNAL_ERROR', message: res.statusText, request_id: '' }
    }));
    throw body;
  }
  return res.json() as Promise<T>;
}

export async function uploadProject(file: File): Promise<CreateProjectResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    body: form,
  });
  return handleResponse<CreateProjectResponse>(res);
}

export async function createJob(payload: CreateJobRequest): Promise<CreateJobResponse> {
  const res = await fetch(`${BASE_URL}/api/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<CreateJobResponse>(res);
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`${BASE_URL}/api/jobs/${jobId}`);
  return handleResponse<JobStatusResponse>(res);
}

export async function getJobResult(jobId: string): Promise<JobResult> {
  const res = await fetch(`${BASE_URL}/api/jobs/${jobId}/result`);
  return handleResponse<JobResult>(res);
}

export function downloadUrl(jobId: string, format: 'patch' | 'zip'): string {
  return `${BASE_URL}/api/jobs/${jobId}/download?format=${format}`;
}
