'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useProjectPrograms, type ProgramSubmission } from '@/hooks/use-programs';
import { useSubmissionActions } from '@/hooks/use-submission-actions';
import { SubmissionStatus, AssessmentResult } from '@storyos/types';
import { apiClient } from '@/lib/api-client';

interface GrantEstimate {
  programCode: string;
  estimatedAmount: number;
  breakdown?: {
    detail?: string;
  };
}

interface GrantEstimateResponse {
  projectId: string;
  province: string;
  source: string;
  totalEstimatedAmount: number;
  estimates: GrantEstimate[];
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  ABANDONED: 'Abandoned',
  COMPLETED: 'Completed',
  DRAFT: 'Draft',
  IN_REVIEW: 'In Review',
  SUBMITTED: 'Submitted',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  IN_REVIEW: 'bg-amber-100 text-amber-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  WITHDRAWN: 'bg-gray-100 text-gray-500',
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-amber-100 text-amber-700',
  ABANDONED: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
};

const RESULT_COLORS: Record<string, string> = {
  PASS: 'bg-green-100 text-green-700',
  FAIL: 'bg-red-100 text-red-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  NOT_EVALUATED: 'bg-gray-100 text-gray-500',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-CA');
}

export default function ResultsPage() {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';
  const projectProgramId = (params?.projectProgramId as string) ?? '';

  const { enrollments, isLoading, refetch } = useProjectPrograms(projectId);
  const enrollment = enrollments.find((e) => e.id === projectProgramId);

  const actions = useSubmissionActions({ projectId, onRefresh: refetch });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 0,
    }).format(amount);

  const [estimateData, setEstimateData] = useState<GrantEstimate | null | undefined>(undefined);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  useEffect(() => {
    if (!enrollment?.programVersion?.program?.code) return;

    let mounted = true;

    async function fetchEstimate() {
      try {
        setEstimateLoading(true);
        setEstimateError(null);
        
        const response = await apiClient.post<GrantEstimateResponse>('/grants/estimate', {
          projectId,
          source: 'BUDGET',
        });
        
        if (mounted) {
          const code = enrollment?.programVersion?.program?.code;
          if (code) {
            const matches = response.estimates.filter((est) => 
              est.programCode.startsWith(code)
            );
            
            if (matches.length > 0) {
              const aggregatedAmount = matches.reduce((sum, est) => sum + est.estimatedAmount, 0);
              const aggregatedDetail = matches
                .map((m) => m.breakdown?.detail)
                .filter(Boolean)
                .join('\n');
                
              setEstimateData({
                programCode: code,
                estimatedAmount: aggregatedAmount,
                breakdown: { detail: aggregatedDetail || undefined }
              });
            } else {
              setEstimateData(null);
            }
          } else {
            setEstimateData(null);
          }
        }
      } catch (err: any) {
        if (mounted) {
          setEstimateError(err.message || 'Failed to load estimate');
        }
      } finally {
        if (mounted) {
          setEstimateLoading(false);
        }
      }
    }

    fetchEstimate();

    return () => {
      mounted = false;
    };
  }, [projectId, enrollment?.programVersion?.program?.code]);

  if (isLoading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (!enrollment) return <p className="text-sm text-red-500">Program enrollment not found.</p>;

  return (
    <div className="space-y-6">
      {/* Program Estimate Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
          Estimated Incentive
        </h3>
        {estimateLoading ? (
          <p className="text-sm text-gray-500">Calculating...</p>
        ) : estimateError ? (
          <p className="text-sm text-gray-500">Estimate not available</p>
        ) : estimateData === undefined ? (
          null
        ) : estimateData === null ? (
          <p className="text-sm text-gray-500">Estimate not available</p>
        ) : (
          <div>
            <p className="text-3xl font-semibold text-gray-900 tracking-tight">
              {formatCurrency(estimateData.estimatedAmount)}
            </p>
            {estimateData.breakdown?.detail && (
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                {estimateData.breakdown.detail}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Submissions</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage application submissions for this incentive program.
          </p>
        </div>
        <button
          onClick={() => actions.createSubmission(projectProgramId)}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          New Submission
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        {enrollment.submissions?.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">
            No submissions yet. Click &ldquo;New Submission&rdquo; to start.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {enrollment.submissions?.map((sub) => (
              <li
                key={sub.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/50"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">
                    {fmtDate(sub.evaluationDate)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[sub.status] ?? ''}`}
                  >
                    {STATUS_LABELS[sub.status] ?? sub.status}
                  </span>
                </div>
                <button
                  onClick={() => actions.loadSubmission(projectProgramId, sub.id)}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
                >
                  View Details →
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {actions.selectedSubmission && (
        <SubmissionDetailPanel
          projectProgramId={actions.selectedSubmission.projectProgramId}
          submissionId={actions.selectedSubmission.submissionId}
          submission={actions.selectedSubmission.submission}
          onClose={() => actions.setSelectedSubmission(null)}
          actions={actions}
        />
      )}
    </div>
  );
}

function SubmissionDetailPanel({
  projectProgramId,
  submissionId,
  submission,
  onClose,
  actions,
}: {
  projectProgramId: string;
  submissionId: string;
  submission: ProgramSubmission | null;
  onClose: () => void;
  actions: ReturnType<typeof useSubmissionActions>;
}) {
  if (!submission) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div className="rounded-lg bg-white p-8">
          <p className="text-sm text-gray-500">Loading submission...</p>
        </div>
      </div>
    );
  }

  const canEdit = ['DRAFT', 'IN_REVIEW'].includes(submission.status);
  const canTransitionToSubmit =
    canEdit && (submission.assessments?.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Submission — {fmtDate(submission.evaluationDate)}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[submission.status] ?? ''}`}
            >
              {STATUS_LABELS[submission.status] ?? submission.status}
            </span>
            {canEdit && (
              <>
                <button
                  onClick={() => actions.initializeAssessments(projectProgramId, submissionId)}
                  className="text-xs text-brand-600 hover:text-brand-700"
                >
                  Initialize assessments
                </button>
                <button
                  onClick={() => actions.evaluateSubmission(projectProgramId, submissionId)}
                  disabled={actions.evaluating || !(submission.assessments?.length ?? 0)}
                  className="text-xs text-brand-600 hover:text-brand-700 disabled:opacity-50"
                >
                  {actions.evaluating ? 'Evaluating…' : 'Evaluate'}
                </button>
                {actions.evalError && (
                  <span className="text-xs text-red-600">{actions.evalError}</span>
                )}
                {canTransitionToSubmit && (
                  <button
                    onClick={() =>
                      actions.transitionStatus(projectProgramId, submissionId, SubmissionStatus.SUBMITTED)
                    }
                    className="text-xs text-green-600 hover:text-green-700"
                  >
                    Mark submitted
                  </button>
                )}
              </>
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700">Assessments</h4>
            {!submission.assessments?.length ? (
              <p className="mt-1 text-xs text-gray-500">
                Click &ldquo;Initialize assessments&rdquo; to create assessment rows.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {submission.assessments.map((a) => {
                  const effectiveResult = a.isOverridden ? a.overrideResult : a.result;
                  const reqLabel = a.requirement?.code ?? a.requirement?.name ?? `Req ${a.requirementId.slice(0, 8)}…`;
                  const hasComputed = a.computedValue && Object.keys(a.computedValue).length > 0;
                  return (
                    <li
                      key={a.id}
                      className="rounded border border-gray-100 px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">{reqLabel}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${RESULT_COLORS[effectiveResult ?? 'NOT_EVALUATED'] ?? ''}`}
                        >
                          {effectiveResult ?? 'NOT_EVALUATED'}
                          {a.isOverridden && ' (override)'}
                        </span>
                        {canEdit && (
                          <button
                            onClick={() =>
                              actions.setOverrideForm({
                                ...actions.overrideForm,
                                assessmentId: a.id,
                                overrideResult: effectiveResult ?? '',
                              })
                            }
                            className="text-xs text-amber-600 hover:text-amber-700"
                          >
                            Override
                          </button>
                        )}
                      </div>
                      {hasComputed && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                            View details
                          </summary>
                          <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-600">
                            {JSON.stringify(a.computedValue, null, 2)}
                          </pre>
                          {a.calculatorCode && (
                            <span className="mt-1 block text-xs text-gray-400">
                              {a.calculatorCode} v{a.calculatorVersion}
                            </span>
                          )}
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {actions.overrideForm.assessmentId && canEdit && (
            <form onSubmit={actions.applyOverride} className="rounded border border-amber-200 bg-amber-50/50 p-4">
              <h4 className="text-sm font-medium text-amber-800">Override assessment</h4>
              <div className="mt-2 space-y-2">
                <select
                  value={actions.overrideForm.overrideResult}
                  onChange={(e) =>
                    actions.setOverrideForm({ ...actions.overrideForm, overrideResult: e.target.value })
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select result</option>
                  <option value={AssessmentResult.PASS}>PASS</option>
                  <option value={AssessmentResult.FAIL}>FAIL</option>
                  <option value={AssessmentResult.PARTIAL}>PARTIAL</option>
                </select>
                <textarea
                  value={actions.overrideForm.overrideReason}
                  onChange={(e) =>
                    actions.setOverrideForm({ ...actions.overrideForm, overrideReason: e.target.value })
                  }
                  placeholder="Reason for override (min 10 chars)"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  rows={2}
                  required
                  minLength={10}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={actions.overriding || actions.overrideForm.overrideReason.length < 10}
                    className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      actions.setOverrideForm({
                        assessmentId: '',
                        overrideResult: '',
                        overrideReason: '',
                      })
                    }
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
