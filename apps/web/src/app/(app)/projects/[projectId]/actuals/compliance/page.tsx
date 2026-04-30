'use client';

import { useParams } from 'next/navigation';
import { ActualsReferenceCard } from '@/components/project/shell/actuals-reference-card';

export default function ActualsCompliancePage() {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';

  return (
    <ActualsReferenceCard
      title="Compliance Reference"
      description="Residency records and project documents are used as compliance context for Actuals. Documents remain project-global."
      links={[
        { href: `/projects/${projectId}/plan/compliance`, label: 'Open Plan Compliance' },
        { href: `/projects/${projectId}/plan/compliance#residency`, label: 'Open Residency' },
        { href: `/projects/${projectId}/documents`, label: 'Open Documents' },
      ]}
    />
  );
}
