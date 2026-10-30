import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { Accordion, type AccordionItem } from '../components/Accordion';
import { LastUpdated } from '../components/LastUpdated';
import { ShieldCheck, Cpu, Terminal, CheckCircle2, ArrowRight, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const ABOUT_FAQS: AccordionItem[] = [
  {
    id: 'faq-evidence',
    question: 'How does ProofPatch eliminate hallucinated code fixes?',
    answer: (
      <p>
        ProofPatch enforces an absolute <strong>Evidence Over Assertion</strong> invariant: models never declare their own success. A repair job receives a <code className="font-mono text-[11px] bg-warm-pill dark:bg-dark-pill text-ink-primary dark:text-dark-ink-primary font-semibold px-1.5 py-0.5 rounded">VERIFIED</code> badge only when automated test suites pass inside an isolated subprocess with return code 0. If tests fail or are missing, an explicit <code className="font-mono text-[11px] bg-warm-pill dark:bg-dark-pill text-ink-primary dark:text-dark-ink-primary font-semibold px-1.5 py-0.5 rounded">NOT_VERIFIED</code> or <code className="font-mono text-[11px] bg-warm-pill dark:bg-dark-pill text-ink-primary dark:text-dark-ink-primary font-semibold px-1.5 py-0.5 rounded">FAILED</code> verdict is returned along with raw execution output.
      </p>
    ),
  },
  {
    id: 'faq-models',
    question: 'Which model architectures power each pipeline role?',
    answer: (
      <p>
        ProofPatch decouples the repair lifecycle across specialized tiers served by Nebius Token Factory: <strong>FAST</strong> (nvidia/Nemotron-3_5-Lightning) for context extraction, <strong>REASONING</strong> (nvidia/Nemotron-3-Ultra-550b-a55b and GLM-5.3-Flash) for unified diff synthesis, and <strong>ADVANCED</strong> (DeepSeek-V4-Pro) for test-failure self-healing.
      </p>
    ),
  },
  {
    id: 'faq-isolation',
    question: 'How are enterprise codebases kept safe during test execution?',
    answer: (
      <p>
        Archives are extracted into ephemeral disposable directories. Before tests execute, all host secrets (e.g., <code className="font-mono text-[10px] bg-warm-pill dark:bg-dark-pill px-1 rounded">NEBIUS*</code>, <code className="font-mono text-[10px] bg-warm-pill dark:bg-dark-pill px-1 rounded">OPENAI*</code>, <code className="font-mono text-[10px] bg-warm-pill dark:bg-dark-pill px-1 rounded">TOKEN*</code>) are purged from child process environments. Workspaces are automatically purged after 60 minutes.
      </p>
    ),
  },
  {
    id: 'faq-retry',
    question: 'How does the bounded retry feedback loop operate?',
    answer: (
      <p>
        If candidate patches fail initial pytest runs, the orchestrator extracts the exact failure trace (stdout/stderr) and line-numbered source code, feeding it into a bounded retry loop capped at 2 attempts to guarantee bounded runtime and costs.
      </p>
    ),
  },
];

export function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      <PageHeader
        title="About ProofPatch"
        badge="Evidence Over Assertion"
        description="Autonomous software defect repair driven by NVIDIA open models on Nebius Token Factory, verified strictly through isolated execution evidence."
        actions={
          <div className="flex items-center gap-2">
            <LastUpdated date="2026-10-30" />
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ink-primary dark:bg-dark-ink-primary text-warm-bg dark:text-dark-bg text-xs font-semibold hover:opacity-90 transition-colors shadow-soft focus-visible:outline-2"
            >
              <span>Start New Repair</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        }
      />

      {/* Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          value="100%"
          label="Execution-Verified Verdicts"
          icon={<ShieldCheck className="h-4 w-4 text-[#1E6B3C] dark:text-emerald-400" />}
          hint="Every fix requires green pytests"
        />
        <StatCard
          value="3 Roles"
          label="Planner, Patch, Reviser"
          icon={<Cpu className="h-4 w-4 text-[#27618D] dark:text-sky-400" />}
          hint="Specialized multi-model roles"
        />
        <StatCard
          value="60 Min"
          label="Automated Workspace Expiry"
          icon={<Terminal className="h-4 w-4 text-ink-muted dark:text-dark-ink-muted" />}
          hint="Zero data lingering after test"
        />
      </div>

      {/* Section 1: The Core Philosophy */}
      <div className="bg-white dark:bg-dark-surface rounded-2xl border border-warm-border dark:border-dark-border p-6 space-y-4 shadow-soft">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-[#EAE5DE] dark:bg-dark-pill flex items-center justify-center text-ink-primary dark:text-dark-ink-primary">
            <CheckCircle2 className="h-4 w-4 text-[#1E6B3C] dark:text-emerald-400" />
          </div>
          <h2 className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
            The Philosophy: Evidence Over Assertion
          </h2>
        </div>
        <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
          Large language models are inherently optimistic: when asked if their suggested patch resolves a bug,
          they will almost always say yes. In enterprise codebases, this optimism leads to broken builds,
          silent regressions, and developer fatigue.
        </p>
        <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
          <strong className="text-ink-primary dark:text-dark-ink-primary">ProofPatch rejects claims without proof.</strong> A repair job reaches the{' '}
          <span className="font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1 py-0.5 rounded font-semibold">VERIFIED</span> status
          only when tests in a sandboxed disposable environment pass with return code 0. If tests fail or tests do not exist,
          the system issues an explicit <span className="font-mono text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1 py-0.5 rounded font-semibold">NOT_VERIFIED</span> or{' '}
          <span className="font-mono text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/40 px-1 py-0.5 rounded font-semibold">FAILED</span> verdict with raw stdout/stderr logs.
        </p>
      </div>

      {/* Section 2: Pipeline Architecture */}
      <div className="bg-white dark:bg-dark-surface rounded-2xl border border-warm-border dark:border-dark-border p-6 space-y-4 shadow-soft">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-[#EAE5DE] dark:bg-dark-pill flex items-center justify-center text-ink-primary dark:text-dark-ink-primary">
            <Cpu className="h-4 w-4 text-[#27618D] dark:text-sky-400" />
          </div>
          <h2 className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
            Specialized Multi-Model Pipeline
          </h2>
        </div>
        <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
          Rather than relying on a single monolithic prompt, ProofPatch separates reasoning concerns across specialized models
          served via Nebius Token Factory:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-4 rounded-xl bg-warm-bg/70 dark:bg-dark-card border border-warm-border dark:border-dark-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-primary dark:text-dark-ink-primary">1. Planning Stage</span>
              <span className="text-[10px] font-mono bg-blue-50 dark:bg-sky-950/40 text-blue-700 dark:text-sky-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-sky-900/50">FAST / REASONING</span>
            </div>
            <p className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary leading-normal">
              Inspects repository structure, identifies targeted files, and formulates a step-by-step hypothesis from test failure traces.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-warm-bg/70 dark:bg-dark-card border border-warm-border dark:border-dark-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-primary dark:text-dark-ink-primary">2. Patch Synthesis</span>
              <span className="text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">ADVANCED</span>
            </div>
            <p className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary leading-normal">
              Powered by NVIDIA Nemotron Ultra 550B, generating unified diffs that preserve style, comments, and existing contracts.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-warm-bg/70 dark:bg-dark-card border border-warm-border dark:border-dark-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-primary dark:text-dark-ink-primary">3. Bounded Retry</span>
              <span className="text-[10px] font-mono bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/50">FEEDBACK LOOP</span>
            </div>
            <p className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary leading-normal">
              If tests fail after patch application, the exact failure trace and line-numbered source context are fed back for one revision attempt.
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Expandable FAQ */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <HelpCircle className="h-4 w-4 text-ink-muted dark:text-dark-ink-muted" strokeWidth={1.5} />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary dark:text-dark-ink-secondary">
            Frequently Asked Questions
          </h2>
        </div>
        <Accordion items={ABOUT_FAQS} defaultExpandedIds={['faq-evidence']} />
      </div>
    </div>
  );
}
