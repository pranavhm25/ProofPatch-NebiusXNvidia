import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { ShieldCheck, Cpu, Terminal, CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      <PageHeader
        title="About ProofPatch"
        badge="Evidence Over Assertion"
        description="Autonomous software defect repair driven by NVIDIA open models on Nebius Token Factory, verified strictly through isolated execution evidence."
        actions={
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ink-primary text-warm-bg text-xs font-semibold hover:bg-[#3D352F] transition-colors"
          >
            <span>Start New Repair</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      {/* Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          value="100%"
          label="Execution-Verified Verdicts"
          icon={<ShieldCheck className="h-4 w-4 text-[#1E6B3C]" />}
          hint="Every fix requires green pytests"
        />
        <StatCard
          value="3 Roles"
          label="Planner, Patch, Reviser"
          icon={<Cpu className="h-4 w-4 text-[#27618D]" />}
          hint="Specialized multi-model roles"
        />
        <StatCard
          value="60 Min"
          label="Automated Workspace Expiry"
          icon={<Terminal className="h-4 w-4" />}
          hint="Zero data lingering after test"
        />
      </div>

      {/* Section 1: The Core Philosophy */}
      <div className="bg-white rounded-2xl border border-warm-border p-6 space-y-4 shadow-soft">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-[#EAE5DE] flex items-center justify-center text-ink-primary">
            <CheckCircle2 className="h-4 w-4 text-[#1E6B3C]" />
          </div>
          <h2 className="text-sm font-semibold text-ink-primary">The Philosophy: Evidence Over Assertion</h2>
        </div>
        <p className="text-xs text-ink-secondary leading-relaxed">
          Large language models are inherently optimistic: when asked if their suggested patch resolves a bug,
          they will almost always say yes. In enterprise codebases, this optimism leads to broken builds,
          silent regressions, and developer fatigue.
        </p>
        <p className="text-xs text-ink-secondary leading-relaxed">
          <strong className="text-ink-primary">ProofPatch rejects claims without proof.</strong> A repair job reaches the{' '}
          <span className="font-mono text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded font-semibold">VERIFIED</span> status
          only when tests in a sandboxed disposable environment pass with return code 0. If tests fail or tests do not exist,
          the system issues an explicit <span className="font-mono text-amber-800 bg-amber-50 px-1 py-0.5 rounded font-semibold">NOT_VERIFIED</span> or{' '}
          <span className="font-mono text-red-800 bg-red-50 px-1 py-0.5 rounded font-semibold">FAILED</span> verdict with raw stdout/stderr logs.
        </p>
      </div>

      {/* Section 2: Pipeline Architecture */}
      <div className="bg-white rounded-2xl border border-warm-border p-6 space-y-4 shadow-soft">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-[#EAE5DE] flex items-center justify-center text-ink-primary">
            <Cpu className="h-4 w-4 text-[#27618D]" />
          </div>
          <h2 className="text-sm font-semibold text-ink-primary">Specialized Multi-Model Pipeline</h2>
        </div>
        <p className="text-xs text-ink-secondary leading-relaxed">
          Rather than relying on a single monolithic prompt, ProofPatch separates reasoning concerns across specialized models
          served via Nebius Token Factory:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-4 rounded-xl bg-warm-bg/70 border border-warm-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-primary">1. Planning Stage</span>
              <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">FAST / REASONING</span>
            </div>
            <p className="text-[11px] text-ink-secondary leading-normal">
              Inspects repository structure, identifies targeted files, and formulates a step-by-step hypothesis from test failure traces.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-warm-bg/70 border border-warm-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-primary">2. Patch Synthesis</span>
              <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">ADVANCED</span>
            </div>
            <p className="text-[11px] text-ink-secondary leading-normal">
              Powered by NVIDIA Nemotron Ultra 550B, generating unified diffs that preserve style, comments, and existing contracts.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-warm-bg/70 border border-warm-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-primary">3. Bounded Retry</span>
              <span className="text-[10px] font-mono bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">FEEDBACK LOOP</span>
            </div>
            <p className="text-[11px] text-ink-secondary leading-normal">
              If tests fail after patch application, the exact failure trace and line-numbered source context are fed back for one revision attempt.
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Safe Subprocess Execution */}
      <div className="bg-white rounded-2xl border border-warm-border p-6 space-y-4 shadow-soft">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-[#EAE5DE] flex items-center justify-center text-ink-primary">
            <Terminal className="h-4 w-4 text-ink-primary" />
          </div>
          <h2 className="text-sm font-semibold text-ink-primary">Sandbox Safety & Cryptographic Evidence</h2>
        </div>
        <p className="text-xs text-ink-secondary leading-relaxed">
          Repositories are extracted into disposable temporary folders. Subprocesses execute tests with strict timeouts
          (default 30 seconds), purged environment variables, and POSIX path normalization to prevent sandbox escape.
        </p>
        <p className="text-xs text-ink-secondary leading-relaxed">
          Upon job completion, both the raw unified diff (<code className="font-mono text-ink-primary">.patch</code>) and the complete
          patched repository archive (<code className="font-mono text-ink-primary">.zip</code>) are generated and made available
          for instant cryptographic verification. Workspaces are automatically purged after 60 minutes.
        </p>
      </div>
    </div>
  );
}
