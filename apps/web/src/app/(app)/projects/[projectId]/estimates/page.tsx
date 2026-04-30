'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, Button } from '@storyos/ui';
import { ApiError, apiClient } from '@/lib/api-client';
import { useProjectPrograms } from '@/hooks/use-programs';

type RequirementResultStatus = 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT_EVALUATED';

interface EstimatePreviewResult {
  requirementId: string;
  requirementCode: string;
  category: string;
  result: RequirementResultStatus;
  computedValue: Record<string, unknown>;
  calculatorCode: string;
}

interface EstimatePreviewProgram {
  projectProgramId: string;
  programName: string;
  results: EstimatePreviewResult[];
}

interface EstimatePreviewResponse {
  programs: EstimatePreviewProgram[];
}

const RESULT_COLORS: Record<RequirementResultStatus, string> = {
  PASS: 'bg-green-100 text-green-700',
  FAIL: 'bg-red-100 text-red-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  NOT_EVALUATED: 'bg-gray-100 text-gray-500',
};

function getResultExplanation(computedValue: Record<string, unknown>): string | null {
  const reason = computedValue['reason'];
  if (typeof reason === 'string' && reason.trim()) return reason;

  const error = computedValue['error'];
  if (typeof error === 'string' && error.trim()) return error;

  return null;
}

function getSummary(results: EstimatePreviewResult[]) {
  return {
    pass: results.filter((result) => result.result === 'PASS').length,
    fail: results.filter((result) => result.result === 'FAIL').length,
    partial: results.filter((result) => result.result === 'PARTIAL').length,
    notEvaluated: results.filter((result) => result.result === 'NOT_EVALUATED').length,
  };
}

export default function EstimatesPage() {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';
  const { enrollments, isLoading: enrollmentsLoading } = useProjectPrograms(projectId);

  const [preview, setPreview] = useState<EstimatePreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeEnrollments = useMemo(
    () => enrollments.filter((enrollment) => enrollment.status === 'ACTIVE'),
    [enrollments],
  );

  const loadPreview = useCallback(async (showRefreshingState: boolean) => {
    if (!projectId) return;

    try {
      setError(null);
      if (showRefreshingState) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const result = await apiClient.post<EstimatePreviewResponse>(
        `/projects/${projectId}/estimate-preview`,
        {},
      );
      setPreview(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load estimate preview');
      setPreview(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadPreview(false);
  }, [loadPreview]);

  if (isLoading || enrollmentsLoading) {
    return <p className="text-sm text-gray-500">Loading estimates...</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-gray-900">Estimated Incentives</h2>
              <p className="text-sm text-gray-500">
                Live preview based on current project data. This does not create submissions or
                store assessment results.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => void loadPreview(true)}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Refreshing…' : 'Refresh'}
              </Button>
              <Link href={`/projects/${projectId}/plan/financials#budget`}>
                <Button>Run Formal Evaluation</Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          {activeEnrollments.length === 0 && (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              No active program enrollments found. Enroll the project in at least one program to
              see estimate results.
            </div>
          )}

          {preview?.programs.length === 0 && activeEnrollments.length > 0 && !error && (
            <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
              No preview results are available yet for the current active programs.
            </div>
          )}

          <div className="space-y-4">
            {preview?.programs.map((program) => {
              const summary = getSummary(program.results);

              return (
                <div key={program.projectProgramId} className="rounded-lg border border-gray-200">
                  <div className="border-b border-gray-200 px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{program.programName}</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {program.results.length} requirement
                          {program.results.length !== 1 ? 's' : ''} evaluated
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-green-100 px-2 py-1 text-green-700">
                          {summary.pass} PASS
                        </span>
                        <span className="rounded-full bg-red-100 px-2 py-1 text-red-700">
                          {summary.fail} FAIL
                        </span>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                          {summary.partial} PARTIAL
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600">
                          {summary.notEvaluated} NOT_EVALUATED
                        </span>
                      </div>
                    </div>
                  </div>

                  {program.results.length === 0 ? (
                    <div className="px-5 py-6 text-sm text-gray-500">
                      No requirement definitions were returned for this program.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                              Requirement
                            </th>
                            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                              Category
                            </th>
                            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                              Result
                            </th>
                            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                              Details
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {program.results.map((result) => {
                            const explanation = getResultExplanation(result.computedValue);

                            return (
                              <tr key={result.requirementId} className="border-t border-gray-100">
                                <td className="px-4 py-3 align-top">
                                  <div className="text-sm font-medium text-gray-900">
                                    {result.requirementCode}
                                  </div>
                                  <div className="mt-1 text-xs text-gray-500">
                                    Calculator: {result.calculatorCode}
                                  </div>
                                </td>
                                <td className="px-4 py-3 align-top text-sm text-gray-600">
                                  {result.category}
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${RESULT_COLORS[result.result]}`}
                                  >
                                    {result.result}
                                  </span>
                                </td>
                                <td className="px-4 py-3 align-top">
                                  {explanation ? (
                                    <p className="text-sm text-gray-600">{explanation}</p>
                                  ) : (
                                    <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-gray-50 p-2 text-xs text-gray-600">
                                      {JSON.stringify(result.computedValue, null, 2)}
                                    </pre>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
