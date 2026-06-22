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

function hasExactAccountMatch(
  line: BocFormLineDefinition,
  templateId: string,
  accountCode: string,
): boolean {
  return (line.sources ?? []).some(
    (source) =>
      source.templateId === templateId &&
      ((source.accounts?.includes(accountCode) ?? false) ||
        (source.rollups?.includes(accountCode) ?? false)),
  );
}

/**
 * When a Telefilm account maps to multiple 01F21 lines, pick the first exact
 * account match in registry order, otherwise the first pattern match.
 */
export function resolvePrimaryFormLineForAccount(
  registry: BocFormRegistry,
  templateId: string,
  accountCode: string,
): BocFormLineDefinition | null {
  const matches = resolveFormLinesForAccount(registry, templateId, accountCode);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0] ?? null;

  const exactMatches = matches.filter((line) =>
    hasExactAccountMatch(line, templateId, accountCode),
  );
  return (exactMatches[0] ?? matches[0]) ?? null;
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
