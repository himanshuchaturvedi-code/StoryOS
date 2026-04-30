'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@storyos/ui';
import { apiClient } from '@/lib/api-client';

interface StrategyProgram {
  programVersionId: string;
  programCode: string;
  programName: string;
  estimatedAmount: number;
  estimateAvailable: boolean;
}

interface StrategyScenario {
  id: string;
  title: string;
  totalEstimatedAmount: number;
  estimateAvailable: boolean;
  isEligible: boolean;
  status: 'PASS' | 'RISK' | 'FAIL';
  programs: StrategyProgram[];
}

interface IncentiveStrategyResponse {
  recommendedScenarioId: string | null;
  scenarios: StrategyScenario[];
}

export function GrantEstimateCard({ projectId }: { projectId: string }) {
  const [data, setData] = useState<IncentiveStrategyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      projectId || '',
    );

    setError(null);
    setData(null);
    setIsLoading(isValidUuid);

    if (!isValidUuid) return;

    async function fetchStrategy() {
      try {
        const response = await apiClient.get<IncentiveStrategyResponse>(
          `/projects/${projectId}/incentive-strategy?source=BUDGET`,
        );
        if (mounted) setData(response);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load incentive strategy');
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    fetchStrategy();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  const recommended = useMemo(
    () =>
      data?.scenarios.find((scenario) => scenario.id === data.recommendedScenarioId) ??
      data?.scenarios[0] ??
      null,
    [data],
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Incentive Strategy</CardTitle>
        <CardDescription>
          Recommended production-level incentive outcome from current plan inputs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-500">Calculating strategy...</p>
        ) : error ? (
          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-sm text-gray-600">Strategy unavailable: {error}</p>
          </div>
        ) : !recommended ? (
          <p className="text-sm text-gray-500">No incentive strategy available yet.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
                  Recommended Strategy
                </p>
                <p className="text-lg font-semibold text-gray-900">{recommended.title}</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900 tracking-tight">
                  {recommended.estimateAvailable
                    ? formatCurrency(recommended.totalEstimatedAmount)
                    : 'Estimate unavailable'}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Simple Phase 1 outcome; stacking and grinding are not applied yet.
                </p>
              </div>
              <Link
                href={`/projects/${projectId}/plan/incentive-strategy`}
                className="shrink-0 text-sm font-medium text-brand-600 hover:underline"
              >
                View strategies →
              </Link>
            </div>

            <div className="flex flex-wrap gap-2">
              {recommended.programs.map((program) => (
                <span
                  key={program.programVersionId}
                  className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
                >
                  {program.programCode}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
