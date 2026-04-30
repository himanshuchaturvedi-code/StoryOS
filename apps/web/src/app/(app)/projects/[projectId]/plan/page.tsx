import { redirect } from 'next/navigation';

interface PlanIndexPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function PlanIndexPage({ params }: PlanIndexPageProps) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/plan/overview`);
}
