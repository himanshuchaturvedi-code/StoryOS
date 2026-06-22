import type {
  BocFormLineDefinition,
  BocFormRegistry,
  BocPolicyMatchRule,
  BocPolicyNote,
  BocPolicyRoutingOverride,
} from '@storyos/types';
import { matchAccountPattern } from './pattern-match';

export interface PolicyRoutingResolution {
  formLine: BocFormLineDefinition;
  policyId: string;
  routingMode: 'interim' | 'official';
  officialFormLineCode: string;
}

function matchesNamePattern(pattern: string, accountName: string): boolean {
  return matchAccountPattern(pattern.toLowerCase(), accountName.toLowerCase());
}

function matchesTelefilmRule(accountCode: string, rule: BocPolicyMatchRule): boolean {
  if (rule.excludeAccounts?.includes(accountCode)) {
    return false;
  }
  if (rule.telefilmAccounts?.includes(accountCode)) {
    return true;
  }
  return (rule.telefilmPatterns ?? []).some((pattern) =>
    matchAccountPattern(pattern, accountCode),
  );
}

function matchesIdentityRule(
  rule: BocPolicyMatchRule,
  accountName: string,
  notes: string | null | undefined,
): boolean {
  const nameMatches = (rule.accountNamePatterns ?? []).some((pattern) =>
    matchesNamePattern(pattern, accountName),
  );
  const tagMatches = (rule.tags ?? []).some((tag) =>
    (notes ?? '').toLowerCase().includes(tag.toLowerCase()),
  );
  return nameMatches || tagMatches;
}

export function budgetLineMatchesPolicyRule(
  accountCode: string,
  accountName: string,
  notes: string | null | undefined,
  rule: BocPolicyMatchRule,
): boolean {
  if (rule.excludeAccounts?.includes(accountCode)) {
    return false;
  }

  const telefilmRequired =
    (rule.telefilmPatterns?.length ?? 0) > 0 ||
    (rule.telefilmAccounts?.length ?? 0) > 0;
  const identityRequired =
    (rule.accountNamePatterns?.length ?? 0) > 0 || (rule.tags?.length ?? 0) > 0;

  const telefilmOk = telefilmRequired ? matchesTelefilmRule(accountCode, rule) : false;
  const identityOk = identityRequired
    ? matchesIdentityRule(rule, accountName, notes)
    : false;

  if (telefilmRequired && identityRequired) {
    return telefilmOk && identityOk;
  }
  if (telefilmRequired) {
    return telefilmOk;
  }
  if (identityRequired) {
    return identityOk;
  }

  return false;
}

function findLineByCode(
  registry: BocFormRegistry,
  lineCode: string,
): BocFormLineDefinition | undefined {
  return registry.lines.find((line) => line.code === lineCode);
}

function resolveOverride(
  registry: BocFormRegistry,
  policy: BocPolicyNote,
  override: BocPolicyRoutingOverride,
  accountCode: string,
  accountName: string,
  notes: string | null | undefined,
): PolicyRoutingResolution | null {
  if (!budgetLineMatchesPolicyRule(accountCode, accountName, notes, override.match)) {
    return null;
  }

  const useInterim = policy.useInterimRouting !== false;
  const targetLineCode = useInterim ? override.interimLine : override.officialLine;
  const formLine = findLineByCode(registry, targetLineCode);
  if (!formLine) {
    return null;
  }

  return {
    formLine,
    policyId: policy.id,
    routingMode: useInterim ? 'interim' : 'official',
    officialFormLineCode: override.officialLine,
  };
}

/**
 * Resolve registry policy overrides (e.g. PN-2022-02 stock footage interim routing).
 */
export function resolvePolicyFormLine(
  registry: BocFormRegistry,
  accountCode: string,
  accountName: string,
  notes: string | null | undefined,
): PolicyRoutingResolution | null {
  for (const policy of registry.policyNotes ?? []) {
    for (const override of policy.overrides) {
      const resolved = resolveOverride(
        registry,
        policy,
        override,
        accountCode,
        accountName,
        notes,
      );
      if (resolved) {
        return resolved;
      }
    }
  }
  return null;
}
