'use client';

import { useParams } from 'next/navigation';
import { ProjectTabs } from '@/components/project/shell/project-tabs';

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <ProjectTabs projectId={projectId} />
      </div>
      {children}
    </div>
  );
}
