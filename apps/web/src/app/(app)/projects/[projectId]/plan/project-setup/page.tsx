'use client';

import { useParams } from 'next/navigation';
import { MetadataSection } from '@/components/project/sections/project-setup/metadata-section';
import { FormatSection } from '@/components/project/sections/project-setup/format-section';
import { ParticipantsSection } from '@/components/project/sections/project-setup/participants-section';

export default function PlanProjectSetupPage() {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';

  return (
    <div className="space-y-10">
      <MetadataSection projectId={projectId} />
      <FormatSection projectId={projectId} />
      <ParticipantsSection projectId={projectId} />
    </div>
  );
}
