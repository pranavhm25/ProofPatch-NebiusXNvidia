import { PageHeader } from '../components/PageHeader';
import { Alert } from '../components/Alert';
import { LastUpdated } from '../components/LastUpdated';
import { ShieldCheck, AlertTriangle, Clock, Lock, Key } from 'lucide-react';

export function SecurityPage() {
  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      <PageHeader
        title="Security & Sandbox Boundaries"
        badge="Truthful Architecture"
        description="ProofPatch separates AI code generation from execution. This page transparently documents what is and is not isolated during patch testing."
        actions={<LastUpdated date="2026-10-30" />}
      />

      {/* Primary Principle Alert */}
      <Alert kind="info" title="The Core Axiom: Evidence Over Assertion">
        AI coding assistants frequently produce plausible-looking code that fails tests or breaks existing logic. ProofPatch strictly enforces that a repair is <strong>never</strong> marked <code className="font-mono text-[11px] bg-white dark:bg-dark-card px-1.5 py-0.5 rounded border border-warm-border dark:border-dark-border">VERIFIED</code> based on model prose. Only zero test runner exit codes with positive discovered tests establish a valid repair.
      </Alert>

      {/* Grid of Security Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Control 1: Environment Variable Scrubbing */}
        <div className="rounded-2xl border border-warm-border dark:border-dark-border bg-[#FCFBF9] dark:bg-dark-card p-5 shadow-soft space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink-primary dark:text-dark-ink-primary">
            <Key className="h-4 w-4 text-[#1E6B3C] dark:text-emerald-400" strokeWidth={1.5} />
            <span>Environment Variable Scrubbing</span>
          </div>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
            Before launching test runners in the sandbox, all API keys and secrets matching patterns like{' '}
            <code className="font-mono text-[10px] bg-warm-pill dark:bg-dark-pill text-ink-primary dark:text-dark-ink-primary font-semibold px-1.5 py-0.5 rounded">NEBIUS*</code>,{' '}
            <code className="font-mono text-[10px] bg-warm-pill dark:bg-dark-pill text-ink-primary dark:text-dark-ink-primary font-semibold px-1.5 py-0.5 rounded">OPENAI*</code>,{' '}
            <code className="font-mono text-[10px] bg-warm-pill dark:bg-dark-pill text-ink-primary dark:text-dark-ink-primary font-semibold px-1.5 py-0.5 rounded">TOKEN*</code>, and{' '}
            <code className="font-mono text-[10px] bg-warm-pill dark:bg-dark-pill text-ink-primary dark:text-dark-ink-primary font-semibold px-1.5 py-0.5 rounded">KEY*</code> are purged from the child process environment dictionary.
          </p>
        </div>

        {/* Control 2: Disposable Working Copies */}
        <div className="rounded-2xl border border-warm-border dark:border-dark-border bg-[#FCFBF9] dark:bg-dark-card p-5 shadow-soft space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink-primary dark:text-dark-ink-primary">
            <Lock className="h-4 w-4 text-[#1E6B3C] dark:text-emerald-400" strokeWidth={1.5} />
            <span>Disposable Atomic Working Copies</span>
          </div>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
            Uploaded archives are extracted to temporary workspaces. Patches are never applied in place to the master copy; tests execute against an isolated disposable directory with atomic rollback on any application failure.
          </p>
        </div>

        {/* Control 3: Hard Wall-Clock Timeouts */}
        <div className="rounded-2xl border border-warm-border dark:border-dark-border bg-[#FCFBF9] dark:bg-dark-card p-5 shadow-soft space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink-primary dark:text-dark-ink-primary">
            <Clock className="h-4 w-4 text-[#1E6B3C] dark:text-emerald-400" strokeWidth={1.5} />
            <span>Hard Wall-Clock Execution Limits</span>
          </div>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
            Every test execution is bounded by a strict hard timeout (default: 30 seconds). Runaway processes or hanging tests are terminated via SIGKILL, recorded as{' '}
            <code className="font-mono text-[10px] bg-warm-pill dark:bg-dark-pill px-1 rounded">TIMED_OUT</code>, and mapped to a final verdict of{' '}
            <code className="font-mono text-[10px] bg-warm-pill dark:bg-dark-pill px-1 rounded">FAILED</code>.
          </p>
        </div>

        {/* Control 4: 60-Minute Retention Policy */}
        <div className="rounded-2xl border border-warm-border dark:border-dark-border bg-[#FCFBF9] dark:bg-dark-card p-5 shadow-soft space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink-primary dark:text-dark-ink-primary">
            <ShieldCheck className="h-4 w-4 text-[#1E6B3C] dark:text-emerald-400" strokeWidth={1.5} />
            <span>60-Minute Automatic Retention Expiry</span>
          </div>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
            Uploaded archives and patched workspaces are temporary. The backend assigns an expiration timestamp (<code className="font-mono text-[10px] bg-warm-pill dark:bg-dark-pill px-1 rounded">expires_at</code>) of 60 minutes, after which workspaces are safely deleted from the disk.
          </p>
        </div>
      </div>

      {/* Honest Disclosure of Limitations */}
      <div className="rounded-2xl border border-[#F7DFC0] dark:border-amber-900/60 bg-[#FEF7EC] dark:bg-amber-950/20 p-6 shadow-soft space-y-3 text-xs">
        <div className="flex items-center gap-2 font-semibold text-[#9A6218] dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 text-[#9A6218] dark:text-amber-400" strokeWidth={1.5} />
          <span>Transparent Disclosure: Current MVP Isolation Limits</span>
        </div>
        <ul className="list-disc pl-5 space-y-1.5 text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
          <li>
            <strong>Network Isolation:</strong> Local subprocess execution does not enforce kernel network namespace restrictions without Linux cgroups/Docker. Untrusted code capable of socket calls could access host networking. Production deployments must run inside microVMs or container sandboxes.
          </li>
          <li>
            <strong>Platform Parity (Windows vs Linux):</strong> POSIX <code className="font-mono text-[11px] bg-white dark:bg-dark-card px-1 py-0.5 rounded border border-[#F7DFC0] dark:border-amber-900/50">resource.RLIMIT_*</code> (memory and CPU quotas) are Unix-only primitives. On Windows hosts, the runner safely bypasses them and falls back to hard process timeouts and environment scrubbing.
          </li>
          <li>
            <strong>Arbitrary Code Bounds:</strong> Pytest runs Python bytecode. While safe archives are validated against path traversal (<code className="font-mono text-[11px] bg-white dark:bg-dark-card px-1 py-0.5 rounded border border-[#F7DFC0] dark:border-amber-900/50">..</code>) and symlink exploits, user-submitted tests execute with the permissions of the host backend process.
          </li>
        </ul>
      </div>
    </div>
  );
}
