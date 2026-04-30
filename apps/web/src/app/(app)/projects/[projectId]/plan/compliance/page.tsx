'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@storyos/ui';
import { ResidencySection } from '@/components/project/sections/compliance/residency-section';

export default function PlanCompliancePage() {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';

  return (
    <div className="space-y-10">
      <ResidencySection projectId={projectId} />

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            Documents are project-global. Compliance evidence (chain of title,
            contracts, residency proofs, etc.) lives in the document library.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={`/projects/${projectId}/documents`}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            Open document library →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
