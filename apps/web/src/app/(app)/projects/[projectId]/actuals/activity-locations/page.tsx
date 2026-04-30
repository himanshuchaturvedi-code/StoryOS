'use client';

import { useParams } from 'next/navigation';
import { ActivityDaysSection } from '@/components/project/sections/activity-locations/activity-days-section';
import { ActualsReferenceCard } from '@/components/project/shell/actuals-reference-card';

export default function ActualsActivityLocationsPage() {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';

  return (
    <div className="space-y-10">
      <ActualsReferenceCard
        title="Planned Activity & Locations"
        description="Locations and activity plans stay in Plan. Log actual activity days here against that context."
        links={[
          {
            href: `/projects/${projectId}/plan/activity-locations`,
            label: 'Open Plan Activity & Locations',
          },
          { href: `/projects/${projectId}/plan/activity-locations#locations`, label: 'Open Locations' },
          { href: `/projects/${projectId}/plan/activity-locations#activity-plan`, label: 'Open Activity Plan' },
        ]}
      />

      <ActivityDaysSection projectId={projectId} />
    </div>
  );
}
