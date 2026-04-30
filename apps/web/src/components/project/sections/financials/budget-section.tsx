'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useBudgets,
  useBudgetVersion,
  useReconciliation,
  useAnnotationCompleteness,
} from '@/hooks/use-budgets';
import { useProjectPrograms } from '@/hooks/use-programs';
import { useDerivedRoles } from '@/hooks/use-derived-roles';
import { apiClient } from '@/lib/api-client';
import { formatProvinceStateCell } from '@/lib/province-display';
import type { Budget, BudgetLine, BudgetVersionAccount } from '@/hooks/use-budgets';
import type { DerivedRoleResolutionWithAccounts, DerivedRolesResponse } from '@storyos/types';
// Use string literals to avoid @storyos/types enum bundling issues in Next.js
const ExpenseType = { LABOUR: 'LABOUR', NON_LABOUR: 'NON_LABOUR', MIXED: 'MIXED' } as const;
const ActivityType = {
  DIGITAL_ANIMATION: 'DIGITAL_ANIMATION',
  VISUAL_EFFECTS: 'VISUAL_EFFECTS',
  POST_PRODUCTION: 'POST_PRODUCTION',
} as const;
const EvaluationSource = { BUDGET: 'BUDGET', ACTUAL: 'ACTUAL', BLENDED: 'BLENDED' } as const;
type EvaluationSourceValue = (typeof EvaluationSource)[keyof typeof EvaluationSource];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);
}

interface BudgetTemplateOption {
  id: string;
  name: string;
}

interface AccountNode extends BudgetVersionAccount {
  children: AccountNode[];
  lines: BudgetLine[];
  subtotal: number;
}

function buildAccountTree(
  accounts: BudgetVersionAccount[],
  lines: BudgetLine[],
): AccountNode[] {
  const linesByAcct = new Map<string, BudgetLine[]>();
  for (const l of lines) {
    const arr = linesByAcct.get(l.budgetAccountId) ?? [];
    arr.push(l);
    linesByAcct.set(l.budgetAccountId, arr);
  }

  const map = new Map<string, AccountNode>();
  for (const a of accounts) {
    map.set(a.id, {
      ...a,
      children: [],
      lines: linesByAcct.get(a.id) ?? [],
      subtotal: 0,
    });
  }

  const roots: AccountNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function computeSubtotal(n: AccountNode): number {
    const own = n.lines.reduce((s, l) => s + Number(l.amount), 0);
    const childSum = n.children.reduce((s, c) => s + computeSubtotal(c), 0);
    n.subtotal = own + childSum;
    return n.subtotal;
  }
  roots.forEach(computeSubtotal);

  return roots;
}

// ── Role Mapping Indicator ───────────────────────────────────────────────────

interface AccountRoleInfo {
  programCode: string;
  programName: string;
  roleCode: string;
  personName: string | null;
  residencyStatus: string | null;
  status: 'assigned' | 'missing' | 'issue';
  statusDetail: string | null;
}

type AccountRoleMap = Map<string, AccountRoleInfo[]>;

function buildAccountRoleMap(
  derivedData: { programs: Array<{
    programCode: string;
    programName: string;
    roles: DerivedRoleResolutionWithAccounts[];
  }> } | null,
): AccountRoleMap {
  const map: AccountRoleMap = new Map();
  if (!derivedData) return map;

  for (const program of derivedData.programs) {
    for (const role of program.roles) {
      for (const accountId of role.mappedAccountIds) {
        const list = map.get(accountId) ?? [];

        let status: AccountRoleInfo['status'] = 'missing';
        let personName: string | null = null;
        let residencyStatus: string | null = null;
        let statusDetail: string | null = null;

        if (role.selectedAssignment) {
          personName = role.selectedAssignment.personName;
          residencyStatus = role.selectedAssignment.residency?.residencyType ?? null;
          if (!role.selectedAssignment.residency) {
            status = 'issue';
            statusDetail = 'Missing residency';
          } else {
            status = 'assigned';
          }
        } else {
          statusDetail = 'No person assigned';
        }

        list.push({
          programCode: program.programCode,
          programName: program.programName,
          roleCode: role.roleCode,
          personName,
          residencyStatus,
          status,
          statusDetail,
        });
        map.set(accountId, list);
      }
    }
  }
  return map;
}

function RoleIndicator({ roles }: { roles: AccountRoleInfo[] }) {
  const [open, setOpen] = useState(false);
  if (roles.length === 0) return null;

  const hasIssue = roles.some((r) => r.status === 'missing' || r.status === 'issue');

  return (
    <span className="relative inline-block ml-1.5 align-middle">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold leading-none ${
          hasIssue
            ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
            : 'bg-brand-100 text-brand-700 ring-1 ring-brand-300'
        }`}
        title="Incentive role mappings"
      >
        R
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-5 z-50 w-72 rounded-lg border border-gray-200 bg-white shadow-lg p-3 text-xs">
            <div className="font-semibold text-gray-700 mb-2">Role Mappings</div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {roles.map((r, i) => (
                <div key={i} className="rounded border border-gray-100 px-2 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">{r.programCode}</span>
                    <span className="text-gray-500">{r.roleCode.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1">
                    {r.status === 'assigned' && (
                      <>
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                        <span className="text-gray-700">{r.personName}</span>
                        {r.residencyStatus && (
                          <span className="text-gray-400">({r.residencyStatus.replace(/_/g, ' ').toLowerCase()})</span>
                        )}
                      </>
                    )}
                    {r.status === 'missing' && (
                      <>
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span className="text-amber-700">{r.statusDetail ?? 'Unassigned'}</span>
                      </>
                    )}
                    {r.status === 'issue' && (
                      <>
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                        <span className="text-red-700">{r.personName} — {r.statusDetail}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </span>
  );
}

// ── Editable line row within a leaf account ─────────────────────────────────

function LineEditRow({
  line,
  budgetId,
  versionId,
  onSaved,
  onDelete,
  canDelete,
}: {
  line: BudgetLine;
  budgetId: string;
  versionId: string;
  onSaved: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const [description, setDescription] = useState(line.description ?? '');
  const [amount, setAmount] = useState(String(Number(line.amount)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDescription(line.description ?? '');
    setAmount(String(Number(line.amount)));
  }, [line.id, line.description, line.amount]);

  const handleBlur = async () => {
    if (saving) return;
    const amt = parseFloat(amount);
    const desc = description.trim() || null;
    const numAmount = Number.isNaN(amt) ? 0 : amt;
    if (desc === (line.description ?? '') && numAmount === Number(line.amount)) return;

    setSaving(true);
    try {
      if (numAmount === 0 && !desc && canDelete) {
        await apiClient.delete(`/budgets/${budgetId}/versions/${versionId}/lines/${line.id}`);
      } else {
        await apiClient.patch(`/budgets/${budgetId}/versions/${versionId}/lines/${line.id}`, {
          description: desc,
          amount: numAmount,
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className={`border-t border-gray-50 hover:bg-gray-50/40 ${saving ? 'opacity-70' : ''}`}>
      <td className="px-2 py-1" />
      <td className="px-2 py-1">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleBlur}
          disabled={saving}
          placeholder="Description"
          className="w-full min-w-[120px] rounded border border-gray-200 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={handleBlur}
          disabled={saving}
          placeholder="0.00"
          className="w-full min-w-[100px] rounded border border-gray-200 px-2 py-1 text-right font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
        />
      </td>
      <td className="px-1 py-1">
        {canDelete && (
          <button
            onClick={onDelete}
            disabled={saving}
            className="text-gray-400 hover:text-red-500 disabled:opacity-40 text-xs px-1"
            title="Delete line"
          >
            ✕
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Leaf Account Group (multiple lines + add/delete) ─────────────────────────

function LeafAccountGroup({
  node,
  depth,
  budgetId,
  versionId,
  onSaved,
  accountRoleMap,
}: {
  node: AccountNode;
  depth: number;
  budgetId: string;
  versionId: string;
  onSaved: () => void;
  accountRoleMap: AccountRoleMap;
}) {
  const [adding, setAdding] = useState(false);

  const addLine = async () => {
    setAdding(true);
    try {
      await apiClient.post(`/budgets/${budgetId}/versions/${versionId}/lines`, {
        budgetAccountId: node.id,
        description: null,
        amount: 0,
      });
      onSaved();
    } finally {
      setAdding(false);
    }
  };

  const deleteLine = async (lineId: string) => {
    try {
      await apiClient.delete(`/budgets/${budgetId}/versions/${versionId}/lines/${lineId}`);
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete line');
    }
  };

  return (
    <>
      <tr className="border-t border-gray-100 bg-gray-50/30">
        <td
          className="py-1.5 text-xs font-medium text-gray-600"
          style={{ paddingLeft: `${20 + depth * 16}px` }}
          colSpan={2}
        >
          {node.code} — {node.name}
          <RoleIndicator roles={accountRoleMap.get(node.id) ?? []} />
        </td>
        <td className="px-2 py-1.5 text-right font-mono text-xs text-gray-600">
          {node.subtotal > 0 ? fmt(node.subtotal) : '—'}
        </td>
        <td className="px-1 py-1.5" />
      </tr>
      {node.lines.map((line) => (
        <LineEditRow
          key={line.id}
          line={line}
          budgetId={budgetId}
          versionId={versionId}
          onSaved={onSaved}
          onDelete={() => deleteLine(line.id)}
          canDelete={node.lines.length > 1}
        />
      ))}
      {node.lines.length === 0 && (
        <tr className="border-t border-gray-50">
          <td />
          <td colSpan={2} className="px-2 py-1 text-xs text-gray-400 italic">
            No lines yet
          </td>
          <td />
        </tr>
      )}
      <tr>
        <td />
        <td colSpan={2} className="px-2 py-0.5">
          <button
            onClick={addLine}
            disabled={adding}
            className="text-xs text-brand-600 hover:text-brand-800 disabled:opacity-50"
          >
            {adding ? 'Adding...' : '+ Add line'}
          </button>
        </td>
        <td />
      </tr>
    </>
  );
}

// ── Header Account Row (collapsible, read-only) ────────────────────────────────

function HeaderAccountRow({
  node,
  depth,
  isCollapsed,
  onToggle,
  children,
}: {
  node: AccountNode;
  depth: number;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr
        className="cursor-pointer bg-gray-50/70 hover:bg-gray-100/70"
        onClick={onToggle}
      >
        <td
          className="py-1.5 text-xs font-semibold text-gray-700 tracking-wide"
          style={{ paddingLeft: `${20 + depth * 16}px` }}
        >
          <span className="mr-1.5 inline-block w-4 text-gray-500">
            {isCollapsed ? '▶' : '▼'}
          </span>
          {node.code} — {node.name}
        </td>
        <td className="px-2 py-1.5" />
        <td className="px-2 py-1.5 text-right font-mono text-xs text-gray-600">
          {node.subtotal > 0 ? fmt(node.subtotal) : '—'}
        </td>
        <td className="px-1 py-1.5 w-8" />
      </tr>
      {!isCollapsed && children}
    </>
  );
}

// ── Account Tree Row (dispatches to header or leaf) ────────────────────────────

function AccountRow({
  node,
  depth,
  isLocked,
  budgetId,
  versionId,
  collapsedIds,
  onToggleCollapse,
  onSaved,
  accountRoleMap,
}: {
  node: AccountNode;
  depth: number;
  isLocked: boolean;
  budgetId: string;
  versionId: string;
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  onSaved: () => void;
  accountRoleMap: AccountRoleMap;
}) {
  if (node.isHeader) {
    const isCollapsed = collapsedIds.has(node.id);
    return (
      <HeaderAccountRow
        node={node}
        depth={depth}
        isCollapsed={isCollapsed}
        onToggle={() => onToggleCollapse(node.id)}
        children={
          <>
            {node.children.map((child) => (
              <AccountRow
                key={child.id}
                node={child}
                depth={depth + 1}
                isLocked={isLocked}
                budgetId={budgetId}
                versionId={versionId}
                collapsedIds={collapsedIds}
                onToggleCollapse={onToggleCollapse}
                onSaved={onSaved}
                accountRoleMap={accountRoleMap}
              />
            ))}
          </>
        }
      />
    );
  }

  if (!isLocked) {
    return (
      <LeafAccountGroup
        node={node}
        depth={depth}
        budgetId={budgetId}
        versionId={versionId}
        onSaved={onSaved}
        accountRoleMap={accountRoleMap}
      />
    );
  }

  return (
    <>
      <tr className="border-t border-gray-100 bg-gray-50/30">
        <td
          className="py-1.5 text-xs font-medium text-gray-600"
          style={{ paddingLeft: `${20 + depth * 16}px` }}
          colSpan={2}
        >
          {node.code} — {node.name}
          <RoleIndicator roles={accountRoleMap.get(node.id) ?? []} />
        </td>
        <td className="px-2 py-1.5 text-right font-mono text-xs text-gray-600">
          {node.subtotal > 0 ? fmt(node.subtotal) : '—'}
        </td>
      </tr>
      {node.lines.map((line) => (
        <tr key={line.id} className="border-t border-gray-50">
          <td className="px-2 py-1" />
          <td className="px-2 py-1 text-sm text-gray-600">
            {line.description ?? '—'}
          </td>
          <td className="px-2 py-1 text-right font-mono text-sm text-gray-800">
            {fmt(Number(line.amount))}
          </td>
        </tr>
      ))}
      {node.lines.length === 0 && (
        <tr className="border-t border-gray-50">
          <td />
          <td colSpan={2} className="px-2 py-1 text-xs text-gray-400 italic">
            No lines
          </td>
        </tr>
      )}
    </>
  );
}

type VersionTab = 'budget' | 'eligibility' | 'estimate';

// ── Version Detail panel ──────────────────────────────────────────────────────

function VersionPanel({
  projectId,
  budgetId,
  versionId,
  onClose,
  onVersionStatusChanged,
}: {
  projectId: string;
  budgetId: string;
  versionId: string;
  onClose: () => void;
  onVersionStatusChanged: () => void;
}) {
  const { version, isLoading, refetch } = useBudgetVersion(budgetId, versionId);
  const { reconciliation, isLoading: reconLoading, refetch: refetchRecon } = useReconciliation(
    budgetId,
    versionId,
  );
  const { completeness, refetch: refetchCompleteness } = useAnnotationCompleteness(budgetId, versionId);
  const { enrollments } = useProjectPrograms(projectId);
  const { data: derivedRolesData } = useDerivedRoles(projectId, versionId);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [locking, setLocking] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [activeTab, setActiveTab] = useState<VersionTab>('budget');

  const isLocked = version?.status === 'LOCKED';
  const accountRoleMap = useMemo(() => buildAccountRoleMap(derivedRolesData), [derivedRolesData]);

  const handleSaved = useCallback(() => {
    refetch();
    refetchRecon();
    refetchCompleteness();
  }, [refetch, refetchRecon, refetchCompleteness]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const lockVersion = async () => {
    if (!confirm('Lock this version? No further edits will be allowed.')) return;
    setLocking(true);
    try {
      await apiClient.patch(`/budgets/${budgetId}/versions/${versionId}/lock`, {});
      refetch();
      onVersionStatusChanged();
    } finally {
      setLocking(false);
    }
  };

  const unlockVersion = async () => {
    if (!confirm('Unlock this version? Budget lines will become editable again.')) return;
    setUnlocking(true);
    try {
      await apiClient.patch(`/budgets/${budgetId}/versions/${versionId}/unlock`, {});
      refetch();
      onVersionStatusChanged();
    } finally {
      setUnlocking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-500">Loading version...</p>
      </div>
    );
  }

  if (!version) return null;

  const accounts = version.accounts ?? [];
  const tree = buildAccountTree(accounts, version.lines);
  const grandTotal = tree.reduce((s, n) => s + n.subtotal, 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            v{version.versionNumber} — {version.name}
            {isLocked && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Locked
              </span>
            )}
          </h3>
          {version.notes && (
            <p className="mt-0.5 text-xs text-gray-500">{version.notes}</p>
          )}
          <p className="mt-0.5 text-xs text-gray-400">
            {accounts.length} accounts
            {version.lines.length > 0 && ` · ${version.lines.length} line items`}
            {completeness && ` · ${completeness.percentage}% annotated`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLocked ? (
            <button
              onClick={unlockVersion}
              disabled={unlocking}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {unlocking ? 'Unlocking...' : 'Unlock Budget'}
            </button>
          ) : (
            <button
              onClick={lockVersion}
              disabled={locking}
              className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
            >
              {locking ? 'Locking...' : 'Lock Version'}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setActiveTab('budget')}
          className={`px-4 py-2.5 text-xs font-medium ${
            activeTab === 'budget'
              ? 'border-b-2 border-brand-500 text-brand-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Budget
        </button>
        <button
          onClick={() => setActiveTab('eligibility')}
          className={`px-4 py-2.5 text-xs font-medium ${
            activeTab === 'eligibility'
              ? 'border-b-2 border-brand-500 text-brand-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Eligibility
          {completeness && completeness.percentage < 100 && (
            <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-700">
              {completeness.percentage}%
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('estimate')}
          className={`px-4 py-2.5 text-xs font-medium ${
            activeTab === 'estimate'
              ? 'border-b-2 border-brand-500 text-brand-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Part A Estimate
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {activeTab === 'budget' && (
        <>
        {/* Account tree + lines */}
        <div className="overflow-x-auto">
          {accounts.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">
              No accounts. Create this version with a template to populate the chart of accounts.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-5 py-2 text-xs font-medium text-gray-500">Account</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500">Description</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                  <th className="px-1 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {tree.map((node) => (
                  <AccountRow
                    key={node.id}
                    node={node}
                    depth={0}
                    isLocked={isLocked}
                    budgetId={budgetId}
                    versionId={versionId}
                    collapsedIds={collapsedIds}
                    onToggleCollapse={toggleCollapse}
                    onSaved={handleSaved}
                    accountRoleMap={accountRoleMap}
                  />
                ))}
                <tr className="border-t-2 border-gray-300 font-semibold bg-gray-50">
                  <td className="px-5 py-2 text-sm text-gray-900">Total</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right font-mono text-gray-900">{fmt(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Reconciliation */}
        {!reconLoading && reconciliation && (
          <div className="px-5 py-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Budget vs. Actuals
            </h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-1 text-left text-xs font-medium text-gray-500">Account</th>
                  <th className="px-3 py-1 text-right text-xs font-medium text-gray-500">Budget</th>
                  <th className="px-3 py-1 text-right text-xs font-medium text-gray-500">Actual</th>
                  <th className="px-3 py-1 text-right text-xs font-medium text-gray-500">Variance</th>
                </tr>
              </thead>
              <tbody>
                {reconciliation.lines
                  .filter((l) => l.budgetTotal !== 0 || l.actualTotal !== 0)
                  .map((l) => (
                    <tr key={l.accountId} className={l.isHeader ? 'font-semibold' : ''}>
                      <td className="px-3 py-1 text-gray-700">
                        {l.code} — {l.name}
                      </td>
                      <td className="px-3 py-1 text-right font-mono">{fmt(l.budgetTotal)}</td>
                      <td className="px-3 py-1 text-right font-mono">{fmt(l.actualTotal)}</td>
                      <td
                        className={`px-3 py-1 text-right font-mono ${
                          l.variance < 0 ? 'text-red-600' : 'text-green-700'
                        }`}
                      >
                        {fmt(l.variance)}
                      </td>
                    </tr>
                  ))}
                <tr className="border-t-2 border-gray-300 font-semibold">
                  <td className="px-3 py-1 text-gray-900">Total</td>
                  <td className="px-3 py-1 text-right font-mono">
                    {fmt(reconciliation.totals.budgetTotal)}
                  </td>
                  <td className="px-3 py-1 text-right font-mono">
                    {fmt(reconciliation.totals.actualTotal)}
                  </td>
                  <td
                    className={`px-3 py-1 text-right font-mono ${
                      reconciliation.totals.variance < 0 ? 'text-red-600' : 'text-green-700'
                    }`}
                  >
                    {fmt(reconciliation.totals.variance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        </>
        )}

        {activeTab === 'eligibility' && (
          <EligibilityTab
            projectId={projectId}
            budgetId={budgetId}
            versionId={versionId}
            version={version}
            onSaved={handleSaved}
            derivedRolesData={derivedRolesData}
          />
        )}

        {activeTab === 'estimate' && (
          <PartAEstimateTab
            projectId={projectId}
            budgetId={budgetId}
            versionId={versionId}
            version={version}
            isLocked={isLocked}
            enrollments={enrollments}
            completeness={completeness}
          />
        )}
      </div>
    </div>
  );
}

// ── Eligibility Tab ──────────────────────────────────────────────────────────

function RoleSummaryPanel({ derivedRolesData }: { derivedRolesData: DerivedRolesResponse | null }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!derivedRolesData || derivedRolesData.programs.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs w-4">{isExpanded ? '▼' : '▶'}</span>
          <span className="text-sm font-semibold text-gray-900">Role Assignment Summary (from budget)</span>
        </div>
      </button>
      
      {isExpanded && (
        <div className="border-t border-gray-100 px-4 py-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {derivedRolesData.programs.map((program) => {
            const { summary } = program;
            const hasPoints = summary.totalPoints !== null && summary.maxPoints !== null;
            const isPassingPoints = hasPoints && summary.totalPoints! >= (summary.maxPoints! / 2); // Approximation for UI
            const isComplete = summary.missingRoles.length === 0 && summary.issues.length === 0;
            
            return (
              <div key={program.programCode} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="font-medium text-gray-900 text-sm">{program.programCode}</div>
                  {hasPoints ? (
                    <span className={`text-xs font-bold ${isPassingPoints ? 'text-green-700' : 'text-amber-700'}`}>
                      {summary.totalPoints} / {summary.maxPoints} pts
                    </span>
                  ) : (
                    <span className={`text-xs font-medium ${isComplete ? 'text-green-700' : 'text-amber-700'}`}>
                      {isComplete ? 'COMPLETE' : 'INCOMPLETE'}
                    </span>
                  )}
                </div>
                
                <div className="space-y-2 text-xs">
                  {summary.missingRoles.length > 0 && (
                    <div>
                      <span className="font-medium text-gray-700">Missing:</span>
                      <ul className="mt-0.5 list-disc pl-4 text-amber-700">
                        {summary.missingRoles.map(r => (
                          <li key={r}>{r.replace(/_/g, ' ')}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {summary.issues.length > 0 && (
                    <div>
                      <span className="font-medium text-gray-700">Issues:</span>
                      <ul className="mt-0.5 space-y-1">
                        {Object.entries(
                          summary.issues.reduce((acc, issue) => {
                            // Extract issue type and role/person info
                            // Expected format: "RoleCode: PersonName missing residency" or "RoleCode: PersonName is RESIDENCY_TYPE (non-qualifying)"
                            const match = issue.match(/^([^:]+):\s*(.+?)\s+(missing residency|is\s+[A-Z_]+\s+\(non-qualifying\))$/);
                            
                            if (match && match[1] && match[2] && match[3]) {
                              const [_, role, person, issueTypeRaw] = match;
                              const issueType = issueTypeRaw.includes('missing') 
                                ? 'Missing residency' 
                                : 'Non-qualifying residency';
                              
                              if (!acc[issueType]) acc[issueType] = [];
                              acc[issueType].push(`${role.replace(/_/g, ' ')} (${person})`);
                            } else {
                              // Fallback for unexpected formats
                              if (!acc['Other issues']) acc['Other issues'] = [];
                              acc['Other issues'].push(issue);
                            }
                            return acc;
                          }, {} as Record<string, string[]>)
                        ).map(([groupType, items]) => (
                          <li key={groupType}>
                            <span className="font-medium text-gray-700">- {groupType}:</span>
                            <ul className="mt-0.5 pl-4 text-red-700">
                              {items.map((item, i) => (
                                <li key={i}>• {item}</li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {isComplete && (
                    <div className="text-green-700">All required roles assigned.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface PersonOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface VendorOption {
  id: string;
  name: string;
  vendorType: string;
}

interface ProjectLocationWithLocation {
  id: string;
  locationId: string;
  location: { id: string; name: string; country: string; provinceState: string | null };
}

interface PhaseOption {
  id: string;
  phaseType: string;
  name: string | null;
}

function defaultPhaseTypeForAccount(account?: BudgetVersionAccount): string | null {
  switch (account?.accountType) {
    case 'ABOVE_THE_LINE':
      return 'PRE_PRODUCTION';
    case 'BELOW_THE_LINE_PRODUCTION':
      return 'PRINCIPAL_PHOTOGRAPHY';
    case 'BELOW_THE_LINE_POST':
      return 'POST_PRODUCTION';
    default:
      return null;
  }
}

function defaultExpenseTypeForAccount(account?: BudgetVersionAccount): string | null {
  switch (account?.accountType) {
    case 'ABOVE_THE_LINE':
    case 'BELOW_THE_LINE_PRODUCTION':
    case 'BELOW_THE_LINE_POST':
      return ExpenseType.LABOUR;
    case 'OTHER':
      return ExpenseType.NON_LABOUR;
    default:
      return null;
  }
}

function expenseTypeLabel(value: string | null | undefined): string {
  switch (value) {
    case ExpenseType.LABOUR:
      return 'Labour';
    case ExpenseType.NON_LABOUR:
      return 'Non-labour';
    case ExpenseType.MIXED:
      return 'Mixed';
    default:
      return 'Unclassified';
  }
}

function phaseLabel(phase?: PhaseOption): string {
  return phase?.name ?? phase?.phaseType ?? '—';
}

function EligibilityLabourAmountInput({
  line,
  saving,
  onSave,
}: {
  line: BudgetLine;
  saving: boolean;
  onSave: (lineId: string, dto: Record<string, unknown>) => Promise<void>;
}) {
  const serverValue =
    line.labourAmount != null ? String(Number(line.labourAmount)) : '';
  const [value, setValue] = useState(serverValue);

  useEffect(() => {
    setValue(serverValue);
  }, [line.id, serverValue]);

  const save = async () => {
    if (value === serverValue) return;
    const trimmed = value.trim();
    await onSave(line.id, {
      labourAmount: trimmed === '' ? null : Number(trimmed),
    });
  };

  return (
    <input
      type="number"
      step="0.01"
      min="0"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void save()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
      disabled={saving}
      placeholder="0.00"
      className="w-full min-w-[80px] rounded border border-gray-200 px-2 py-1 text-right font-mono text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
    />
  );
}

function EligibilityTab({
  projectId,
  budgetId,
  versionId,
  version,
  onSaved,
  derivedRolesData,
}: {
  projectId: string;
  budgetId: string;
  versionId: string;
  version: { lines: BudgetLine[]; accounts: BudgetVersionAccount[] };
  onSaved: () => void;
  derivedRolesData: DerivedRolesResponse | null;
}) {
  const [persons, setPersons] = useState<PersonOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [projectLocations, setProjectLocations] = useState<ProjectLocationWithLocation[]>([]);
  const [phases, setPhases] = useState<PhaseOption[]>([]);
  const [savingLineId, setSavingLineId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [p, v, pl, ph] = await Promise.all([
          apiClient.get<PersonOption[]>('/persons'),
          apiClient.get<VendorOption[]>('/vendors'),
          apiClient.get<ProjectLocationWithLocation[]>(`/projects/${projectId}/locations`),
          apiClient.get<PhaseOption[]>(`/projects/${projectId}/phases`),
        ]);
        if (active) {
          setPersons(p ?? []);
          setVendors(v ?? []);
          setProjectLocations(pl ?? []);
          setPhases(ph ?? []);
        }
      } catch {
        if (active) {
          setPersons([]);
          setVendors([]);
          setProjectLocations([]);
          setPhases([]);
        }
      }
    };
    load();
    return () => { active = false; };
  }, [projectId]);

  const accountMap = useMemo(
    () => new Map(version.accounts.map((account) => [account.id, account])),
    [version.accounts],
  );
  const leafLines = useMemo(
    () =>
      version.lines
        .filter((line) => {
          const account = accountMap.get(line.budgetAccountId);
          return account && !account.isHeader && Number(line.amount) > 0;
        })
        .sort((a, b) => {
          const accountA = accountMap.get(a.budgetAccountId);
          const accountB = accountMap.get(b.budgetAccountId);
          const accountOrder =
            (accountA?.sortOrder ?? 0) - (accountB?.sortOrder ?? 0);
          if (accountOrder !== 0) return accountOrder;
          const codeOrder = (accountA?.code ?? '').localeCompare(
            accountB?.code ?? '',
            undefined,
            { numeric: true },
          );
          if (codeOrder !== 0) return codeOrder;
          const lineOrder = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
          if (lineOrder !== 0) return lineOrder;
          return a.id.localeCompare(b.id);
        }),
    [accountMap, version.lines],
  );

  const annotate = useCallback(async (lineId: string, dto: Record<string, unknown>) => {
    setSavingLineId(lineId);
    try {
      await apiClient.patch(
        `/budgets/${budgetId}/versions/${versionId}/lines/${lineId}/annotate`,
        dto,
      );
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save annotation');
    } finally {
      setSavingLineId(null);
    }
  }, [budgetId, onSaved, versionId]);

  return (
    <div className="overflow-x-auto px-5 py-4">
      <RoleSummaryPanel derivedRolesData={derivedRolesData} />
      <p className="mb-4 text-xs text-gray-500">
        Annotate each line with party, work location, phase, and expense type for Part A tax credit calculations.
        Annotation is editable on both draft and locked versions.
      </p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Account</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Description</th>
            <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Party</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Work Location</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Phase</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Labour Classification</th>
            <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">Labour $</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Activity</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Vendor Service</th>
          </tr>
        </thead>
        <tbody>
          {leafLines.map((line) => {
            const acc = accountMap.get(line.budgetAccountId);
            const saving = savingLineId === line.id;
            const defaultPhaseType = defaultPhaseTypeForAccount(acc);
            const defaultPhase = defaultPhaseType
              ? phases.find((phase) => phase.phaseType === defaultPhaseType)
              : undefined;
            const effectivePhaseId = line.productionPhaseId ?? defaultPhase?.id ?? '';
            const defaultExpenseType = defaultExpenseTypeForAccount(acc);
            const effectiveExpenseType = line.expenseType ?? defaultExpenseType;
            const hasExpenseOverride =
              line.expenseType != null && line.expenseType !== defaultExpenseType;
            const hasVendorParty = Boolean(line.vendorId);
            const showsLabourAmount =
              effectiveExpenseType === ExpenseType.LABOUR ||
              effectiveExpenseType === ExpenseType.MIXED;
            return (
              <tr key={line.id} className={`border-t border-gray-50 hover:bg-gray-50/40 ${saving ? 'opacity-70' : ''}`}>
                <td className="px-2 py-1.5 text-xs text-gray-600">
                  {acc?.code ?? '—'} — {acc?.name ?? '—'}
                </td>
                <td className="px-2 py-1.5 text-xs text-gray-700 max-w-[140px] truncate">
                  {line.description ?? '—'}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-xs text-gray-800">
                  {fmt(Number(line.amount))}
                </td>
                <td className="px-2 py-1">
                  <select
                    value={line.personId ?? line.vendorId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) {
                        annotate(line.id, {
                          personId: null,
                          vendorId: null,
                          isServiceContract: null,
                        });
                        return;
                      }
                      const isPerson = persons.some((p) => p.id === v);
                      annotate(
                        line.id,
                        isPerson
                          ? { personId: v, vendorId: null, isServiceContract: null }
                          : { vendorId: v, personId: null },
                      );
                    }}
                    disabled={saving}
                    className="w-full min-w-[120px] rounded border border-gray-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
                  >
                    <option value="">—</option>
                    <optgroup label="Person">
                      {persons.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Vendor">
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </td>
                <td className="px-2 py-1">
                  <select
                    value={line.locationId ?? ''}
                    onChange={(e) => annotate(line.id, { locationId: e.target.value || null })}
                    disabled={saving}
                    className="w-full min-w-[100px] rounded border border-gray-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
                  >
                    <option value="">—</option>
                    {projectLocations.map((pl) => (
                      <option key={pl.id} value={pl.location.id}>
                        {pl.location.name} (
                        {pl.location.provinceState
                          ? formatProvinceStateCell(pl.location.country, pl.location.provinceState)
                          : pl.location.country}
                        )
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <select
                    value={effectivePhaseId}
                    onChange={(e) => {
                      const value = e.target.value;
                      annotate(line.id, {
                        productionPhaseId:
                          value === (defaultPhase?.id ?? '') ? null : value || null,
                      });
                    }}
                    disabled={saving}
                    className="w-full min-w-[100px] rounded border border-gray-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
                  >
                    {defaultPhase ? (
                      <option value={defaultPhase.id}>
                        Default: {phaseLabel(defaultPhase)}
                      </option>
                    ) : (
                      <option value="">
                        {defaultPhaseType ? 'Default phase unavailable' : 'No account default'}
                      </option>
                    )}
                    {phases
                      .filter((ph) => ph.id !== defaultPhase?.id)
                      .map((ph) => (
                      <option key={ph.id} value={ph.id}>
                        {ph.name ?? ph.phaseType}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <div className="min-w-[120px] text-xs">
                    <div className="rounded border border-gray-100 bg-gray-50 px-2 py-1 text-gray-700">
                      {expenseTypeLabel(effectiveExpenseType)}
                      {hasExpenseOverride && (
                        <span className="ml-1 text-amber-600">(override)</span>
                      )}
                    </div>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[11px] text-brand-600 hover:underline">
                        Override
                      </summary>
                      <select
                        value={line.expenseType ?? ''}
                        onChange={(e) => annotate(line.id, { expenseType: e.target.value || null })}
                        disabled={saving}
                        className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
                      >
                        <option value="">
                          {defaultExpenseType ? 'Use account default' : 'Unclassified (no account default)'}
                        </option>
                        <option value={ExpenseType.LABOUR}>Labour</option>
                        <option value={ExpenseType.NON_LABOUR}>Non-labour</option>
                        <option value={ExpenseType.MIXED}>Mixed</option>
                      </select>
                    </details>
                  </div>
                </td>
                <td className="px-2 py-1">
                  {showsLabourAmount ? (
                    line.labourAmount != null ? (
                      <EligibilityLabourAmountInput
                        line={line}
                        saving={saving}
                        onSave={annotate}
                      />
                    ) : (
                      <details className="min-w-[80px] text-right">
                        <summary className="cursor-pointer text-xs text-brand-600 hover:underline">
                          Add
                        </summary>
                        <div className="mt-1">
                          <EligibilityLabourAmountInput
                            line={line}
                            saving={saving}
                            onSave={annotate}
                          />
                        </div>
                      </details>
                    )
                  ) : (
                    <span className="block min-w-[80px] text-right text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-2 py-1">
                  {line.activityType ? (
                    <select
                      value={line.activityType}
                      onChange={(e) => annotate(line.id, { activityType: e.target.value || null })}
                      disabled={saving}
                      className="w-full min-w-[90px] rounded border border-gray-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
                    >
                      <option value="">Clear</option>
                      <option value={ActivityType.VISUAL_EFFECTS}>VFX</option>
                      <option value={ActivityType.DIGITAL_ANIMATION}>Animation</option>
                      <option value={ActivityType.POST_PRODUCTION}>Post</option>
                    </select>
                  ) : (
                    <details className="min-w-[90px]">
                      <summary className="cursor-pointer text-xs text-brand-600 hover:underline">
                        Add
                      </summary>
                      <select
                        value=""
                        onChange={(e) => annotate(line.id, { activityType: e.target.value || null })}
                        disabled={saving}
                        className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
                      >
                        <option value="">—</option>
                        <option value={ActivityType.VISUAL_EFFECTS}>VFX</option>
                        <option value={ActivityType.DIGITAL_ANIMATION}>Animation</option>
                        <option value={ActivityType.POST_PRODUCTION}>Post</option>
                      </select>
                    </details>
                  )}
                </td>
                <td className="px-2 py-1">
                  {hasVendorParty ? (
                    line.isServiceContract !== null ? (
                      <select
                        value={String(line.isServiceContract)}
                        onChange={(e) => {
                          const v = e.target.value;
                          annotate(line.id, {
                            isServiceContract: v === '' ? null : v === 'true',
                          });
                        }}
                        disabled={saving}
                        className="w-full min-w-[70px] rounded border border-gray-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
                      >
                        <option value="">Clear</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : (
                      <details className="min-w-[70px]">
                        <summary className="cursor-pointer text-xs text-brand-600 hover:underline">
                          Add
                        </summary>
                        <select
                          value=""
                          onChange={(e) => {
                            const v = e.target.value;
                            annotate(line.id, {
                              isServiceContract: v === '' ? null : v === 'true',
                            });
                          }}
                          disabled={saving}
                          className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
                        >
                          <option value="">—</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </details>
                    )
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {leafLines.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-500">No line items to annotate.</p>
      )}
    </div>
  );
}

// ── Part A Estimate Tab ─────────────────────────────────────────────────────

type EstimateResult = {
  submissionId: string;
  projectProgramId: string;
  evaluationDate: string;
  estimatedAmount?: number;
  isEligible?: boolean;
  estimates?: Array<{ programCode: string; estimatedAmount: number; breakdown?: Record<string, any> }>;
  results: Array<{
    requirementId: string;
    result: string;
    computedValue: Record<string, unknown>;
    calculatorCode: string;
    calculatorVersion: string;
  }>;
};

function PartAEstimateTab({
  projectId,
  budgetId,
  versionId,
  version,
  isLocked,
  enrollments,
  completeness,
}: {
  projectId: string;
  budgetId: string;
  versionId: string;
  version: { lines: BudgetLine[]; accounts: BudgetVersionAccount[] };
  isLocked: boolean;
  enrollments: Array<{
    id: string;
    status: string;
    programVersion: { id: string; versionCode: string; program: { name: string } };
  }>;
  completeness: { total: number; annotated: number; percentage: number } | null;
}) {
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [evaluationSource, setEvaluationSource] = useState<EvaluationSourceValue>(EvaluationSource.BUDGET);
  const [accountSources, setAccountSources] = useState<Record<string, EvaluationSourceValue>>({});
  const [compareMode, setCompareMode] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [compareResult, setCompareResult] = useState<{
    partA: EstimateResult;
    partB: EstimateResult;
  } | null>(null);

  const activeEnrollments = enrollments.filter((e) => e.status === 'ACTIVE');
  const leafAccounts = version.accounts.filter((a) => !a.isHeader);

  const needsBudgetLock =
    evaluationSource === EvaluationSource.BUDGET || evaluationSource === EvaluationSource.BLENDED;
  const canRun =
    selectedProgramId &&
    activeEnrollments.length > 0 &&
    (!needsBudgetLock || isLocked);

  const runEstimate = async () => {
    if (!selectedProgramId) return;
    if (needsBudgetLock && !isLocked) {
      setEvalError('Budget must be locked for Budget or Blended estimates.');
      return;
    }
    setEvaluating(true);
    setEvalError(null);
    setResult(null);
    setCompareResult(null);
    try {
      const evalDate = new Date().toISOString().slice(0, 10);
      const baseUrl = `/projects/${projectId}/programs/${selectedProgramId}`;

      const payload: { evaluationDate: string; budgetVersionId?: string; evaluationSource?: EvaluationSourceValue } = {
        evaluationDate: evalDate,
      };
      if (evaluationSource === EvaluationSource.BUDGET || evaluationSource === EvaluationSource.BLENDED) {
        payload.budgetVersionId = versionId;
      }
      if (evaluationSource !== EvaluationSource.BUDGET) {
        payload.evaluationSource = evaluationSource;
      }

      const sub = await apiClient.post<{ id: string }>(`${baseUrl}/submissions`, payload);

      if (evaluationSource === EvaluationSource.BLENDED && leafAccounts.length > 0) {
        await apiClient.patch(`${baseUrl}/submissions/${sub.id}/account-sources`, {
          accounts: leafAccounts.map((acc) => ({
            budgetAccountId: acc.id,
            source: accountSources[acc.id] ?? EvaluationSource.BUDGET,
          })),
        });
      }

      await apiClient.post(`${baseUrl}/submissions/${sub.id}/assessments/initialize`, {});
      const evalResult = await apiClient.post<EstimateResult>(
        `${baseUrl}/submissions/${sub.id}/evaluate`,
        {},
      );
      setResult({
        ...evalResult,
        projectProgramId: selectedProgramId,
      });
    } catch (e) {
      setEvalError(e instanceof Error ? e.message : 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  const runCompare = async () => {
    if (!selectedProgramId) return;
    if (!isLocked) {
      setEvalError('Budget must be locked to compare Part A vs Part B.');
      return;
    }
    setEvaluating(true);
    setEvalError(null);
    setResult(null);
    setCompareResult(null);
    try {
      const evalDate = new Date().toISOString().slice(0, 10);
      const baseUrl = `/projects/${projectId}/programs/${selectedProgramId}`;

      const subA = await apiClient.post<{ id: string }>(`${baseUrl}/submissions`, {
        evaluationDate: evalDate,
        budgetVersionId: versionId,
        evaluationSource: EvaluationSource.BUDGET,
      });
      await apiClient.post(`${baseUrl}/submissions/${subA.id}/assessments/initialize`, {});
      const partA = await apiClient.post<EstimateResult>(
        `${baseUrl}/submissions/${subA.id}/evaluate`,
        {},
      );

      const subB = await apiClient.post<{ id: string }>(`${baseUrl}/submissions`, {
        evaluationDate: evalDate,
        evaluationSource: EvaluationSource.ACTUAL,
      });
      await apiClient.post(`${baseUrl}/submissions/${subB.id}/assessments/initialize`, {});
      const partB = await apiClient.post<EstimateResult>(
        `${baseUrl}/submissions/${subB.id}/evaluate`,
        {},
      );

      setCompareResult({
        partA: { ...partA, projectProgramId: selectedProgramId },
        partB: { ...partB, projectProgramId: selectedProgramId },
      });
    } catch (e) {
      setEvalError(e instanceof Error ? e.message : 'Comparison failed');
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="px-5 py-4">
      <p className="mb-4 text-xs text-gray-500">
        Run eligibility estimates from budget (Part A), actuals (Part B), or blended. Compare Part A vs Part B side by side.
      </p>
      {needsBudgetLock && !isLocked && (
        <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Lock the budget before running Budget or Blended estimates.
        </div>
      )}
      {completeness && completeness.percentage < 80 && completeness.total > 0 && evaluationSource === EvaluationSource.BUDGET && (
        <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          {completeness.percentage}% of lines annotated. Consider completing eligibility annotation for more accurate estimates.
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Evaluation source</label>
          <div className="flex gap-4">
            {[
              { value: EvaluationSource.BUDGET, label: 'Budget (Part A)' },
              { value: EvaluationSource.ACTUAL, label: 'Actual (Part B)' },
              { value: EvaluationSource.BLENDED, label: 'Blended' },
            ].map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="evaluationSource"
                  value={value}
                  checked={evaluationSource === value}
                  onChange={() => setEvaluationSource(value)}
                  className="rounded-full border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {evaluationSource === EvaluationSource.BLENDED && (
          <div className="rounded-md border border-gray-200 bg-gray-50/50 p-4">
            <h4 className="text-xs font-semibold text-gray-700 mb-3">Per-account source</h4>
            <p className="text-xs text-gray-500 mb-3">
              Choose Budget or Actual for each account. Accounts not listed default to Budget.
            </p>
            {leafAccounts.length === 0 ? (
              <p className="text-xs text-gray-500">No leaf accounts in this version.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2">
                {leafAccounts.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-xs text-gray-700 truncate">
                      {acc.code} — {acc.name}
                    </span>
                    <div className="flex gap-2 shrink-0">
                      {[EvaluationSource.BUDGET, EvaluationSource.ACTUAL].map((src) => (
                        <button
                          key={src}
                          type="button"
                          onClick={() =>
                            setAccountSources((prev) => ({
                              ...prev,
                              [acc.id]: src,
                            }))
                          }
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            (accountSources[acc.id] ?? EvaluationSource.BUDGET) === src
                              ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-300'
                              : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {src}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Program</label>
            <select
              value={selectedProgramId ?? ''}
              onChange={(e) => setSelectedProgramId(e.target.value || null)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Select program</option>
              {activeEnrollments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.programVersion.program.name} — {e.programVersion.versionCode}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={runEstimate}
            disabled={evaluating || !canRun}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {evaluating ? 'Running...' : 'Run Estimate'}
          </button>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={compareMode}
              onChange={(e) => setCompareMode(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-600">Compare Part A vs Part B</span>
          </label>
          {compareMode && (
            <button
              onClick={runCompare}
              disabled={evaluating || !selectedProgramId || !isLocked || activeEnrollments.length === 0}
              className="rounded-md border border-brand-600 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
            >
              {evaluating ? 'Running...' : 'Run Comparison'}
            </button>
          )}
        </div>
      </div>

      {activeEnrollments.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">
          No active program enrollments. Enroll in a program from the Programs page first.
        </p>
      )}
      {evalError && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{evalError}</div>
      )}

      {result && !compareResult && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Estimated Incentive</h4>
          {result.estimatedAmount !== undefined ? (
            <div className="mb-6 rounded-lg border border-brand-100 bg-brand-50 p-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-brand-700">
                  ${result.estimatedAmount.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-sm font-medium text-brand-600">Total</span>
                {result.isEligible === false && (
                  <span className="ml-3 rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-red-800 border border-red-200">
                    Not eligible
                  </span>
                )}
              </div>
              {result.estimates && result.estimates.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {result.estimates.map((est, i) => (
                    <li key={i} className="flex items-center justify-between border-t border-brand-100 pt-2 text-sm">
                      <span className="font-medium text-brand-700">{est.programCode}</span>
                      <span className="text-brand-600">${est.estimatedAmount.toLocaleString('en-CA')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="mb-6 text-sm text-gray-500">Estimate not available for this program.</p>
          )}
          
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Eligibility Results</h4>
          <ul className="space-y-2">
            {result.results.map((r, i) => (
              <li key={r.requirementId ?? i} className={`rounded border px-3 py-2 ${r.result === 'FAIL' ? 'border-red-300 bg-red-50/50' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">
                    {r.calculatorCode ?? `Requirement ${(r.requirementId ?? '').slice(0, 8)}`}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.result === 'PASS' ? 'bg-green-100 text-green-700' :
                      r.result === 'FAIL' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {r.result}
                  </span>
                </div>
                {r.computedValue && Object.keys(r.computedValue).length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                      View details
                    </summary>
                    <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-600">
                      {JSON.stringify(r.computedValue, null, 2)}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {compareResult && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Part A vs Part B Comparison</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h5 className="text-xs font-medium text-gray-600 mb-2">Part A (Budget)</h5>
              {compareResult.partA.estimatedAmount !== undefined && (
                <div className="mb-4 rounded bg-brand-50 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xl font-bold text-brand-700">
                      ${compareResult.partA.estimatedAmount.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs font-medium text-brand-600">Total Estimated Incentive</div>
                  </div>
                  {compareResult.partA.isEligible === false && (
                    <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-red-800 border border-red-200">
                      Not eligible
                    </span>
                  )}
                </div>
              )}
              <ul className="space-y-2">
                {compareResult.partA.results.map((r, i) => (
                  <li key={r.requirementId ?? i} className="rounded border border-gray-100 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 truncate">
                        {r.calculatorCode ?? `Req ${(r.requirementId ?? '').slice(0, 8)}`}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.result === 'PASS' ? 'bg-green-100 text-green-700' :
                          r.result === 'FAIL' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {r.result}
                      </span>
                    </div>
                    {r.computedValue && Object.keys(r.computedValue).length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-gray-500">Details</summary>
                        <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-600">
                          {JSON.stringify(r.computedValue, null, 2)}
                        </pre>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h5 className="text-xs font-medium text-gray-600 mb-2">Part B (Actual)</h5>
              {compareResult.partB.estimatedAmount !== undefined && (
                <div className="mb-4 rounded bg-brand-50 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xl font-bold text-brand-700">
                      ${compareResult.partB.estimatedAmount.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs font-medium text-brand-600">Total Estimated Incentive</div>
                  </div>
                  {compareResult.partB.isEligible === false && (
                    <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-red-800 border border-red-200">
                      Not eligible
                    </span>
                  )}
                </div>
              )}
              <ul className="space-y-2">
                {compareResult.partB.results.map((r, i) => {
                  const partAResult = compareResult.partA.results.find(
                    (a) => a.requirementId === r.requirementId,
                  );
                  const delta = partAResult && partAResult.result !== r.result;
                  return (
                    <li
                      key={r.requirementId ?? i}
                      className={`rounded border px-3 py-2 ${
                        delta ? 'border-amber-300 bg-amber-50/50' : 'border-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600 truncate">
                          {r.calculatorCode ?? `Req ${(r.requirementId ?? '').slice(0, 8)}`}
                        </span>
                        <span className="flex items-center gap-1">
                          {delta && (
                            <span className="text-amber-600 text-xs" title="Differs from Part A">
                              Δ
                            </span>
                          )}
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                              r.result === 'PASS' ? 'bg-green-100 text-green-700' :
                              r.result === 'FAIL' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {r.result}
                          </span>
                        </span>
                      </div>
                      {r.computedValue && Object.keys(r.computedValue).length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-gray-500">Details</summary>
                          <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-600">
                            {JSON.stringify(r.computedValue, null, 2)}
                          </pre>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Budget Card ───────────────────────────────────────────────────────────────

function BudgetCard({
  budget,
  budgetTemplates,
  templatesLoading,
  onVersionSelect,
  selectedVersionId,
  onDeleted,
  onVersionCreated,
}: {
  budget: Budget;
  budgetTemplates: BudgetTemplateOption[];
  templatesLoading: boolean;
  onVersionSelect: (versionId: string) => void;
  selectedVersionId: string | null;
  onDeleted: () => void;
  onVersionCreated: () => void;
}) {
  const [newVersionName, setNewVersionName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [showNewVersion, setShowNewVersion] = useState(false);

  const createVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionName.trim()) return;
    setCreatingVersion(true);
    try {
      const payload: { name: string; templateId?: string } = {
        name: newVersionName.trim(),
      };
      if (selectedTemplateId) {
        payload.templateId = selectedTemplateId;
      }

      const v = await apiClient.post<{ id: string }>(`/budgets/${budget.id}/versions`, payload);
      setNewVersionName('');
      setSelectedTemplateId('');
      setShowNewVersion(false);
      onVersionCreated();
      onVersionSelect(v.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create version');
    } finally {
      setCreatingVersion(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{budget.name}</h3>
          <p className="text-xs text-gray-500">Base currency: {budget.baseCurrency}</p>
        </div>
        <button
          onClick={onDeleted}
          className="text-xs text-red-400 hover:text-red-600"
        >
          Delete
        </button>
      </div>

      {/* Versions */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Versions</p>
        {budget.versions.length === 0 ? (
          <p className="text-xs text-gray-400">No versions yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {budget.versions.map((v) => (
              <button
                key={v.id}
                onClick={() => onVersionSelect(v.id)}
                className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                  selectedVersionId === v.id
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                v{v.versionNumber} — {v.name}
                {v.status === 'LOCKED' && (
                  <span className="ml-1 text-amber-600">🔒</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {showNewVersion ? (
        <form onSubmit={createVersion} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-gray-500 mb-0.5">Version name</label>
            <input
              value={newVersionName}
              onChange={(e) => setNewVersionName(e.target.value)}
              placeholder="e.g. Draft 1"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              required
            />
          </div>
          <div className="w-52">
            <label className="block text-xs font-medium text-gray-500 mb-0.5">
              From template
            </label>
            <select
              aria-label="Budget template"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              disabled={templatesLoading}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-100"
            >
              <option value="">Blank</option>
              {budgetTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creatingVersion}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {creatingVersion ? '...' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNewVersion(false);
              setSelectedTemplateId('');
            }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowNewVersion(true)}
          className="text-xs text-brand-600 hover:text-brand-800"
        >
          + Add version
        </button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface ProjectSectionProps {
  projectId: string;
}

export function BudgetSection({ projectId }: ProjectSectionProps) {

  const { budgets, isLoading, error, refetch } = useBudgets(projectId);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newBudgetName, setNewBudgetName] = useState('');
  const [newBudgetCurrency, setNewBudgetCurrency] = useState('CAD');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [budgetTemplates, setBudgetTemplates] = useState<BudgetTemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const loadTemplates = async () => {
      setTemplatesLoading(true);
      try {
        const list = await apiClient.get<BudgetTemplateOption[]>('/budget-templates');
        if (active) setBudgetTemplates(list ?? []);
      } catch {
        if (active) setBudgetTemplates([]);
      } finally {
        if (active) setTemplatesLoading(false);
      }
    };

    loadTemplates();
    return () => {
      active = false;
    };
  }, []);

  const createBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBudgetName.trim()) return;
    setCreating(true);
    setFormError(null);
    try {
      await apiClient.post(`/projects/${projectId}/budgets`, {
        name: newBudgetName.trim(),
        baseCurrency: newBudgetCurrency,
      });
      setNewBudgetName('');
      setShowNew(false);
      await refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create budget');
    } finally {
      setCreating(false);
    }
  };

  const deleteBudget = async (id: string) => {
    if (!confirm('Delete this budget?')) return;
    try {
      await apiClient.delete(`/projects/${projectId}/budgets/${id}`);
      if (selectedBudgetId === id) { setSelectedBudgetId(null); setSelectedVersionId(null); }
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete budget');
    }
  };

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading budgets...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Budgets</h2>
        <button
          onClick={() => setShowNew(!showNew)}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          New Budget
        </button>
      </div>

      {(error || formError) && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error ?? formError}</div>
      )}

      {showNew && (
        <form
          onSubmit={createBudget}
          className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3"
        >
          <h3 className="text-sm font-medium text-gray-800">New Budget</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                value={newBudgetName}
                onChange={(e) => setNewBudgetName(e.target.value)}
                placeholder="e.g. Working Budget"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Base Currency</label>
              <select
                value={newBudgetCurrency}
                onChange={(e) => setNewBudgetCurrency(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="CAD">CAD</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Budget'}
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

      {budgets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-500">No budgets yet. Create the first budget for this project.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              budgetTemplates={budgetTemplates}
              templatesLoading={templatesLoading}
              selectedVersionId={selectedBudgetId === budget.id ? selectedVersionId : null}
              onVersionSelect={(vId) => {
                setSelectedBudgetId(budget.id);
                setSelectedVersionId(vId);
              }}
              onDeleted={() => deleteBudget(budget.id)}
              onVersionCreated={refetch}
            />
          ))}
        </div>
      )}

      {/* Version detail panel */}
      {selectedBudgetId && selectedVersionId && (
        <VersionPanel
          projectId={projectId}
          budgetId={selectedBudgetId}
          versionId={selectedVersionId}
          onClose={() => setSelectedVersionId(null)}
          onVersionStatusChanged={refetch}
        />
      )}
    </div>
  );
}
