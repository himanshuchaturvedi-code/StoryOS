'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { apiClient } from '@/lib/api-client';

const CPTC_ROLES = [
  'DIRECTOR',
  'SCREENWRITER',
  'LEAD_PERFORMER_1',
  'LEAD_PERFORMER_2',
  'DIRECTOR_OF_PHOTOGRAPHY',
  'ART_DIRECTOR',
  'MUSIC_COMPOSER',
  'PICTURE_EDITOR',
] as const;

type CptcRole = (typeof CPTC_ROLES)[number];

interface TemplateAccount {
  id: string;
  code: string;
  name: string;
  accountType: string | null;
  cptcRole: CptcRole | null;
  isHeader: boolean;
  sortOrder: number;
  parentId: string | null;
  usageCount?: number;
  inUse?: boolean;
  children?: TemplateAccount[];
}

interface BudgetTemplate {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
  accounts?: TemplateAccount[];
}

function formatRoleLabel(role: string) {
  return role
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function flattenAccounts(accounts: TemplateAccount[] = []): TemplateAccount[] {
  return accounts.flatMap((account) => [account, ...flattenAccounts(account.children ?? [])]);
}

function AccountRow({
  account,
  depth = 0,
  onSave,
  onDelete,
}: {
  account: TemplateAccount;
  depth?: number;
  onSave: (account: TemplateAccount, payload: Partial<TemplateAccount>) => Promise<void>;
  onDelete: (account: TemplateAccount) => Promise<void>;
}) {
  const [code, setCode] = useState(account.code);
  const [name, setName] = useState(account.name);
  const [cptcRole, setCptcRole] = useState<CptcRole | ''>(account.cptcRole ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCode(account.code);
    setName(account.name);
    setCptcRole(account.cptcRole ?? '');
  }, [account.code, account.name, account.cptcRole]);

  const isDirty = code !== account.code || name !== account.name || (cptcRole || null) !== account.cptcRole;
  const hasChildren = Boolean(account.children?.length);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(account, {
        code: code.trim(),
        name: name.trim(),
        cptcRole: cptcRole || null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save GL');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <tr className="border-b border-gray-100 align-top">
        <td className="py-2 pl-4 pr-2 text-sm text-gray-700" style={{ paddingLeft: `${(depth + 1) * 14}px` }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={account.inUse}
            className="w-24 rounded border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-100 disabled:text-gray-500"
          />
          {account.inUse && (
            <p className="mt-1 text-[11px] text-amber-700">
              In use in {account.usageCount ?? 0} project budget{account.usageCount === 1 ? '' : 's'}; code/delete locked.
            </p>
          )}
        </td>
        <td className="py-2 px-2 text-sm text-gray-700">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full rounded border border-gray-300 px-2 py-1 text-xs ${
              account.isHeader ? 'font-semibold text-gray-900' : ''
            }`}
          />
          {error && <p className="mt-1 text-[11px] text-red-700">{error}</p>}
        </td>
        <td className="py-2 px-2 text-xs text-gray-500">{account.accountType ?? '-'}</td>
        <td className="py-2 px-2">
          <select
            value={cptcRole}
            onChange={(e) => setCptcRole(e.target.value as CptcRole | '')}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          >
            <option value="">No CPTC role</option>
            {CPTC_ROLES.map((role) => (
              <option key={role} value={role}>
                {formatRoleLabel(role)}
              </option>
            ))}
          </select>
        </td>
        <td className="py-2 px-2 text-right">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || isSaving || !name.trim() || !code.trim()}
              className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => onDelete(account)}
              disabled={account.inUse || hasChildren}
              title={
                account.inUse
                  ? 'Cannot delete a GL used in a project'
                  : hasChildren
                    ? 'Delete child GLs first'
                    : 'Delete GL'
              }
              className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </td>
      </tr>
      {account.children?.map((child) => (
        <AccountRow
          key={child.id}
          account={child}
          depth={depth + 1}
          onSave={onSave}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

export default function BudgetTemplatesPage() {
  const [templates, setTemplates] = useState<BudgetTemplate[]>([]);
  const [selected, setSelected] = useState<BudgetTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [newAccount, setNewAccount] = useState({
    code: '',
    name: '',
    parentId: '',
    cptcRole: '' as CptcRole | '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setError(null);
      const list = await apiClient.get<BudgetTemplate[]>('/budget-templates');
      setTemplates(list ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const loadAccounts = async (template: BudgetTemplate) => {
    try {
      const full = await apiClient.get<BudgetTemplate & { accounts: TemplateAccount[] }>(
        `/budget-templates/${template.id}`,
      );
      setSelected(full);
      setTemplateName(full.name);
      setTemplateDescription(full.description ?? '');
    } catch {
      setSelected(template);
      setTemplateName(template.name);
      setTemplateDescription(template.description ?? '');
    }
  };

  const refreshSelected = async () => {
    if (!selected) return;
    const full = await apiClient.get<BudgetTemplate & { accounts: TemplateAccount[] }>(
      `/budget-templates/${selected.id}`,
    );
    setSelected(full);
    setTemplateName(full.name);
    setTemplateDescription(full.description ?? '');
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/budget-templates', { name: newName.trim(), description: newDesc || null });
      setNewName('');
      setNewDesc('');
      setShowNew(false);
      await fetchTemplates();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    try {
      await apiClient.delete(`/budget-templates/${id}`);
      if (selected?.id === id) setSelected(null);
      await fetchTemplates();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete template');
    }
  };

  const handleSaveTemplate = async () => {
    if (!selected || !templateName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiClient.patch<BudgetTemplate>(`/budget-templates/${selected.id}`, {
        name: templateName.trim(),
        description: templateDescription.trim() || null,
      });
      setSelected({ ...selected, ...updated });
      await fetchTemplates();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAccount = async (
    account: TemplateAccount,
    payload: Partial<TemplateAccount>,
  ) => {
    if (!selected) return;
    await apiClient.patch(`/budget-templates/${selected.id}/accounts/${account.id}`, payload);
    await refreshSelected();
  };

  const handleDeleteAccount = async (account: TemplateAccount) => {
    if (!selected) return;
    if (!confirm(`Delete GL ${account.code} ${account.name}?`)) return;
    try {
      await apiClient.delete(`/budget-templates/${selected.id}/accounts/${account.id}`);
      await refreshSelected();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete GL');
    }
  };

  const handleAddAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !newAccount.code.trim() || !newAccount.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const flatAccounts = flattenAccounts(selected.accounts ?? []);
      await apiClient.post(`/budget-templates/${selected.id}/accounts`, {
        code: newAccount.code.trim(),
        name: newAccount.name.trim(),
        parentId: newAccount.parentId || null,
        cptcRole: newAccount.cptcRole || null,
        isHeader: false,
        sortOrder: flatAccounts.length + 1,
      });
      setNewAccount({ code: '', name: '', parentId: '', cptcRole: '' });
      await refreshSelected();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add GL');
    } finally {
      setSaving(false);
    }
  };

  const flatSelectedAccounts = flattenAccounts(selected?.accounts ?? []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Budget Templates</h1>
          <p className="mt-1 text-sm text-gray-500">
            Org-level chart of accounts templates. Apply a template when creating a new budget to
            pre-populate its account structure.
          </p>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          New Template
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {showNew && (
        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3"
        >
          <h2 className="text-sm font-medium text-gray-800">New Template</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Canadian Feature Film"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Optional description"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Template list */}
        <div className="col-span-1 space-y-2">
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-gray-500">No templates yet.</p>
          ) : (
            templates.map((t) => (
              <div
                key={t.id}
                onClick={() => loadAccounts(t)}
                className={`cursor-pointer rounded-lg border p-3 hover:border-brand-300 transition-colors ${
                  selected?.id === t.id
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t.name}</p>
                    {t.description && (
                      <p className="mt-0.5 text-xs text-gray-500">{t.description}</p>
                    )}
                    {t.isDefault && (
                      <span className="mt-1 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                        Default
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                    className="ml-2 text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Account tree */}
        <div className="col-span-2">
          {selected ? (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="space-y-3 border-b border-gray-200 px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Template Details</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Edit template name, GL names, and CPTC role mappings. Used GL codes cannot be changed or deleted.
                  </p>
                </div>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
                  <input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Template name"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Description"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    disabled={saving || !templateName.trim()}
                    className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    Save Template
                  </button>
                </div>
                <form onSubmit={handleAddAccount} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Add GL</div>
                  <div className="grid grid-cols-[90px_1fr_1fr_1fr_auto] gap-2">
                    <input
                      value={newAccount.code}
                      onChange={(e) => setNewAccount((value) => ({ ...value, code: e.target.value }))}
                      placeholder="Code"
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                    <input
                      value={newAccount.name}
                      onChange={(e) => setNewAccount((value) => ({ ...value, name: e.target.value }))}
                      placeholder="GL name"
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                    <select
                      value={newAccount.parentId}
                      onChange={(e) => setNewAccount((value) => ({ ...value, parentId: e.target.value }))}
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                    >
                      <option value="">Root GL</option>
                      {flatSelectedAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.code} {account.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newAccount.cptcRole}
                      onChange={(e) =>
                        setNewAccount((value) => ({ ...value, cptcRole: e.target.value as CptcRole | '' }))
                      }
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                    >
                      <option value="">No CPTC role</option>
                      {CPTC_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {formatRoleLabel(role)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={saving || !newAccount.code.trim() || !newAccount.name.trim()}
                      className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </form>
              </div>
              {selected.accounts && selected.accounts.length > 0 ? (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="py-2 pl-4 pr-2 text-xs font-medium text-gray-500">Code</th>
                      <th className="py-2 px-2 text-xs font-medium text-gray-500">Name</th>
                      <th className="py-2 px-2 text-xs font-medium text-gray-500">Type</th>
                      <th className="py-2 px-2 text-xs font-medium text-gray-500">CPTC Role</th>
                      <th className="py-2 px-2 text-right text-xs font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.accounts
                      .filter((a) => !a.parentId)
                      .map((root) => (
                        <AccountRow
                          key={root.id}
                          account={root}
                          onSave={handleSaveAccount}
                          onDelete={handleDeleteAccount}
                        />
                      ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-center text-sm text-gray-500">
                  No accounts defined. Add a GL above to start this template.
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-300 p-12 text-sm text-gray-400">
              Select a template to view its accounts
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
