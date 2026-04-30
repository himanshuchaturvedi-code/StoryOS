'use client';

import { useParams } from 'next/navigation';
import { ActualsReferenceCard } from '@/components/project/shell/actuals-reference-card';

export default function ActualsOwnershipRightsPage() {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';

  return (
    <ActualsReferenceCard
      title="Ownership & Rights Reference"
      description="Ownership and rights assertions are read-only in Actuals. Maintain them in Plan so actual reporting uses the same source of truth."
      links={[
        {
          href: `/projects/${projectId}/plan/ownership-rights`,
          label: 'Open Plan Ownership & Rights',
        },
        { href: `/projects/${projectId}/plan/ownership-rights#ownership`, label: 'Open Ownership' },
        { href: `/projects/${projectId}/plan/ownership-rights#rights`, label: 'Open Rights' },
      ]}
    />
  );
}
