import type { BocFormLineDefinition, BocFormRegistry } from '@storyos/types';
import { accountMatchesRule } from './pattern-match';

export function resolveFormLinesForAccount(
  registry: BocFormRegistry,
  templateId: string,
  accountCode: string,
): BocFormLineDefinition[] {
  return registry.lines.filter((line) =>
    (line.sources ?? []).some(
      (source) =>
        source.templateId === templateId && accountMatchesRule(accountCode, source),
    ),
  );
}

function hasRollupMatch(
  line: BocFormLineDefinition,
  templateId: string,
  accountCode: string,
): boolean {
  return (line.sources ?? []).some(
    (source) =>
      source.templateId === templateId &&
      (source.rollups?.includes(accountCode) ?? false),
  );
}

function hasDirectAccountMatch(
  line: BocFormLineDefinition,
  templateId: string,
  accountCode: string,
): boolean {
  return (line.sources ?? []).some(
    (source) =>
      source.templateId === templateId &&
      (source.accounts?.includes(accountCode) ?? false),
  );
}

/**
 * When a Telefilm account maps to multiple 01F21 lines, prefer rollup targets
 * (fringe), then exact account matches, then pattern matches (registry order).
 */
export function resolvePrimaryFormLineForAccount(
  registry: BocFormRegistry,
  templateId: string,
  accountCode: string,
): BocFormLineDefinition | null {
  const matches = resolveFormLinesForAccount(registry, templateId, accountCode);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0] ?? null;

  const rollupMatches = matches.filter((line) =>
    hasRollupMatch(line, templateId, accountCode),
  );
  if (rollupMatches.length > 0) {
    return rollupMatches[0] ?? null;
  }

  const accountMatches = matches.filter((line) =>
    hasDirectAccountMatch(line, templateId, accountCode),
  );
  if (accountMatches.length > 0) {
    return accountMatches[0] ?? null;
  }

  return matches[0] ?? null;
}

export function resolveRollupKindForAccount(
  formLine: BocFormLineDefinition,
  templateId: string,
  accountCode: string,
): 'direct' | 'fringe' | 'travel' {
  if (hasRollupMatch(formLine, templateId, accountCode)) {
    return 'fringe';
  }
  if (/\.(60|65)$/.test(accountCode)) {
    return 'travel';
  }
  return 'direct';
}

export function isLineCodeWithinRange(
  lineCode: string,
  start: string,
  end: string,
): boolean {
  return (
    compareFormLineCodes(lineCode, start) >= 0 &&
    compareFormLineCodes(lineCode, end) <= 0
  );
}

export function compareFormLineCodes(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}
