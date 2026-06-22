/** Match Telefilm account codes against registry glob patterns (e.g. "23.*"). */
export function matchAccountPattern(pattern: string, accountCode: string): boolean {
  const escaped = pattern
    .split('*')
    .map((segment) => segment.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`).test(accountCode);
}

export function accountMatchesRule(
  accountCode: string,
  rule: {
    accounts?: string[];
    patterns?: string[];
    rollups?: string[];
    excludeAccounts?: string[];
  },
): boolean {
  const excludes = new Set(rule.excludeAccounts ?? []);

  if (excludes.has(accountCode)) {
    return false;
  }

  if (rule.accounts?.includes(accountCode)) {
    return true;
  }

  if (rule.rollups?.includes(accountCode)) {
    return true;
  }

  return (rule.patterns ?? []).some((pattern) => matchAccountPattern(pattern, accountCode));
}

export function accountMatchesAnyPattern(
  accountCode: string,
  patterns: string[] | undefined,
): boolean {
  return (patterns ?? []).some((pattern) => matchAccountPattern(pattern, accountCode));
}
