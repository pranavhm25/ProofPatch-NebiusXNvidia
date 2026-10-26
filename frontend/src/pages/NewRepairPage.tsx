import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropzone } from '../components/Dropzone';
import { Alert } from '../components/Alert';
import { uploadProject, createJob } from '../api/client';
import type { CreateProjectResponse, ApiErrorResponse } from '../types/api';

export function NewRepairPage() {
  const navigate = useNavigate();
  const [project, setProject] = useState<CreateProjectResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [bugReport, setBugReport] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [observedBehavior, setObservedBehavior] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onFileSelected = useCallback(async (f: File) => {
    setProject(null);
    setUploadError(null);
    setUploading(true);
    try {
      const result = await uploadProject(f);
      setProject(result);
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setUploadError(apiErr?.error?.message ?? 'Upload failed. Please check the file and try again.');
    } finally {
      setUploading(false);
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !bugReport.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const job = await createJob({
        project_id: project.project_id,
        bug_report: bugReport.trim(),
        expected_behavior: expectedBehavior.trim() || undefined,
        observed_behavior: observedBehavior.trim() || undefined,
      });
      navigate(`/jobs/${job.job_id}`);
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setSubmitError(apiErr?.error?.message ?? 'Failed to start repair job.');
    } finally {
      setSubmitting(false);
    }
  };

  const bugReportLen = bugReport.length;
  const BUG_MAX = 4000;
  const canSubmit = !!project && bugReportLen > 0 && bugReportLen <= BUG_MAX && !submitting;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-7 w-2 bg-blue-500 rounded-sm"></div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100">ProofPatch</h1>
        </div>
        <p className="text-neutral-400 text-sm font-medium">Repair code. Verify the change.</p>
        <p className="text-neutral-400 text-sm leading-relaxed max-w-xl">
          ProofPatch investigates a reported defect in a Python repository, proposes a minimal patch,
          applies it in an isolated environment, runs the test suite, and generates an evidence-backed report.
        </p>
      </header>

      <Alert kind="info">
        <strong>Privacy & Security:</strong> Uploaded source code is processed by the configured NVIDIA open-source model through Nebius Token Factory and stored only in temporary workspaces (expired after 60 minutes).
      </Alert>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">1. Upload Repository Archive</h2>
        <Dropzone onFileSelected={onFileSelected} disabled={uploading || submitting} />
        {uploading && <p className="text-xs text-neutral-400 animate-pulse">Inspecting and validating archive…</p>}
        {uploadError && <Alert kind="error">{uploadError}</Alert>}
        {project && (
          <div className="rounded-lg border border-emerald-800 bg-emerald-950/20 p-3.5 text-sm space-y-1">
            <p className="font-semibold text-emerald-300">{project.project_name}</p>
            <p className="text-neutral-400 text-xs">
              {project.file_count} files · {project.language} · {(project.total_uncompressed_bytes / 1024).toFixed(1)} KB uncompressed
            </p>
          </div>
        )}
      </section>

      <form onSubmit={onSubmit} className="space-y-5">
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">2. Bug Report</h2>
          <div>
            <label htmlFor="bug-report" className="block text-sm font-medium text-neutral-300 mb-1">
              Defect description <span className="text-red-400">*</span>
            </label>
            <textarea
              id="bug-report"
              value={bugReport}
              onChange={(e) => setBugReport(e.target.value)}
              rows={4}
              maxLength={BUG_MAX}
              placeholder="Describe the defect, failing behavior, or relevant context."
              disabled={submitting}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-sm text-neutral-200 placeholder-neutral-600 focus:border-blue-500 focus:outline-none resize-y disabled:opacity-50"
            />
            <p className={`mt-1 text-right text-xs ${bugReportLen > BUG_MAX * 0.9 ? 'text-amber-400' : 'text-neutral-500'}`}>
              {bugReportLen}/{BUG_MAX}
            </p>
          </div>

          <details className="group">
            <summary className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-200 select-none">
              + Optional: expected and observed behavior
            </summary>
            <div className="mt-3 space-y-3 pl-2 border-l border-neutral-800">
              <div>
                <label htmlFor="expected" className="block text-xs font-medium text-neutral-400 mb-1">Expected behavior</label>
                <textarea
                  id="expected"
                  value={expectedBehavior}
                  onChange={(e) => setExpectedBehavior(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  disabled={submitting}
                  placeholder="e.g. Function returns the absolute value."
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:border-blue-500 focus:outline-none resize-y disabled:opacity-50"
                />
              </div>
              <div>
                <label htmlFor="observed" className="block text-xs font-medium text-neutral-400 mb-1">Observed behavior</label>
                <textarea
                  id="observed"
                  value={observedBehavior}
                  onChange={(e) => setObservedBehavior(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  disabled={submitting}
                  placeholder="e.g. Negative input is returned unchanged."
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:border-blue-500 focus:outline-none resize-y disabled:opacity-50"
                />
              </div>
            </div>
          </details>
        </section>

        {submitError && <Alert kind="error">{submitError}</Alert>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40 transition-colors shadow-sm"
        >
          {submitting ? 'Initiating repair pipeline…' : 'Analyze and repair'}
        </button>
      </form>
    </main>
  );
}
