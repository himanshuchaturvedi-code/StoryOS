import { redirect } from 'next/navigation';

export default async function IncentivesRedirectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/plan/incentive-strategy`);
}
