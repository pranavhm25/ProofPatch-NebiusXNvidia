import { describe, it, expect } from 'vitest';
import {
  uploadProject,
  createJob,
  getJobStatus,
  getJobResult,
  getJobs,
  getHealth,
  downloadUrl,
  ProofPatchApiError,
} from '../lib/api';
import { server } from './mocks/server';
import { http, HttpResponse } from 'msw';

describe('ProofPatch API Client (lib/api.ts)', () => {
  it('correctly constructs ProofPatchApiError instances', () => {
    const err = new ProofPatchApiError('Something went wrong', 'TEST_ERROR', 400, 'req-999', {
      detail: 'bad payload',
    });

    expect(err.name).toBe('ProofPatchApiError');
    expect(err.message).toBe('Something went wrong');
    expect(err.code).toBe('TEST_ERROR');
    expect(err.statusCode).toBe(400);
    expect(err.requestId).toBe('req-999');
    expect(err.details).toEqual({ detail: 'bad payload' });
  });

  describe('uploadProject', () => {
    it('rejects non-.zip archives without making a network call', async () => {
      const file = new File(['data'], 'test.tar.gz', { type: 'application/gzip' });
      await expect(uploadProject(file)).rejects.toThrow('Only .zip archives are accepted.');
    });

    it('uploads valid .zip project through MSW mock successfully', async () => {
      const file = new File(['valid zip data'], 'sample.zip', { type: 'application/zip' });
      const res = await uploadProject(file);

      expect(res.project_id).toBe('3b4a2a14-0b57-4b57-9b6f-82bfc4c19d9d');
      expect(res.project_name).toBe('sample-service');
      expect(res.language).toBe('python');
    });

    it('handles 413 archive too large error cleanly', async () => {
      server.use(
        http.post('*/api/projects', () => {
          return HttpResponse.json(
            {
              error: {
                code: 'ARCHIVE_TOO_LARGE',
                message: 'Archive exceeds 20 MB upload threshold',
                request_id: 'req-413',
              },
            },
            { status: 413 }
          );
        })
      );

      const file = new File(['huge data'], 'large.zip', { type: 'application/zip' });
      await expect(uploadProject(file)).rejects.toThrow(
        'Archive exceeds 20 MB upload threshold'
      );
    });
  });

  describe('createJob', () => {
    it('validates project_id and bug_report locally before request', async () => {
      await expect(createJob({ project_id: '', bug_report: 'Fix bug' })).rejects.toThrow(
        'Project ID is required'
      );

      await expect(
        createJob({ project_id: 'proj-123', bug_report: '   ' })
      ).rejects.toThrow('Bug report description is required');
    });

    it('creates job successfully through MSW mock', async () => {
      const res = await createJob({
        project_id: 'proj-sample-123',
        bug_report: 'Division by zero on zero quantity',
      });

      expect(res.job_id).toBe('6f3f98ab-945e-4f53-bd6a-95c5e7b48f32');
      expect(res.status).toBe('QUEUED');
      expect(res.created_at).toBeDefined();
    });

    it('handles 429 quota / rate limit errors cleanly', async () => {
      server.use(
        http.post('*/api/jobs', () => {
          return HttpResponse.json(
            {
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Nebius token quota exceeded. Please retry later.',
                request_id: 'req-429',
              },
            },
            { status: 429 }
          );
        })
      );

      await expect(
        createJob({
          project_id: 'proj-123',
          bug_report: 'Test quota limit',
        })
      ).rejects.toThrow(/Nebius token quota exceeded/i);
    });
  });

  describe('getJobStatus & getJobResult', () => {
    it('validates jobId parameter', async () => {
      await expect(getJobStatus('')).rejects.toThrow('Job ID is required');
      await expect(getJobResult('')).rejects.toThrow('Job ID is required');
    });

    it('fetches status and result for existing job', async () => {
      const status = await getJobStatus('6f3f98ab-945e-4f53-bd6a-95c5e7b48f32');
      expect(status.job_id).toBe('6f3f98ab-945e-4f53-bd6a-95c5e7b48f32');
      expect(status.status).toBe('COMPLETED');

      const result = await getJobResult('6f3f98ab-945e-4f53-bd6a-95c5e7b48f32');
      expect(result.job_id).toBe('6f3f98ab-945e-4f53-bd6a-95c5e7b48f32');
      expect(result.verdict).toBe('VERIFIED');
    });

    it('handles 404 for non-existent or expired jobs', async () => {
      await expect(getJobStatus('job-nonexistent')).rejects.toThrow(
        /The requested job was not found/i
      );

      await expect(getJobResult('job-nonexistent')).rejects.toThrow(
        /The requested job was not found/i
      );
    });
  });

  describe('getJobs', () => {
    it('fetches job list with query parameters', async () => {
      const res = await getJobs({ limit: 10, offset: 0, status: 'COMPLETED' });
      expect(res.jobs).toBeDefined();
      expect(Array.isArray(res.jobs)).toBe(true);
      expect(res.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getHealth', () => {
    it('fetches health status successfully', async () => {
      const health = await getHealth();
      expect(health.status).toBe('ok');
      expect(health.database).toBe('connected');
    });
  });

  describe('downloadUrl', () => {
    it('constructs correct download links for patch and zip', () => {
      expect(downloadUrl('job-123', 'patch')).toBe('/api/jobs/job-123/download?format=patch');
      expect(downloadUrl('job-123', 'zip')).toBe('/api/jobs/job-123/download?format=zip');
    });
  });
});
