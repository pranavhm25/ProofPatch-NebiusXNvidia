import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropzone } from '../components/Dropzone';
import { Alert } from '../components/Alert';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';
import { uploadProject, createJob } from '../lib/api';
import { jobSessionStore } from '../lib/jobSessionStore';
import type { CreateProjectResponse } from '../types/api';
import { Sparkles, ChevronDown, ChevronUp, FileCode2, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';

export function NewRepairPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [project, setProject] = useState<CreateProjectResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [bugReport, setBugReport] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [observedBehavior, setObservedBehavior] = useState('');
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);

  const onFileSelected = useCallback(async (file: File) => {
    setProject(null);
    setUploadError(null);
    setUploading(true);
    try {
      const result = await uploadProject(file);
      setProject(result);
      showToast({
        type: 'success',
        title: 'Repository Validated',
        message: `${result.project_name} (${result.file_count} files, ${result.language}) is ready.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please check the archive.';
      setUploadError(msg);
      showToast({
        type: 'error',
        title: 'Upload Failed',
        message: msg,
      });
    } finally {
      setUploading(false);
    }
  }, [showToast]);

  const handleTrySample = async () => {
    setSampleLoading(true);
    setUploadError(null);
    try {
      const response = await fetch('/sample_buggy_repo.zip');
      if (!response.ok) throw new Error('Sample fixture not found on server.');
      const blob = await response.blob();
      const file = new File([blob], 'sample_buggy_repo.zip', { type: 'application/zip' });

      setUploading(true);
      const result = await uploadProject(file);
      setProject(result);

      setBugReport(
        'The absolute_value function in src/calculator.py currently returns n unconditionally for all inputs. For negative numbers, absolute_value(-15) returns -15 instead of 15, causing test_negative to fail.'
      );
      setExpectedBehavior('absolute_value(n) should return positive magnitude abs(n), so absolute_value(-15) == 15.');
      setObservedBehavior('absolute_value(-15) returned -15 and tests failed with AssertionError.');
      setShowOptionalFields(true);

      showToast({
        type: 'success',
        title: 'Sample Fixture Loaded',
        message: 'Loaded sample_buggy_repo.zip and prefilled defect description.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not load sample fixture.';
      setUploadError(msg);
    } finally {
      setUploading(false);
      setSampleLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !bugReport.trim() || submitting) return;

    setSubmitting(true);
    try {
      const job = await createJob({
        project_id: project.project_id,
        bug_report: bugReport.trim(),
        expected_behavior: expectedBehavior.trim() || undefined,
        observed_behavior: observedBehavior.trim() || undefined,
      });

      // Record in local session store
      jobSessionStore.addJob({
        jobId: job.job_id,
        projectName: project.project_name,
        bugReport: bugReport.trim(),
        createdAt: job.created_at,
        status: job.status,
        verdict: null,
        attemptCount: 0,
        durationSeconds: null,
        modelId: null,
      });

      showToast({
        type: 'info',
        title: 'Repair Job Queued',
        message: `Job ${job.job_id.slice(0, 8)} started. Inspecting repository...`,
      });

      navigate(`/jobs/${job.job_id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create repair job.';
      showToast({
        type: 'error',
        title: 'Submission Error',
        message: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const BUG_MAX = 4000;
  const count = bugReport.length;
  const canSubmit = !!project && count > 0 && count <= BUG_MAX && !submitting && !uploading;

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <PageHeader
        title="New Repair"
        badge="Python MVP"
        description="Submit a Python repository archive and natural language bug description. ProofPatch inspects code context, drafts a targeted patch, executes tests inside an isolated sandbox, and reports evidence-backed verdicts."
        actions={
          <button
            type="button"
            onClick={handleTrySample}
            disabled={uploading || sampleLoading}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-warm-border bg-white text-xs font-medium text-ink-primary hover:border-[#D8D2CA] hover:bg-[#FAF8F5] shadow-soft transition-colors disabled:opacity-50"
          >
            {sampleLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-muted" /> : <Sparkles className="h-3.5 w-3.5 text-amber-600" />}
            <span>Try Sample Bug</span>
          </button>
        }
      />

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Step 1: Upload Archive */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              1. Repository Archive
            </h2>
            <span className="text-[11px] text-ink-muted">Format: .zip (max 20 MB)</span>
          </div>

          <Dropzone onFileSelected={onFileSelected} disabled={uploading || submitting} />

          {uploading && (
            <div className="flex items-center gap-2 text-xs text-ink-secondary p-3 rounded-xl bg-warm-pill animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-primary" />
              <span>Inspecting repository structure and testing configuration…</span>
            </div>
          )}

          {uploadError && <Alert kind="error">{uploadError}</Alert>}

          {project && (
            <div className="bg-[#FAF8F5] rounded-2xl border border-warm-border p-4 shadow-soft flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-white border border-warm-border flex items-center justify-center text-[#1E6B3C]">
                  <FileCode2 className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-primary">{project.project_name}</p>
                  <p className="text-[11px] text-ink-secondary mt-0.5">
                    {project.file_count} files · {project.language} · {(project.total_uncompressed_bytes / 1024).toFixed(1)} KB uncompressed
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#EAF5ED] text-[#1E6B3C] border border-[#BDE3CA]">
                Valid Project
              </span>
            </div>
          )}
        </section>

        {/* Step 2: Defect Description */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="bug-report" className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              2. Defect Description <span className="text-red-500">*</span>
            </label>
            <span
              className={`text-[11px] font-mono ${
                count > BUG_MAX ? 'text-red-500 font-bold' : 'text-ink-muted'
              }`}
            >
              {count} / {BUG_MAX}
            </span>
          </div>

          <textarea
            id="bug-report"
            rows={4}
            value={bugReport}
            onChange={(e) => setBugReport(e.target.value)}
            disabled={submitting}
            placeholder="Describe the bug, expected vs observed behavior, failing test names, or error messages (e.g., 'Function calculate_discount raises ZeroDivisionError when total is 0')."
            className="w-full rounded-2xl border border-warm-border bg-white px-4 py-3 text-xs text-ink-primary placeholder:text-ink-muted/70 focus:border-ink-primary focus:ring-1 focus:ring-ink-primary transition-colors shadow-soft"
          />

          {/* Optional Collapsible Fields */}
          <div>
            <button
              type="button"
              onClick={() => setShowOptionalFields(!showOptionalFields)}
              className="inline-flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink-primary transition-colors py-1"
            >
              {showOptionalFields ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <span>Optional behavior diagnostics (expected vs observed)</span>
            </button>

            {showOptionalFields && (
              <div className="mt-3 space-y-3 p-4 rounded-2xl bg-[#FAF8F5] border border-warm-border">
                <div>
                  <label htmlFor="expected-behavior" className="block text-[11px] font-medium text-ink-secondary mb-1">
                    Expected Behavior
                  </label>
                  <input
                    id="expected-behavior"
                    type="text"
                    value={expectedBehavior}
                    onChange={(e) => setExpectedBehavior(e.target.value)}
                    placeholder="e.g., Should return 0.0 or handle empty cart cleanly"
                    className="w-full rounded-xl border border-warm-border bg-white px-3.5 py-2 text-xs text-ink-primary placeholder:text-ink-muted/70 focus:border-ink-primary shadow-xs"
                  />
                </div>

                <div>
                  <label htmlFor="observed-behavior" className="block text-[11px] font-medium text-ink-secondary mb-1">
                    Observed Behavior
                  </label>
                  <input
                    id="observed-behavior"
                    type="text"
                    value={observedBehavior}
                    onChange={(e) => setObservedBehavior(e.target.value)}
                    placeholder="e.g., Unhandled ZeroDivisionError in calculate_discount()"
                    className="w-full rounded-xl border border-warm-border bg-white px-3.5 py-2 text-xs text-ink-primary placeholder:text-ink-muted/70 focus:border-ink-primary shadow-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Security & Expiry Notice */}
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#FAF8F5] border border-warm-border-subtle text-ink-secondary text-[11px] leading-relaxed">
          <ShieldCheck className="h-4 w-4 text-[#1E6B3C] shrink-0 mt-0.5" strokeWidth={1.5} />
          <div>
            <span className="font-semibold text-ink-primary">Isolated Workspace & Retention Policy:</span> Code is analyzed with NVIDIA open-source models through Nebius Token Factory. Patches are verified inside isolated disposable subprocesses. All temporary workspaces expire after 60 minutes.
          </div>
        </div>

        {/* Submit Action */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl text-xs font-semibold shadow-soft transition-all ${
              canSubmit
                ? 'bg-ink-primary text-warm-bg hover:bg-[#3D352F] active:scale-[0.99] cursor-pointer'
                : 'bg-warm-muted text-ink-muted cursor-not-allowed border border-warm-border'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-warm-bg" />
                <span>Launching Repair Orchestrator…</span>
              </>
            ) : (
              <>
                <span>Analyze and Repair</span>
                <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
