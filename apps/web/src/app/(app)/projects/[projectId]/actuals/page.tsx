import { redirect } from 'next/navigation';

interface ActualsIndexPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ActualsIndexPage({ params }: ActualsIndexPageProps) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/actuals/overview`);
}
