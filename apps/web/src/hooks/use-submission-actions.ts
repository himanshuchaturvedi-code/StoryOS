'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { AssessmentResult, SubmissionStatus } from '@storyos/types';
import { apiClient } from '@/lib/api-client';
import type { ProgramSubmission } from '@/hooks/use-programs';

interface UseSubmissionActionsOptions {
  projectId: string;
  onRefresh?: () => void | Promise<void>;
}

export interface SubmissionSelection {
  projectProgramId: string;
  submissionId: string;
  submission: ProgramSubmission | null;
}

const EMPTY_OVERRIDE_FORM = {
  assessmentId: '',
  overrideResult: '',
  overrideReason: '',
};

export function useSubmissionActions({ projectId, onRefresh }: UseSubmissionActionsOptions) {
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionSelection | null>(null);
  const [overrideForm, setOverrideForm] = useState(EMPTY_OVERRIDE_FORM);
  const [overriding, setOverriding] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    await onRefresh?.();
  }, [onRefresh]);

  const createSubmission = useCallback(
    async (projectProgramId: string) => {
      const evaluationDate = new Date().toISOString().slice(0, 10);
      await apiClient.post(`/projects/${projectId}/programs/${projectProgramId}/submissions`, {
        evaluationDate,
      });
      await refresh();
      setSelectedSubmission(null);
    },
    [projectId, refresh],
  );

  const transitionStatus = useCallback(
    async (projectProgramId: string, submissionId: string, status: SubmissionStatus) => {
      await apiClient.patch(
        `/projects/${projectId}/programs/${projectProgramId}/submissions/${submissionId}`,
        { status },
      );
      await refresh();
      setSelectedSubmission(null);
    },
    [projectId, refresh],
  );

  const loadSubmission = useCallback(
    async (projectProgramId: string, submissionId: string) => {
      const submission = await apiClient.get<ProgramSubmission>(
        `/projects/${projectId}/programs/${projectProgramId}/submissions/${submissionId}`,
      );
      setSelectedSubmission({ projectProgramId, submissionId, submission });
      return submission;
    },
    [projectId],
  );

  const initializeAssessments = useCallback(
    async (projectProgramId: string, submissionId: string) => {
      await apiClient.post(
        `/projects/${projectId}/programs/${projectProgramId}/submissions/${submissionId}/assessments/initialize`,
        {},
      );
      await refresh();
      if (selectedSubmission?.submissionId === submissionId) {
        await loadSubmission(projectProgramId, submissionId);
      }
    },
    [loadSubmission, projectId, refresh, selectedSubmission?.submissionId],
  );

  const evaluateSubmission = useCallback(
    async (projectProgramId: string, submissionId: string) => {
      setEvaluating(true);
      setEvalError(null);
      try {
        await apiClient.post(
          `/projects/${projectId}/programs/${projectProgramId}/submissions/${submissionId}/evaluate`,
          {},
        );
        await refresh();
        if (selectedSubmission?.submissionId === submissionId) {
          await loadSubmission(projectProgramId, submissionId);
        }
      } catch (err) {
        setEvalError(err instanceof Error ? err.message : 'Evaluation failed');
      } finally {
        setEvaluating(false);
      }
    },
    [loadSubmission, projectId, refresh, selectedSubmission?.submissionId],
  );

  const applyOverride = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (
        !selectedSubmission ||
        !overrideForm.assessmentId ||
        !overrideForm.overrideResult ||
        !overrideForm.overrideReason
      ) {
        return;
      }

      setOverriding(true);
      try {
        await apiClient.post(
          `/projects/${projectId}/programs/${selectedSubmission.projectProgramId}/submissions/${selectedSubmission.submissionId}/assessments/${overrideForm.assessmentId}/override`,
          {
            overrideResult: overrideForm.overrideResult as AssessmentResult,
            overrideReason: overrideForm.overrideReason,
          },
        );
        setOverrideForm(EMPTY_OVERRIDE_FORM);
        await refresh();
        await loadSubmission(selectedSubmission.projectProgramId, selectedSubmission.submissionId);
      } finally {
        setOverriding(false);
      }
    },
    [loadSubmission, overrideForm, projectId, refresh, selectedSubmission],
  );

  return {
    selectedSubmission,
    setSelectedSubmission,
    overrideForm,
    setOverrideForm,
    overriding,
    evaluating,
    evalError,
    createSubmission,
    transitionStatus,
    loadSubmission,
    initializeAssessments,
    evaluateSubmission,
    applyOverride,
  };
}
