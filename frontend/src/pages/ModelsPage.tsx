import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { Alert } from '../components/Alert';
import { Cpu, Zap, Brain, Sparkles, CheckCircle2 } from 'lucide-react';

export function ModelsPage() {
  const roles = [
    {
      role: 'FAST',
      name: 'Planning & Source Inspection',
      defaultModel: 'nvidia/Nemotron-3_5-Lightning',
      description: 'Executes rapid repository context analysis, structural inspection, and initial repair plan formulation.',
      icon: <Zap className="h-4 w-4 text-amber-600" strokeWidth={1.5} />,
      status: 'Configured & Active',
    },
    {
      role: 'REASONING',
      name: 'Unified Diff Patch Generation',
      defaultModel: 'nvidia/Nemotron-3-Ultra-550b-a55b / zai-org/GLM-5.3-Flash',
      description: 'Generates minimal, syntactically valid unified diff hunks matching exact repository line offsets and indentation.',
      icon: <Brain className="h-4 w-4 text-[#27618D]" strokeWidth={1.5} />,
      status: 'Configured & Active',
    },
    {
      role: 'ADVANCED',
      name: 'Bounded Retry & Failure Revision',
      defaultModel: 'deepseek-ai/DeepSeek-V4-Pro',
      description: 'Receives actual sandbox pytest failure stdout/stderr and line-numbered source to revise failing or unapplied patches.',
      icon: <Sparkles className="h-4 w-4 text-[#1E6B3C]" strokeWidth={1.5} />,
      status: 'Configured & Active',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      <PageHeader
        title="Models & Role Architecture"
        badge="Nebius Token Factory"
        description="ProofPatch employs role-separated model dispatching through Nebius Token Factory. Each stage routes to a specialized open-source model optimized for latency, precision, or deep reasoning."
      />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Model Provider"
          value="Nebius"
          icon={<Cpu className="h-4 w-4 text-ink-muted" strokeWidth={1.5} />}
          hint="api.tokenfactory.nebius.com"
        />
        <StatCard
          label="Configured Roles"
          value="3 Roles"
          icon={<Brain className="h-4 w-4 text-ink-muted" strokeWidth={1.5} />}
          hint="FAST · REASONING · ADVANCED"
        />
        <StatCard
          label="Model Family"
          value="Nemotron"
          icon={<Sparkles className="h-4 w-4 text-ink-muted" strokeWidth={1.5} />}
          hint="NVIDIA Open-Source Architecture"
        />
      </div>

      <Alert kind="info" title="Zero Implicit Model Fallback">
        In accordance with the hackathon specification, ProofPatch enforces strict model registry boundaries: fallback model IDs must be explicitly allowed in configuration and can never implicitly escalate beyond their designated tier.
      </Alert>

      {/* Model Role Cards */}
      <div className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
          Configured Pipeline Roles
        </h2>

        <div className="space-y-3">
          {roles.map((r) => (
            <div
              key={r.role}
              className="rounded-2xl border border-warm-border bg-[#FCFBF9] p-5 shadow-soft space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-white border border-warm-border shadow-xs">
                    {r.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-ink-primary">{r.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-warm-pill text-ink-secondary border border-warm-border">
                        Role: {r.role}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-[#27618D] mt-0.5">
                      {r.defaultModel}
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1E6B3C] bg-[#EAF5ED] border border-[#BDE3CA] px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
                  <span>{r.status}</span>
                </span>
              </div>

              <p className="text-xs text-ink-secondary leading-relaxed pt-1 border-t border-warm-border-subtle">
                {r.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Benchmarked Model Performance Matrix */}
      <div className="rounded-2xl border border-warm-border bg-white p-5 shadow-soft space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
          Empirical Benchmark Synthesis (from LIVE_RUN_REPORT.md)
        </h3>
        <p className="text-xs text-ink-secondary leading-relaxed">
          Over 310 live benchmark executions were recorded across 7 defect fixtures:
        </p>

        <div className="overflow-x-auto text-xs">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-warm-border text-left text-[11px] text-ink-secondary font-semibold">
                <th className="py-2 pr-4">Model Candidate</th>
                <th className="py-2 px-3">Role</th>
                <th className="py-2 px-3">3-Role Success</th>
                <th className="py-2 px-3">Mean Latency</th>
                <th className="py-2 pl-3">Primary Character</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-border-subtle text-ink-primary">
              <tr>
                <td className="py-2.5 pr-4 font-mono font-medium">nvidia/Nemotron-3-Ultra-550b-a55b</td>
                <td className="py-2.5 px-3 font-mono text-[11px]">ALL 3 ROLES</td>
                <td className="py-2.5 px-3 font-semibold text-[#1E6B3C]">95.7% (67/70)</td>
                <td className="py-2.5 px-3 font-mono">11.83s</td>
                <td className="py-2.5 pl-3 text-ink-secondary">Exceptional hunk accuracy and retry self-healing</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-mono font-medium">zai-org/GLM-5.3-Flash</td>
                <td className="py-2.5 px-3 font-mono text-[11px]">REASONING</td>
                <td className="py-2.5 px-3 font-semibold text-[#1E6B3C]">97.1% (68/70)</td>
                <td className="py-2.5 px-3 font-mono">9.86s</td>
                <td className="py-2.5 pl-3 text-ink-secondary">High 1st-attempt accuracy on multi-file edits</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-mono font-medium">nvidia/nemotron-3-super-120b-a12b</td>
                <td className="py-2.5 px-3 font-mono text-[11px]">ALL 3 ROLES</td>
                <td className="py-2.5 px-3 text-[#9A6218]">26.7% - 58.6%</td>
                <td className="py-2.5 px-3 font-mono">16.37s</td>
                <td className="py-2.5 pl-3 text-ink-secondary">Sensitive to context line whitespace mismatches</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
