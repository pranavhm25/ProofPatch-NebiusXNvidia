import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { PillTabs } from '../components/PillTabs';
import { VerdictBadge } from '../components/VerdictBadge';
import { EmptyState } from '../components/EmptyState';
import { jobSessionStore, type SessionJob } from '../lib/jobSessionStore';
import { Inbox, CheckCircle2, Clock, XCircle, ArrowUpRight, Wrench } from 'lucide-react';

export function JobsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('filter') || 'all';

  const [jobs, setJobs] = useState<SessionJob[]>(() => jobSessionStore.getJobs());
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());

  useEffect(() => {
    return jobSessionStore.subscribe((updated) => {
      setJobs(updated);
    });
  }, []);

  const totalCount = jobs.length;
  const verifiedCount = jobs.filter((j) => j.verdict === 'VERIFIED').length;
  const runningCount = jobs.filter(
    (j) => !j.verdict && (j.status === 'QUEUED' || j.status === 'TESTING' || j.status === 'PLANNING' || j.status === 'PATCHING')
  ).length;
  const failedCount = jobs.filter((j) => j.verdict === 'FAILED' || j.status === 'FAILED').length;

  const filteredJobs = jobs.filter((job) => {
    if (filter === 'verified') return job.verdict === 'VERIFIED';
    if (filter === 'running') {
      return !job.verdict && (job.status === 'QUEUED' || jIsRunning(job.status));
    }
    if (filter === 'failed') return job.verdict === 'FAILED' || job.status === 'FAILED';
    if (filter === 'notverified') return job.verdict === 'NOT_VERIFIED';
    return true;
  });

  function jIsRunning(s: string) {
    return ['QUEUED', 'VALIDATING', 'ANALYZING', 'PLANNING', 'PATCHING', 'TESTING', 'RETRYING'].includes(s);
  }

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedJobs(new Set(filteredJobs.map((j) => j.jobId)));
    } else {
      setSelectedJobs(new Set());
    }
  };

  const handleToggleOne = (jobId: string) => {
    const next = new Set(selectedJobs);
    if (next.has(jobId)) next.delete(jobId);
    else next.add(jobId);
    setSelectedJobs(next);
  };

  const tabs = [
    { id: 'all', label: 'All Jobs', count: totalCount },
    { id: 'verified', label: 'Verified', count: verifiedCount },
    { id: 'running', label: 'In Progress', count: runningCount },
    { id: 'failed', label: 'Failed', count: failedCount },
  ];

  return (
    <div className="max-w-5xl mx-auto w-full space-y-6">
      <PageHeader
        title="Repair Jobs"
        badge={totalCount}
        description="Inspect all automated repair sessions executed during this session. Review test outcomes, execution durations, and generated patches."
        actions={
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-ink-primary text-warm-bg text-xs font-semibold hover:bg-[#3D352F] shadow-soft transition-colors"
          >
            <Wrench className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>New Repair</span>
          </Link>
        }
      />

      {/* Stat Cards (Matching Reference Screenshot row) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Repairs"
          value={totalCount}
          icon={<Inbox className="h-4 w-4 text-ink-muted" strokeWidth={1.5} />}
        />
        <StatCard
          label="Verified Fixes"
          value={verifiedCount}
          icon={<CheckCircle2 className="h-4 w-4 text-[#1E6B3C]" strokeWidth={1.5} />}
        />
        <StatCard
          label="In Progress"
          value={runningCount}
          icon={<Clock className="h-4 w-4 text-[#27618D]" strokeWidth={1.5} />}
        />
        <StatCard
          label="Failed / Unverified"
          value={failedCount}
          icon={<XCircle className="h-4 w-4 text-[#9C2A2A]" strokeWidth={1.5} />}
        />
      </div>

      {/* Pill Filter Tabs (Matching Reference Screenshot) */}
      <div className="pt-2">
        <PillTabs
          tabs={tabs}
          activeTab={filter}
          onChange={(id) => {
            setSearchParams({ filter: id });
          }}
        />
      </div>

      {/* Data Table / List (Matching Reference Screenshot) */}
      {filteredJobs.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6 text-ink-muted" strokeWidth={1.5} />}
          title={totalCount === 0 ? 'No Repair Jobs Yet' : 'No Matching Jobs'}
          description={
            totalCount === 0
              ? 'Start by submitting a Python project archive and defect description on the New Repair page.'
              : `No jobs match the '${filter}' filter.`
          }
          action={
            totalCount === 0 ? (
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-ink-primary text-warm-bg text-xs font-semibold hover:bg-[#3D352F] shadow-soft"
              >
                <span>Start First Repair</span>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-2xl border border-warm-border bg-white overflow-hidden shadow-soft">
          {/* Header Row */}
          <div className="flex items-center px-5 py-3 bg-[#FAF8F5] border-b border-warm-border text-xs font-semibold text-ink-secondary">
            <div className="w-10 flex items-center">
              <input
                type="checkbox"
                aria-label="Select all jobs"
                checked={selectedJobs.size === filteredJobs.length && filteredJobs.length > 0}
                onChange={handleSelectAll}
                className="h-4 w-4 rounded-md border-warm-border text-ink-primary focus:ring-1 focus:ring-ink-primary"
              />
            </div>
            <div className="w-32">Job ID</div>
            <div className="flex-1">Repository & Defect Summary</div>
            <div className="w-32 text-center">Verdict</div>
            <div className="w-24 text-right">Duration</div>
            <div className="w-12 text-right"></div>
          </div>

          {/* List Rows */}
          <div className="divide-y divide-warm-border-subtle">
            {filteredJobs.map((job) => {
              const isSelected = selectedJobs.has(job.jobId);
              const isDone = !jIsRunning(job.status);
              const targetUrl = isDone ? `/jobs/${job.jobId}/result` : `/jobs/${job.jobId}`;

              return (
                <div
                  key={job.jobId}
                  onClick={() => navigate(targetUrl)}
                  className={`flex items-center px-5 py-3.5 hover:bg-[#FAF8F5] transition-colors cursor-pointer text-xs ${
                    isSelected ? 'bg-warm-pill/50' : ''
                  }`}
                >
                  <div className="w-10 flex items-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select job ${job.jobId.slice(0, 8)}`}
                      checked={isSelected}
                      onChange={() => handleToggleOne(job.jobId)}
                      className="h-4 w-4 rounded-md border-warm-border text-ink-primary focus:ring-1 focus:ring-ink-primary"
                    />
                  </div>

                  {/* Job ID & Created */}
                  <div className="w-32">
                    <span className="font-mono font-semibold text-ink-primary">
                      {job.jobId.slice(0, 8)}
                    </span>
                    <p className="text-[10px] text-ink-muted mt-0.5">
                      {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {/* Primary & Secondary Line (Matching Screenshot style) */}
                  <div className="flex-1 pr-4 min-w-0">
                    <p className="font-semibold text-ink-primary truncate">
                      {job.projectName}
                    </p>
                    <p className="text-[11px] text-ink-secondary truncate mt-0.5">
                      {job.bugReport}
                    </p>
                  </div>

                  {/* Verdict Pill */}
                  <div className="w-32 flex justify-center">
                    <VerdictBadge verdict={job.verdict ?? (job.status as any)} size="sm" />
                  </div>

                  {/* Duration & Attempts */}
                  <div className="w-24 text-right font-mono text-[11px] text-ink-secondary">
                    {job.durationSeconds ? `${job.durationSeconds.toFixed(1)}s` : '—'}
                    <p className="text-[10px] text-ink-muted">
                      {job.attemptCount} att
                    </p>
                  </div>

                  {/* Open Arrow */}
                  <div className="w-12 text-right">
                    <span className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-warm-pill inline-flex items-center">
                      <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

