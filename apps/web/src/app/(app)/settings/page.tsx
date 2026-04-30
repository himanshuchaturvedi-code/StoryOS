'use client';

import { useState, useEffect } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { useTenant } from '@/contexts/tenant-context';
import { Button, Card, CardContent, CardHeader, Input } from '@storyos/ui';

interface OrgDetails {
  id: string;
  name: string;
  slug: string;
  orgType: string;
  website?: string | null;
  description?: string | null;
}

interface Member {
  id: string;
  role: string;
  user: { id: string; firstName: string; lastName: string; email: string };
}

export default function SettingsPage() {
  const { currentOrgId, refetchOrgs } = useTenant();

  const [org, setOrg] = useState<OrgDetails | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit org form
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrgId) return;
    setIsLoading(true);
    Promise.all([
      apiClient.get<OrgDetails>('/organizations/current'),
      apiClient.get<Member[]>('/members'),
    ])
      .then(([orgData, memberData]) => {
        setOrg(orgData);
        setName(orgData?.name ?? '');
        setWebsite(orgData?.website ?? '');
        setDescription(orgData?.description ?? '');
        setMembers(memberData ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load settings'))
      .finally(() => setIsLoading(false));
  }, [currentOrgId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaveSuccess(false);
    setIsSaving(true);
    try {
      const updated = await apiClient.patch<OrgDetails>('/organizations/current', {
        name,
        website: website || undefined,
        description: description || undefined,
      });
      setOrg(updated);
      setSaveSuccess(true);
      await refetchOrgs();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save organization');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setError(null);
    setInviteSuccess(null);
    setIsInviting(true);
    try {
      await apiClient.post('/invitations', { email: inviteEmail, role: inviteRole });
      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    try {
      await apiClient.delete(`/members/${memberId}`);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to remove member');
    }
  }

  if (!currentOrgId) {
    return <p className="text-sm text-gray-500">Select an organization to view settings.</p>;
  }

  if (isLoading) return <p className="text-sm text-gray-500">Loading settings…</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900">Organization settings</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <h2 className="font-medium text-gray-900">Organization details</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Slug</label>
              <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                {org?.slug}
              </p>
              <p className="mt-1 text-xs text-gray-400">Slug cannot be changed after creation.</p>
            </div>
            <Input
              label="Website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            {saveSuccess && (
              <p className="text-sm text-green-600">Organization updated successfully.</p>
            )}
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium text-gray-900">Invite member</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label="Email address"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <Button type="submit" disabled={isInviting || !inviteEmail}>
              {isInviting ? 'Sending…' : 'Send invite'}
            </Button>
          </form>
          {inviteSuccess && <p className="mt-2 text-sm text-green-600">{inviteSuccess}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium text-gray-900">Members ({members.length})</h2>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-gray-500">No members found.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {m.user.firstName} {m.user.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{m.user.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                      {m.role}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(m.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
