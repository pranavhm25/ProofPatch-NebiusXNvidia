import { http, HttpResponse } from 'msw';
import {
  mockProjectResponse,
  mockJobCreateResponse,
  mockJobStatusByStage,
  mockResultVerified,
  mockResultFailed,
  mockResultNotVerified,
  mockResultBlocked,
  mockJobListResponse,
  mockErrors,
} from './fixtures';

export const handlers = [
  // 1. Upload Project: POST /api/projects
  http.post('*/api/projects', () => {
    return HttpResponse.json(mockProjectResponse, { status: 201 });
  }),

  // 2. Create Job: POST /api/jobs
  http.post('*/api/jobs', async ({ request }) => {
    const body = (await request.json()) as { project_id?: string; bug_report?: string };

    if (!body?.project_id) {
      return HttpResponse.json({
        error: { code: 'PROJECT_NOT_FOUND', message: 'Project ID is required', request_id: 'req_val_1' },
      }, { status: 400 });
    }

    if (!body?.bug_report || !body.bug_report.trim()) {
      return HttpResponse.json({
        error: { code: 'INVALID_BUG_REPORT', message: 'Bug report description is required', request_id: 'req_val_2' },
      }, { status: 400 });
    }

    if (body.bug_report.length > 4000) {
      return HttpResponse.json({
        error: { code: 'INVALID_BUG_REPORT', message: 'Bug report exceeds 4,000 character limit', request_id: 'req_val_3' },
      }, { status: 422 });
    }

    return HttpResponse.json(mockJobCreateResponse, { status: 202 });
  }),

  // 3. Job Status: GET /api/jobs/:id
  http.get('*/api/jobs/:id', ({ params }) => {
    const { id } = params;
    if (id === 'non-existent' || id === 'missing' || id === 'job-nonexistent') {
      return HttpResponse.json(mockErrors.NOT_FOUND.body, { status: 404 });
    }
    if (id === 'expired') {
      return HttpResponse.json(mockErrors.EXPIRED.body, { status: 410 });
    }

    // Default to completed status or parameterized
    return HttpResponse.json(mockJobStatusByStage.COMPLETED, { status: 200 });
  }),

  // 4. Job Result: GET /api/jobs/:id/result
  http.get('*/api/jobs/:id/result', ({ params }) => {
    const { id } = params;
    if (id === 'job-failed' || id === 'failed' || id === 'job-fail-123') {
      return HttpResponse.json(mockResultFailed, { status: 200 });
    }
    if (id === 'job-notverified' || id === 'not-verified' || id === 'job-notverified-123') {
      return HttpResponse.json(mockResultNotVerified, { status: 200 });
    }
    if (id === 'job-blocked' || id === 'blocked' || id === 'job-blocked-123') {
      return HttpResponse.json(mockResultBlocked, { status: 200 });
    }
    if (id === 'non-existent' || id === 'missing' || id === 'job-nonexistent' || id === 'job-expired-123') {
      return HttpResponse.json(mockErrors.NOT_FOUND.body, { status: 404 });
    }
    if (id === 'expired') {
      return HttpResponse.json(mockErrors.EXPIRED.body, { status: 410 });
    }

    return HttpResponse.json(mockResultVerified, { status: 200 });
  }),

  // 5. Download Artifacts: GET /api/jobs/:id/download
  http.get('*/api/jobs/:id/download', ({ request, params }) => {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') ?? 'patch';
    const { id } = params;

    if (id === 'non-existent') {
      return HttpResponse.json(mockErrors.NOT_FOUND.body, { status: 404 });
    }

    if (format === 'zip') {
      return new HttpResponse(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="proofpatch_${String(id).slice(0, 8)}.zip"`,
        },
      });
    }

    return new HttpResponse('--- a/file.py\n+++ b/file.py\n@@ -1 +1 @@\n-old\n+new\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/x-diff',
        'Content-Disposition': `attachment; filename="proofpatch_${String(id).slice(0, 8)}.patch"`,
      },
    });
  }),

  // 6. List Jobs: GET /api/jobs
  http.get('*/api/jobs', ({ request }) => {
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');
    const verdictFilter = url.searchParams.get('verdict');
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

    let filtered = [...mockJobListResponse.jobs];
    if (statusFilter) {
      filtered = filtered.filter((j) => j.status === statusFilter);
    }
    if (verdictFilter) {
      filtered = filtered.filter((j) => j.verdict === verdictFilter);
    }

    return HttpResponse.json({
      total: filtered.length,
      limit,
      offset,
      jobs: filtered.slice(offset, offset + limit),
    }, { status: 200 });
  }),

  // 7. System Health: GET /health
  http.get('*/health', () => {
    return HttpResponse.json({
      status: 'ok',
      database: 'connected',
      version: '1.0.0',
    }, { status: 200 });
  }),
];
