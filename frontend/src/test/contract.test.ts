import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as api from '../lib/api';

interface OpenAPISchema {
  paths: Record<string, Record<string, { operationId?: string; responses?: Record<string, unknown> }>>;
  components?: {
    schemas?: Record<string, { properties?: Record<string, unknown>; required?: string[] }>;
  };
}

describe('API Contract Drift Test', () => {
  const openApiPath = path.resolve(__dirname, '../../../backend/openapi.json');

  it('backend openapi.json exists and is valid OpenAPI 3', () => {
    expect(fs.existsSync(openApiPath)).toBe(true);
    const raw = fs.readFileSync(openApiPath, 'utf-8');
    const openapi: OpenAPISchema = JSON.parse(raw);
    expect(openapi.paths).toBeDefined();
    expect(Object.keys(openapi.paths).length).toBeGreaterThanOrEqual(5);
  });

  it('all required frontend API endpoints exist in backend OpenAPI specification', () => {
    const raw = fs.readFileSync(openApiPath, 'utf-8');
    const openapi: OpenAPISchema = JSON.parse(raw);

    const expectedEndpoints = [
      '/health',
      '/api/projects',
      '/api/jobs',
      '/api/jobs/{job_id}',
      '/api/jobs/{job_id}/result',
      '/api/jobs/{job_id}/download',
    ];

    for (const ep of expectedEndpoints) {
      expect(openapi.paths).toHaveProperty(ep);
    }
  });

  it('CreateProjectResponse schema matches frontend type fields', () => {
    const openapi: OpenAPISchema = JSON.parse(fs.readFileSync(openApiPath, 'utf-8'));
    const props = Object.keys(openapi.components?.schemas?.CreateProjectResponse?.properties ?? {});
    const expected = ['project_id', 'project_name', 'language', 'file_count', 'total_uncompressed_bytes', 'validation_status', 'created_at'];

    for (const field of expected) {
      expect(props).toContain(field);
    }
  });

  it('CreateJobRequest schema matches frontend type fields', () => {
    const openapi: OpenAPISchema = JSON.parse(fs.readFileSync(openApiPath, 'utf-8'));
    const props = Object.keys(openapi.components?.schemas?.CreateJobRequest?.properties ?? {});
    const expected = ['project_id', 'bug_report'];

    for (const field of expected) {
      expect(props).toContain(field);
    }
  });

  it('CreateJobResponse schema matches frontend type fields', () => {
    const openapi: OpenAPISchema = JSON.parse(fs.readFileSync(openApiPath, 'utf-8'));
    const props = Object.keys(openapi.components?.schemas?.CreateJobResponse?.properties ?? {});
    const expected = ['job_id', 'status', 'created_at', 'status_url'];

    for (const field of expected) {
      expect(props).toContain(field);
    }
  });

  it('JobStatusResponse schema matches frontend type fields', () => {
    const openapi: OpenAPISchema = JSON.parse(fs.readFileSync(openApiPath, 'utf-8'));
    const props = Object.keys(openapi.components?.schemas?.JobStatusResponse?.properties ?? {});
    const expected = ['job_id', 'status', 'stage', 'progress_percent', 'created_at', 'updated_at', 'terminal', 'events'];

    for (const field of expected) {
      expect(props).toContain(field);
    }
  });

  it('JobResultResponse schema matches frontend JobResult fields', () => {
    const openapi: OpenAPISchema = JSON.parse(fs.readFileSync(openApiPath, 'utf-8'));
    const props = Object.keys(openapi.components?.schemas?.JobResultResponse?.properties ?? {});
    const expected = ['job_id', 'status', 'verdict', 'summary', 'limitations', 'model', 'attempts', 'diff', 'completed_at'];

    for (const field of expected) {
      expect(props).toContain(field);
    }
  });

  it('JobListItem and JobListResponse schemas match frontend fields', () => {
    const openapi: OpenAPISchema = JSON.parse(fs.readFileSync(openApiPath, 'utf-8'));
    const listProps = Object.keys(openapi.components?.schemas?.JobListResponse?.properties ?? {});
    expect(listProps).toContain('total');
    expect(listProps).toContain('jobs');

    const itemProps = Object.keys(openapi.components?.schemas?.JobListItem?.properties ?? {});
    const expectedItemFields = [
      'job_id',
      'project_id',
      'project_name',
      'bug_report',
      'status',
      'stage',
      'attempt_count',
      'created_at',
    ];
    for (const field of expectedItemFields) {
      expect(itemProps).toContain(field);
    }
  });

  it('client export functions exist for all core operations', () => {
    expect(typeof api.uploadProject).toBe('function');
    expect(typeof api.createJob).toBe('function');
    expect(typeof api.getJobStatus).toBe('function');
    expect(typeof api.getJobResult).toBe('function');
    expect(typeof api.getJobs).toBe('function');
    expect(typeof api.getHealth).toBe('function');
    expect(typeof api.downloadUrl).toBe('function');
  });
});
