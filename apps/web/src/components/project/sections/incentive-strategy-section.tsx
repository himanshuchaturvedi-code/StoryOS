'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { ProgramDocumentChecklistPanel } from './program-document-checklist-panel';

type IncentiveStrategySource = 'BUDGET' | 'ACTUAL';

interface EstimatorTraceLine {
  description?: string;
  glCode?: string;
  budgetTemplateCategory?: string;
  type: string;
  province: string;
  amount: number;
  included: boolean;
  reason?: string;
}

interface EstimatorTrace {
  lines: EstimatorTraceLine[];
  // Other keys vary by program (e.g. totalCost, eligibleCanadianLabour for CPTC)
  [key: string]: unknown;
}

interface StrategyProgram {
  programVersionId: string;
  programCode: string;
  programName: string;
  versionCode: string;
  estimatedAmount: number;
  estimateAvailable: boolean;
  isEligible: boolean;
  status: 'PASS' | 'RISK' | 'FAIL';
  breakdown?: {
    trace?: EstimatorTrace;
    [key: string]: unknown;
  };
  failedRequirements: Array<{
    requirementId: string;
    code: string;
    name: string;
    result: string;
    computedValue?: Record<string, unknown>;
    trace?: {
      detailedBreakdown?: Record<string, unknown>;
    };
  }>;
  results?: Array<{
    requirementId: string;
    requirementCode: string;
    requirementName: string;
    result: string;
    computedValue?: Record<string, unknown>;
    trace?: {
      detailedBreakdown?: Record<string, unknown>;
    };
  }>;
}

interface StrategyScenario {
  id: string;
  type: 'SINGLE_PROGRAM' | 'COMBINATION';
  title: string;
  totalEstimatedAmount: number;
  estimateAvailable: boolean;
  isEligible: boolean;
  status: 'PASS' | 'RISK' | 'FAIL';
  eligibilityLabel: string;
  isRecommended: boolean;
  explanation: string;
  sensitivity?: Array<{
    description: string;
    deltaAmount: number;
  }>;
  programs: StrategyProgram[];
}

interface IncentiveStrategyResponse {
  projectId: string;
  source: IncentiveStrategySource;
  projectProvince: string | null;
  budgetVersionId: string | null;
  recommendedScenarioId: string | null;
  caveat: string;
  scenarios: StrategyScenario[];
  allPrograms: StrategyProgram[];
}

interface IncentiveStrategySectionProps {
  projectId: string;
  source: IncentiveStrategySource;
}

function formatCurrency(amount: number) {
  return amount.toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  });
}

function statusClass(status: StrategyScenario['status']) {
  if (status === 'PASS') return 'bg-green-100 text-green-700 border-green-200';
  if (status === 'FAIL') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-amber-100 text-amber-700 border-amber-200';
}

function requirementResultBadge(result: string) {
  if (result === 'PASS') return 'bg-green-100 text-green-700';
  if (result === 'FAIL') return 'bg-red-100 text-red-700';
  if (result === 'NOT_EVALUATED') return 'bg-gray-100 text-gray-500';
  return 'bg-amber-100 text-amber-700';
}

function requirementResultLabel(result: string) {
  if (result === 'PASS') return 'Pass';
  if (result === 'FAIL') return 'Fail';
  if (result === 'NOT_EVALUATED') return 'Not evaluated';
  if (result === 'PARTIAL') return 'Partial';
  return result;
}

const CATEGORY_ORDER: Record<string, number> = {
  ABOVE_THE_LINE: 1,
  BELOW_THE_LINE_PRODUCTION: 2,
  BELOW_THE_LINE_POST: 3,
  OTHER: 4,
};

function formatCategoryLabel(category: string) {
  if (category === 'ABOVE_THE_LINE') return 'Above the Line';
  if (category === 'BELOW_THE_LINE_PRODUCTION') return 'Below the Line (Production)';
  if (category === 'BELOW_THE_LINE_POST') return 'Below the Line (Post)';
  return 'Other';
}

function TraceCategoryGroup({
  category,
  lines,
}: {
  category: string;
  lines: EstimatorTraceLine[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const groupLines = [...lines].sort((a, b) => {
    return (a.glCode || '').localeCompare(b.glCode || '');
  });
  const subtotal = groupLines.reduce((sum, l) => sum + (l.included ? l.amount : 0), 0);

  return (
    <>
      <tr
        className="bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors select-none"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <td colSpan={4} className="px-3 py-2 font-semibold text-gray-700">
          <span className="inline-block w-5 text-center text-gray-500 mr-1 text-xs">
            {isExpanded ? '▼' : '▶'}
          </span>
          {formatCategoryLabel(category)}
        </td>
        <td className="px-3 py-2 text-right font-mono font-semibold text-gray-700">
          {formatCurrency(subtotal)}
        </td>
        <td className="px-3 py-2 text-center text-gray-500 italic">
          (included subtotal)
        </td>
      </tr>
      {isExpanded &&
        groupLines.map((l, i) => (
          <tr
            key={`${category}-${i}`}
            className={l.included ? 'bg-white' : 'bg-gray-50 text-gray-400'}
          >
            <td className="px-3 py-2 font-mono pl-8">{l.glCode || '-'}</td>
            <td className="px-3 py-2 truncate max-w-xs">{l.description || '-'}</td>
            <td className="px-3 py-2">{l.type}</td>
            <td className="px-3 py-2">{l.province || '-'}</td>
            <td className="px-3 py-2 text-right font-mono">
              {formatCurrency(l.amount)}
            </td>
            <td className="px-3 py-2 text-center">
              {l.included ? (
                <span className="text-green-600 font-medium">Included</span>
              ) : (
                <span className="text-gray-400" title={l.reason || 'Excluded'}>
                  Excluded {l.reason ? `(${l.reason})` : ''}
                </span>
              )}
            </td>
          </tr>
        ))}
    </>
  );
}

function CalculationSteps({ steps }: { steps: string[] }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
        Calculation
      </div>
      <div className="space-y-0.5 font-mono text-sm text-gray-900">
        {steps.map((step, i) => {
          const isIndented = step.startsWith('=') || step.startsWith('Less:') || step.startsWith('Capped');
          return (
            <div key={i} className={isIndented ? 'pl-4 text-gray-700' : 'font-medium'}>
              {step}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProgramTraceDetails({ programCode, trace }: { programCode: string; trace: EstimatorTrace }) {
  if (!trace || !trace.lines) return null;

  const calculationSteps = Array.isArray(trace.calculationSteps)
    ? (trace.calculationSteps as string[])
    : [];

  const grouped = trace.lines.reduce((acc, line) => {
    const cat = line.budgetTemplateCategory || 'OTHER';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(line);
    return acc;
  }, {} as Record<string, EstimatorTraceLine[]>);

  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const orderA = CATEGORY_ORDER[a] ?? 99;
    const orderB = CATEGORY_ORDER[b] ?? 99;
    return orderA - orderB;
  });

  return (
    <details className="mt-4 rounded-md border border-gray-200 bg-gray-50 text-sm">
      <summary className="cursor-pointer px-4 py-3 font-medium text-gray-700 hover:bg-gray-100">
        {programCode} Calculation Trace
      </summary>
      <div className="border-t border-gray-200 p-4">
        <CalculationSteps steps={calculationSteps} />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 pb-4 text-gray-600">
          {Object.entries(trace).map(([key, value]) => {
            if (key === 'lines') return null;
            if (typeof value === 'number') {
              if (key.toLowerCase().includes('ratio') || key.toLowerCase().includes('rate')) {
                return (
                  <div key={key} className="contents">
                    <dt className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</dt>
                    <dd className="font-mono text-gray-900">{(value * 100).toFixed(2)}%</dd>
                  </div>
                );
              }
              if (key.toLowerCase().includes('cost') || key.toLowerCase().includes('labour') || key.toLowerCase().includes('amt') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('base')) {
                return (
                  <div key={key} className="contents">
                    <dt className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</dt>
                    <dd className="font-mono text-gray-900">{formatCurrency(value)}</dd>
                  </div>
                );
              }
            }
            if (typeof value === 'string' && value.length < 50) {
              return (
                <div key={key} className="contents">
                  <dt className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</dt>
                  <dd className="font-mono text-gray-900">{value}</dd>
                </div>
              );
            }
            return null;
          })}
        </dl>
        <div className="max-h-96 overflow-y-auto rounded border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 font-medium text-gray-500">GL Code</th>
                <th className="px-3 py-2 font-medium text-gray-500">Description</th>
                <th className="px-3 py-2 font-medium text-gray-500">Type</th>
                <th className="px-3 py-2 font-medium text-gray-500">Province</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Amount</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedCategories.map((cat) => (
                <TraceCategoryGroup
                  key={cat}
                  category={cat}
                  lines={grouped[cat] || []}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function RequirementFailureDetails({
  programCode,
  requirement,
}: {
  programCode: string;
  requirement: StrategyProgram['failedRequirements'][number];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const breakdown = asRecord(requirement.trace?.detailedBreakdown);

  if (Object.keys(breakdown).length === 0) return null;

  return (
    <div className="rounded-md border border-red-100 bg-red-50/60 text-sm">
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="font-medium text-red-900">
            {isExpanded ? '▼' : '▶'} {programCode} · {requirement.name}
          </span>
          <span className="ml-2 font-mono text-xs text-red-700">{requirement.code}</span>
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-red-700">
          {requirement.result}
        </span>
      </button>

      {isExpanded && (
        <div className="border-t border-red-100 px-4 py-4">
          {breakdown.type === 'keyCreativePoints' ? (
            <KeyCreativeFailureBreakdown breakdown={breakdown} />
          ) : breakdown.type === 'canadianOwnershipControl' ? (
            <CanadianControlFailureBreakdown breakdown={breakdown} />
          ) : (
            <pre className="overflow-auto rounded bg-white p-3 text-xs text-gray-700">
              {JSON.stringify(breakdown, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function KeyCreativeFailureBreakdown({ breakdown }: { breakdown: Record<string, unknown> }) {
  const roles = asArray(breakdown.roles);
  const failureReasons = Array.isArray(breakdown.failureReasons)
    ? breakdown.failureReasons.map(String)
    : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Total points earned</div>
          <div className="font-semibold text-gray-900">{String(breakdown.totalPointsEarned ?? 0)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Required threshold</div>
          <div className="font-semibold text-gray-900">
            {String(breakdown.requiredThreshold ?? '-')}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Score</div>
          <div className="font-semibold text-gray-900">
            {String(breakdown.thresholdLabel ?? '-')}
          </div>
        </div>
      </div>

      {failureReasons.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-red-700">
          {failureReasons.slice(0, 6).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Assigned Person</th>
              <th className="px-3 py-2 font-medium">Canadian?</th>
              <th className="px-3 py-2 text-right font-medium">Points</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {roles.map((role, index) => (
              <tr key={`${String(role.roleCode ?? 'role')}-${index}`}>
                <td className="px-3 py-2 font-medium text-gray-900">{String(role.role ?? '-')}</td>
                <td className="px-3 py-2 text-gray-700">{String(role.assignedPerson ?? '-')}</td>
                <td className="px-3 py-2 text-gray-700">{String(role.canadian ?? 'UNKNOWN')}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-900">
                  {String(role.points ?? 0)}
                </td>
                <td className="px-3 py-2">
                  <span className={role.status === 'Included' ? 'text-green-700' : 'text-red-700'}>
                    {String(role.status ?? '-')}
                    {role.reason ? ` (${String(role.reason)})` : ''}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CanadianControlFailureBreakdown({ breakdown }: { breakdown: Record<string, unknown> }) {
  const ownership = asRecord(breakdown.ownership);
  const control = asRecord(breakdown.control);
  const companies = asArray(ownership.productionCompanies);
  const failureReasons = Array.isArray(breakdown.failureReasons)
    ? breakdown.failureReasons.map(String)
    : [];

  return (
    <div className="space-y-4">
      {failureReasons.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-red-700">
          {failureReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 text-sm text-gray-700 sm:grid-cols-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Canadian ownership</div>
          <div className="font-semibold text-gray-900">
            {String(ownership.canadianOwnershipPercentage ?? '0')}%
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Non-Canadian ownership</div>
          <div className="font-semibold text-gray-900">
            {String(ownership.nonCanadianOwnershipPercentage ?? '0')}%
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Required Canadian</div>
          <div className="font-semibold text-gray-900">
            {String(ownership.requiredCanadianOwnershipPercentage ?? '-')}%
          </div>
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Production Company Ownership
        </div>
        <div className="divide-y divide-gray-100">
          {companies.map((company, index) => (
            <div key={`${String(company.productionCompany ?? 'company')}-${index}`} className="px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium text-gray-900">
                  {String(company.productionCompany ?? '-')} · {String(company.country ?? '-')}
                </div>
                <div className={company.qualifying ? 'text-green-700' : 'text-red-700'}>
                  {String(company.ownershipPercentage ?? '0')}% · {String(company.status ?? '-')}
                </div>
              </div>
              <div className="mt-1 text-xs text-gray-600">{String(company.reason ?? '')}</div>
            </div>
          ))}
        </div>
      </div>

      <ControlTraceBlock label="Creative Control" trace={asRecord(control.creative)} />
      <ControlTraceBlock label="Financial Control" trace={asRecord(control.financial)} />
    </div>
  );
}

function ControlTraceBlock({ label, trace }: { label: string; trace: Record<string, unknown> }) {
  const holders = asArray(trace.holders);
  return (
    <div className="rounded border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
        <div className={trace.status === 'PASS' ? 'text-xs font-medium text-green-700' : 'text-xs font-medium text-red-700'}>
          {String(trace.status ?? '-')}
        </div>
      </div>
      <div className="space-y-2 px-3 py-3 text-xs text-gray-700">
        <div>{String(trace.reason ?? '')}</div>
        {holders.map((holder, index) => (
          <div key={`${String(holder.holderName ?? 'holder')}-${index}`} className="rounded bg-gray-50 p-2">
            <div className="font-medium text-gray-900">
              {String(holder.holderName ?? '-')} · {String(holder.holderCountry ?? '-')}
            </div>
            <div>{String(holder.assertion ?? '')}</div>
            {Boolean(holder.reason) && (
              <div className="text-red-700">{String(holder.reason)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StrategyScenarioCard({
  scenario,
  isRecommended,
}: {
  scenario: StrategyScenario;
  isRecommended: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasTraces = scenario.programs.some((p) => p.breakdown?.trace);
  const failedRequirements = scenario.programs.flatMap((program) =>
    program.failedRequirements.map((requirement) => ({
      programCode: program.programCode,
      requirement,
    })),
  );

  return (
    <article
      className={`rounded-lg border bg-white p-5 shadow-sm ${
        isRecommended ? 'border-brand-300 ring-1 ring-brand-200' : 'border-gray-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4
              className={`${
                isRecommended ? 'text-lg' : 'text-base'
              } font-semibold text-gray-900`}
            >
              {scenario.title}
            </h4>
            {isRecommended && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                Recommended
              </span>
            )}
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                scenario.status === 'PASS'
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : scenario.status === 'RISK'
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-red-100 text-red-700 border-red-200'
              }`}
            >
              {scenario.eligibilityLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">{scenario.explanation}</p>
          {failedRequirements.length > 0 && (
            <div className="mt-3 space-y-2">
              {failedRequirements.map(({ programCode, requirement }) => (
                <RequirementFailureDetails
                  key={`${programCode}-${requirement.requirementId}`}
                  programCode={programCode}
                  requirement={requirement}
                />
              ))}
            </div>
          )}
        </div>
        <div className="text-right">
          <div
            className={`${
              isRecommended ? 'text-3xl' : 'text-2xl'
            } font-bold text-gray-900`}
          >
            {scenario.estimateAvailable
              ? formatCurrency(scenario.totalEstimatedAmount)
              : 'Estimate unavailable'}
          </div>
          <div className="text-xs text-gray-500">Potential incentive</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {scenario.programs.map((program) => (
              <span
                key={program.programVersionId}
                className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
              >
                {program.programCode}
              </span>
            ))}
          </div>
          {scenario.sensitivity && scenario.sensitivity.length > 0 && (
            <div className="border-l border-gray-200 pl-3 text-sm font-medium text-brand-700">
              {scenario.sensitivity.map((sens, i) => (
                <span key={i}>
                  +{formatCurrency(sens.deltaAmount)} {sens.description.toLowerCase()}
                </span>
              ))}
            </div>
          )}
        </div>
        
        {hasTraces && (
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            {isExpanded ? 'Hide Details' : 'View Details'}
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="mt-6 space-y-4 border-t border-gray-100 pt-4">
          {scenario.programs.map(
            (p) =>
              p.breakdown?.trace && (
                <ProgramTraceDetails
                  key={p.programVersionId}
                  programCode={p.programCode}
                  trace={p.breakdown.trace}
                />
              ),
          )}
        </div>
      )}
    </article>
  );
}

export function IncentiveStrategySection({
  projectId,
  source,
}: IncentiveStrategySectionProps) {
  const [data, setData] = useState<IncentiveStrategyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllPrograms, setShowAllPrograms] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<IncentiveStrategyResponse>(
          `/projects/${projectId}/incentive-strategy?source=${source}`,
        );
        if (isMounted) setData(response);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load incentive strategy');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [projectId, source]);

  const recommendedScenario = useMemo(
    () => data?.scenarios.find((s) => s.isRecommended) ?? null,
    [data],
  );

  const otherScenarios = useMemo(
    () => data?.scenarios.filter((s) => !s.isRecommended) ?? [],
    [data],
  );

  const checklistPrograms = useMemo(
    () =>
      (data?.allPrograms ?? []).map((program) => ({
        programCode: program.programCode,
        programName: program.programName,
      })),
    [data?.allPrograms],
  );

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-500">Loading incentive strategies...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Incentive Strategy</h2>
        <p className="mt-1 text-sm text-gray-600">
          Production-centric view of applicable incentives for this{' '}
          {source === 'BUDGET' ? 'plan' : 'actual'}.
        </p>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        {data.caveat}
      </div>

      <ProgramDocumentChecklistPanel
        projectId={projectId}
        programs={checklistPrograms}
      />

      {data.scenarios.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">
            No applicable programs detected for this project yet.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {recommendedScenario && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Recommended Strategy
              </h3>
              <StrategyScenarioCard
                scenario={recommendedScenario}
                isRecommended={true}
              />
            </section>
          )}

          {otherScenarios.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Other Scenarios
              </h3>
              <div className="grid gap-4">
                {otherScenarios.map((scenario) => (
                  <StrategyScenarioCard
                    key={scenario.id}
                    scenario={scenario}
                    isRecommended={false}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white">
        <button
          type="button"
          onClick={() => setShowAllPrograms((value) => !value)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span>
            <span className="block text-sm font-semibold text-gray-900">
              All available programs
            </span>
            <span className="text-xs text-gray-500">
              Detected from current program dates and project province.
            </span>
          </span>
          <span className="text-sm text-gray-500">
            {showAllPrograms ? 'Hide' : 'Show'}
          </span>
        </button>
        {showAllPrograms && (
          <div className="border-t border-gray-100 px-5 py-4">
            <ul className="space-y-4">
              {data.allPrograms.map((program) => (
                <li
                  key={program.programVersionId}
                  className="rounded-md border border-gray-100 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-gray-900">{program.programName}</div>
                      <div className="text-xs text-gray-500">
                        {program.programCode} · {program.versionCode}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(
                          program.status,
                        )}`}
                      >
                        {program.status}
                      </span>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        {program.estimateAvailable
                          ? formatCurrency(program.estimatedAmount)
                          : 'No estimate'}
                      </div>
                    </div>
                  </div>
                  {program.results && program.results.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {program.results.map((req) => (
                        <div
                          key={req.requirementId}
                          className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs"
                        >
                          <span className="text-gray-700 truncate">
                            {req.requirementName}
                            <span className="ml-1 text-gray-400 font-mono">{req.requirementCode}</span>
                          </span>
                          <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 font-medium ${requirementResultBadge(req.result)}`}>
                            {requirementResultLabel(req.result)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
