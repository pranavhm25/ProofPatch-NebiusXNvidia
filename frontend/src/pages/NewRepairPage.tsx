import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropzone } from '../components/Dropzone';
import { Alert } from '../components/Alert';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useUtmParams } from '../hooks/useUtmParams';
import { uploadProject, createJob } from '../lib/api';
import { jobSessionStore } from '../lib/jobSessionStore';
import type { CreateProjectResponse } from '../types/api';
import { Sparkles, ChevronDown, ChevronUp, FileCode2, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export function NewRepairPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  useUtmParams(); // Automatically capture and store UTM query params if present

  const [project, setProject] = useState<CreateProjectResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [bugReport, setBugReport] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [observedBehavior, setObservedBehavior] = useState('');
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ bugReport?: string; project?: string }>({});

  const bugReportRef = useRef<HTMLTextAreaElement>(null);

  const onFileSelected = useCallback(async (file: File) => {
    setProject(null);
    setUploadError(null);
    setFieldErrors((prev) => ({ ...prev, project: undefined }));
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
    setFieldErrors({});
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
    const errors: { bugReport?: string; project?: string } = {};

    if (!project) {
      errors.project = 'Please upload a Python repository ZIP archive before starting repair.';
    }

    if (!bugReport.trim()) {
      errors.bugReport = 'Defect description is required. Please explain the bug or failing test.';
    } else if (bugReport.length > 4000) {
      errors.bugReport = 'Defect description exceeds maximum length of 4000 characters.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.bugReport && bugReportRef.current) {
        bugReportRef.current.focus();
      }
      return;
    }

    if (!project || submitting) return;

    setSubmitting(true);
    setFieldErrors({});

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

      setSubmittedJobId(job.job_id);

      showToast({
        type: 'success',
        title: 'Repair Job Initialized',
        message: `Job ${job.job_id.slice(0, 8)} started. Redirecting to live pipeline...`,
      });

      // Transition smoothly after confirmation
      setTimeout(() => {
        navigate(`/jobs/${job.job_id}`);
      }, 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create repair job.';
      showToast({
        type: 'error',
        title: 'Submission Error',
        message: msg,
      });
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
            disabled={uploading || sampleLoading || submitting}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface text-xs font-medium text-ink-primary dark:text-dark-ink-primary hover:border-[#D8D2CA] dark:hover:border-dark-border hover:bg-[#FAF8F5] dark:hover:bg-dark-pill shadow-soft transition-colors disabled:opacity-50 focus-visible:outline-2"
          >
            {sampleLoading ? (
              <Spinner size="xs" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            )}
            <span>Try Sample Bug</span>
          </button>
        }
      />

      {/* Form Submission Success State Confirmation UI */}
      {submittedJobId && (
        <div
          role="status"
          aria-live="polite"
          className="p-5 rounded-2xl border border-[#BDE3CA] dark:border-emerald-800 bg-[#EAF5ED] dark:bg-emerald-950/30 text-[#1E6B3C] dark:text-emerald-300 shadow-soft space-y-2 animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2.5 font-semibold text-xs sm:text-sm">
            <CheckCircle2 className="h-5 w-5 text-[#1E6B3C] dark:text-emerald-400 shrink-0" strokeWidth={1.5} />
            <span>Repair Job Successfully Queued</span>
          </div>
          <p className="text-xs leading-relaxed pl-7">
            Job <span className="font-mono font-bold">{submittedJobId.slice(0, 8)}</span> has been queued with repository context. Opening live sandbox pipeline…
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {/* Step 1: Upload Archive */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary dark:text-dark-ink-secondary">
              1. Repository Archive <span className="text-red-500">*</span>
            </h2>
            <span className="text-[11px] text-ink-muted dark:text-dark-ink-muted">Format: .zip (max 20 MB)</span>
          </div>

          <Dropzone
            onFileSelected={onFileSelected}
            onFileCleared={() => setProject(null)}
            disabled={uploading || submitting}
          />

          {fieldErrors.project && (
            <p id="project-error" className="text-xs font-medium text-red-600 dark:text-red-400 animate-in fade-in">
              {fieldErrors.project}
            </p>
          )}

          {uploading && (
            <div className="flex items-center gap-2 text-xs text-ink-secondary dark:text-dark-ink-secondary p-3 rounded-xl bg-warm-pill dark:bg-dark-pill animate-pulse">
              <Spinner size="xs" className="text-ink-primary dark:text-dark-ink-primary" />
              <span>Inspecting repository structure and testing configuration…</span>
            </div>
          )}

          {uploadError && <Alert kind="error">{uploadError}</Alert>}

          {project && (
            <div className="bg-[#FAF8F5] dark:bg-dark-card rounded-2xl border border-warm-border dark:border-dark-border p-4 shadow-soft flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-white dark:bg-dark-surface border border-warm-border dark:border-dark-border flex items-center justify-center text-[#1E6B3C] dark:text-emerald-400">
                  <FileCode2 className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-primary dark:text-dark-ink-primary">{project.project_name}</p>
                  <p className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
                    {project.file_count} files · {project.language} · {(project.total_uncompressed_bytes / 1024).toFixed(1)} KB uncompressed
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#EAF5ED] dark:bg-emerald-950/40 text-[#1E6B3C] dark:text-emerald-300 border border-[#BDE3CA] dark:border-emerald-800">
                Valid Project
              </span>
            </div>
          )}
        </section>

        {/* Step 2: Defect Description */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="bug-report" className="text-xs font-semibold uppercase tracking-wider text-ink-secondary dark:text-dark-ink-secondary">
              2. Defect Description <span className="text-red-500">*</span>
            </label>
            <span
              className={`text-[11px] font-mono ${
                count > BUG_MAX ? 'text-red-500 font-bold' : 'text-ink-muted dark:text-dark-ink-muted'
              }`}
            >
              {count} / {BUG_MAX}
            </span>
          </div>

          <textarea
            ref={bugReportRef}
            id="bug-report"
            rows={4}
            value={bugReport}
            onChange={(e) => {
              setBugReport(e.target.value);
              if (fieldErrors.bugReport) {
                setFieldErrors((prev) => ({ ...prev, bugReport: undefined }));
              }
            }}
            disabled={submitting}
            aria-invalid={!!fieldErrors.bugReport}
            aria-describedby={fieldErrors.bugReport ? 'bug-report-error' : undefined}
            placeholder="Describe the bug, expected vs observed behavior, failing test names, or error messages (e.g., 'Function calculate_discount raises ZeroDivisionError when total is 0')."
            className={`w-full rounded-2xl border bg-white dark:bg-dark-surface px-4 py-3 text-xs text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted/70 dark:placeholder:text-dark-ink-muted/70 transition-colors shadow-soft focus-visible:outline-2 ${
              fieldErrors.bugReport
                ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                : 'border-warm-border dark:border-dark-border focus:border-ink-primary dark:focus:border-dark-ink-primary focus:ring-1 focus:ring-ink-primary dark:focus:ring-dark-ink-primary'
            }`}
          />

          {fieldErrors.bugReport && (
            <p id="bug-report-error" className="text-xs font-medium text-red-600 dark:text-red-400 animate-in fade-in">
              {fieldErrors.bugReport}
            </p>
          )}

          {/* Optional Collapsible Fields */}
          <div>
            <button
              type="button"
              onClick={() => setShowOptionalFields(!showOptionalFields)}
              className="inline-flex items-center gap-1.5 text-xs text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary transition-colors py-1 focus-visible:outline-2"
            >
              {showOptionalFields ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <span>Optional behavior diagnostics (expected vs observed)</span>
            </button>

            {showOptionalFields && (
              <div className="mt-3 space-y-3 p-4 rounded-2xl bg-[#FAF8F5] dark:bg-dark-card border border-warm-border dark:border-dark-border animate-in fade-in duration-150">
                <div>
                  <label htmlFor="expected-behavior" className="block text-[11px] font-medium text-ink-secondary dark:text-dark-ink-secondary mb-1">
                    Expected Behavior
                  </label>
                  <input
                    id="expected-behavior"
                    type="text"
                    value={expectedBehavior}
                    onChange={(e) => setExpectedBehavior(e.target.value)}
                    placeholder="e.g., Should return 0.0 or handle empty cart cleanly"
                    className="w-full rounded-xl border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface px-3.5 py-2 text-xs text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted/70 dark:placeholder:text-dark-ink-muted/70 focus:border-ink-primary dark:focus:border-dark-ink-primary shadow-xs focus-visible:outline-2"
                  />
                </div>

                <div>
                  <label htmlFor="observed-behavior" className="block text-[11px] font-medium text-ink-secondary dark:text-dark-ink-secondary mb-1">
                    Observed Behavior
                  </label>
                  <input
                    id="observed-behavior"
                    type="text"
                    value={observedBehavior}
                    onChange={(e) => setObservedBehavior(e.target.value)}
                    placeholder="e.g., Unhandled ZeroDivisionError in calculate_discount()"
                    className="w-full rounded-xl border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface px-3.5 py-2 text-xs text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted/70 dark:placeholder:text-dark-ink-muted/70 focus:border-ink-primary dark:focus:border-dark-ink-primary shadow-xs focus-visible:outline-2"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Security & Expiry Notice */}
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#FAF8F5] dark:bg-dark-card border border-warm-border-subtle dark:border-dark-border-subtle text-ink-secondary dark:text-dark-ink-secondary text-[11px] leading-relaxed">
          <ShieldCheck className="h-4 w-4 text-[#1E6B3C] dark:text-emerald-400 shrink-0 mt-0.5" strokeWidth={1.5} />
          <div>
            <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">Isolated Workspace & Retention Policy:</span> Code is analyzed with NVIDIA open-source models through Nebius Token Factory. Patches are verified inside isolated disposable subprocesses. All temporary workspaces expire after 60 minutes.
          </div>
        </div>

        {/* Submit Action */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl text-xs font-semibold shadow-soft transition-all focus-visible:outline-2 ${
              canSubmit
                ? 'bg-ink-primary dark:bg-dark-ink-primary text-warm-bg dark:text-dark-bg hover:bg-[#3D352F] dark:hover:opacity-90 active:scale-[0.99] cursor-pointer'
                : 'bg-warm-muted dark:bg-dark-muted text-ink-muted dark:text-dark-ink-muted cursor-not-allowed border border-warm-border dark:border-dark-border'
            }`}
          >
            {submitting ? (
              <>
                <Spinner size="xs" className="text-warm-bg dark:text-dark-bg" />
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
