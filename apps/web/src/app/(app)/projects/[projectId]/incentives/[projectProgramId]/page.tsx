import { redirect } from 'next/navigation';

interface IncentiveIndexPageProps {
  params: Promise<{ projectId: string; projectProgramId: string }>;
}

export default async function IncentiveIndexPage({ params }: IncentiveIndexPageProps) {
  const { projectId, projectProgramId } = await params;
  redirect(`/projects/${projectId}/incentives/${projectProgramId}/part-a`);
}
