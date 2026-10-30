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
  http.post('*/api/projects', async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return HttpResponse.json(mockErrors.BAD_ARCHIVE.body, { status: 400 });
    }

    const fileName = (file as File).name;
    if (!fileName.toLowerCase().endsWith('.zip')) {
      return HttpResponse.json(mockErrors.BAD_ARCHIVE.body, { status: 400 });
    }

    if ((file as File).size > 20 * 1024 * 1024) {
      return HttpResponse.json(mockErrors.UPLOAD_TOO_LARGE.body, { status: 413 });
    }

    return HttpResponse.json({
      ...mockProjectResponse,
      project_name: fileName.replace(/\.zip$/i, ''),
    }, { status: 201 });
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
    if (id === 'non-existent' || id === 'missing') {
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
    if (id === 'job-failed' || id === 'failed') {
      return HttpResponse.json(mockResultFailed, { status: 200 });
    }
    if (id === 'job-notverified' || id === 'not-verified') {
      return HttpResponse.json(mockResultNotVerified, { status: 200 });
    }
    if (id === 'job-blocked' || id === 'blocked') {
      return HttpResponse.json(mockResultBlocked, { status: 200 });
    }
    if (id === 'non-existent') {
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
    const format = url.searchParams.get('format');
    const { id } = params;

    if (id === 'expired' || id === 'missing') {
      return HttpResponse.json(mockErrors.NOT_FOUND.body, { status: 404 });
    }

    if (format === 'patch') {
      return new HttpResponse('--- a/src/core.py\n+++ b/src/core.py\n@@ -1,1 +1,1 @@\n-0\n+42\n', {
        headers: {
          'Content-Type': 'text/x-diff',
          'Content-Disposition': `attachment; filename="patch_${id}.patch"`,
        },
      });
    }

    return new HttpResponse(new Uint8Array([80, 75, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="repaired_${id}.zip"`,
      },
    });
  }),

  // 6. List Jobs: GET /api/jobs
  http.get('*/api/jobs', ({ request }) => {
    const url = new URL(request.url);
    const verdict = url.searchParams.get('verdict');
    const status = url.searchParams.get('status');

    if (verdict === 'INVALID_VERDICT' || status === 'INVALID_STATUS') {
      return HttpResponse.json({
        error: { code: 'INVALID_FILTER', message: 'Invalid query filter', request_id: 'req_err_filter' },
      }, { status: 400 });
    }

    let filtered = [...mockJobListResponse.jobs];
    if (verdict) {
      filtered = filtered.filter((j) => j.verdict === verdict);
    }
    if (status) {
      filtered = filtered.filter((j) => j.status === status);
    }

    return HttpResponse.json({
      total: filtered.length,
      jobs: filtered,
    }, { status: 200 });
  }),

  // 7. Health: GET /health
  http.get('*/health', () => {
    return HttpResponse.json({
      status: 'ok',
      version: '1.0.0',
      database: 'connected',
    }, { status: 200 });
  }),
];
