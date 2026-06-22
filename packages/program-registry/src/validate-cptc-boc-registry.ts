import type {
  BocFormLineDefinition,
  BocFormRegistry,
  BocLineSourceRule,
  BocRegistryCoverageReport,
  BocRegistryValidationIssue,
  BocRegistryValidationResult,
} from '@storyos/types';
import { accountMatchesAnyPattern, accountMatchesRule } from './pattern-match';
import { parseTelefilmTemplateAccounts } from './telefilm-template-accounts';
import { resolveFromMonorepoRoot } from './paths';

const EXPECTED_SUMMARY_CODES = ['11.0', '11.1', '11.2', '11.3', '11.4'] as const;

export interface AccountLineMapping {
  accountCode: string;
  lineCode: string;
  templateId: string;
  allowShared: boolean;
}

function issue(
  severity: BocRegistryValidationIssue['severity'],
  code: string,
  message: string,
  context?: Record<string, unknown>,
): BocRegistryValidationIssue {
  return { severity, code, message, context };
}

function collectSourceAccounts(rule: BocLineSourceRule): string[] {
  return [...(rule.accounts ?? []), ...(rule.rollups ?? [])];
}

function lineHasSources(line: BocFormLineDefinition): boolean {
  return (line.sources?.length ?? 0) > 0;
}

function compareLineCodes(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

export function resolveAccountLineMappings(
  registry: BocFormRegistry,
  templateId: string,
  accountCodes: string[],
): AccountLineMapping[] {
  const mappings: AccountLineMapping[] = [];

  for (const accountCode of accountCodes) {
    for (const line of registry.lines) {
      for (const source of line.sources ?? []) {
        if (source.templateId !== templateId) continue;
        if (!accountMatchesRule(accountCode, source)) continue;

        mappings.push({
          accountCode,
          lineCode: line.code,
          templateId,
          allowShared: source.allowShared === true,
        });
      }
    }
  }

  return mappings;
}

export function buildRegistryCoverageReport(
  registry: BocFormRegistry,
  templateId: string = registry.meta.templateVersion,
  options?: {
    templatePath?: string;
    sheetName?: string;
    topSectionLimit?: number;
  },
): BocRegistryCoverageReport {
  const template = registry.templates[templateId];
  if (!template) {
    throw new Error(`Template "${templateId}" is not defined in registry`);
  }

  const templatePath =
    options?.templatePath ?? resolveFromMonorepoRoot(template.sourceFile);
  const accounts = parseTelefilmTemplateAccounts({
    templatePath,
    sheetName: options?.sheetName ?? template.sheetName,
  });

  const leafAccounts = accounts.filter((account) => !account.isHeader);
  const coverageEligibleAccounts = leafAccounts.filter(
    (account) => !accountMatchesAnyPattern(account.code, template.coverageExcludePatterns),
  );
  const eligibleCodes = coverageEligibleAccounts.map((account) => account.code);
  const mappings = resolveAccountLineMappings(registry, templateId, eligibleCodes);

  const mappedAccountSet = new Set(mappings.map((mapping) => mapping.accountCode));
  const unmappedAccountCodes = eligibleCodes.filter((code) => !mappedAccountSet.has(code));
  const mappedAccounts = mappedAccountSet.size;
  const coverageEligible = coverageEligibleAccounts.length;
  const coveragePercentage =
    coverageEligible > 0 ? (mappedAccounts / coverageEligible) * 100 : 100;

  const sectionLabels = new Map<string, string>();
  for (const account of accounts) {
    if (account.isHeader) {
      sectionLabels.set(account.section, account.name);
    }
  }

  const unmappedBySection = new Map<string, string[]>();
  for (const code of unmappedAccountCodes) {
    const section = code.substring(0, 2);
    const bucket = unmappedBySection.get(section) ?? [];
    bucket.push(code);
    unmappedBySection.set(section, bucket);
  }

  const topUnmappedSections = [...unmappedBySection.entries()]
    .map(([section, codes]) => ({
      section,
      sectionLabel: sectionLabels.get(section),
      unmappedCount: codes.length,
      unmappedAccounts: codes.sort((a, b) => compareLineCodes(a, b)),
    }))
    .sort((a, b) => b.unmappedCount - a.unmappedCount)
    .slice(0, options?.topSectionLimit ?? 10);

  return {
    templateId,
    templateVersion: registry.meta.templateVersion,
    totalAccounts: accounts.length,
    totalLeafAccounts: leafAccounts.length,
    coverageEligibleAccounts: coverageEligible,
    mappedAccounts,
    unmappedAccounts: unmappedAccountCodes.length,
    coveragePercentage,
    excludedFromCoverage: leafAccounts.length - coverageEligible,
    topUnmappedSections,
    unmappedAccountCodes: unmappedAccountCodes.sort((a, b) => compareLineCodes(a, b)),
  };
}

export function validateCptcBocRegistry(
  registry: BocFormRegistry,
  options?: {
    templateId?: string;
    validateCoverage?: boolean;
    minimumCoveragePercentage?: number;
  },
): BocRegistryValidationResult {
  const errors: BocRegistryValidationIssue[] = [];
  const warnings: BocRegistryValidationIssue[] = [];
  const templateId = options?.templateId ?? registry.meta.templateVersion;

  if (registry.meta.templateVersion !== templateId) {
    warnings.push(
      issue(
        'warning',
        'TEMPLATE_VERSION_META_MISMATCH',
        `Registry meta.templateVersion (${registry.meta.templateVersion}) differs from validation templateId (${templateId})`,
      ),
    );
  }

  const lineCodes = registry.lines.map((line) => line.code);
  const duplicateLineCodes = lineCodes.filter(
    (code, index) => lineCodes.indexOf(code) !== index,
  );
  for (const code of [...new Set(duplicateLineCodes)]) {
    errors.push(
      issue('error', 'DUPLICATE_LINE_CODE', `Duplicate form line code "${code}"`, { code }),
    );
  }

  const lineCodeSet = new Set(lineCodes);
  for (const line of registry.lines) {
    if (line.parentCode && !lineCodeSet.has(line.parentCode)) {
      errors.push(
        issue(
          'error',
          'MISSING_PARENT_LINE',
          `Line ${line.code} references missing parent ${line.parentCode}`,
          { lineCode: line.code, parentCode: line.parentCode },
        ),
      );
    }

    if (line.forceEmpty && line.allowedColumns.length > 0) {
      errors.push(
        issue(
          'error',
          'FORCE_EMPTY_WITH_COLUMNS',
          `Line ${line.code} is forceEmpty but declares allowedColumns`,
          { lineCode: line.code },
        ),
      );
    }

    if (!line.isHeader && !line.forceEmpty && line.allowedColumns.length === 0 && lineHasSources(line)) {
      errors.push(
        issue(
          'error',
          'MISSING_ALLOWED_COLUMNS',
          `Line ${line.code} has sources but no allowedColumns`,
          { lineCode: line.code },
        ),
      );
    }

    for (const source of line.sources ?? []) {
      if (!registry.templates[source.templateId]) {
        errors.push(
          issue(
            'error',
            'UNKNOWN_TEMPLATE',
            `Line ${line.code} references unknown template "${source.templateId}"`,
            { lineCode: line.code, templateId: source.templateId },
          ),
        );
      }

      const hasMapping =
        (source.accounts?.length ?? 0) > 0 ||
        (source.patterns?.length ?? 0) > 0 ||
        (source.rollups?.length ?? 0) > 0;

      if (!hasMapping) {
        warnings.push(
          issue(
            'warning',
            'EMPTY_SOURCE_RULE',
            `Line ${line.code} has an empty source rule for template ${source.templateId}`,
            { lineCode: line.code, templateId: source.templateId },
          ),
        );
      }

      const allReferenced = [
        ...(source.accounts ?? []),
        ...(source.rollups ?? []),
        ...(source.excludeAccounts ?? []),
      ];
      const duplicateAccounts = allReferenced.filter(
        (code, index) => allReferenced.indexOf(code) !== index,
      );
      for (const code of [...new Set(duplicateAccounts)]) {
        errors.push(
          issue(
            'error',
            'DUPLICATE_SOURCE_ACCOUNT',
            `Line ${line.code} source references "${code}" more than once`,
            { lineCode: line.code, accountCode: code },
          ),
        );
      }
    }
  }

  const summaryCodes = registry.summaryLines.map((line) => line.code);
  for (const expectedCode of EXPECTED_SUMMARY_CODES) {
    if (!summaryCodes.includes(expectedCode)) {
      errors.push(
        issue(
          'error',
          'MISSING_SUMMARY_LINE',
          `Missing required summary line definition "${expectedCode}"`,
          { code: expectedCode },
        ),
      );
    }
  }

  const duplicateSummaryCodes = summaryCodes.filter(
    (code, index) => summaryCodes.indexOf(code) !== index,
  );
  for (const code of [...new Set(duplicateSummaryCodes)]) {
    errors.push(
      issue('error', 'DUPLICATE_SUMMARY_CODE', `Duplicate summary line code "${code}"`, { code }),
    );
  }

  for (const summary of registry.summaryLines) {
    if (lineCodeSet.has(summary.code)) {
      errors.push(
        issue(
          'error',
          'SUMMARY_LINE_CODE_COLLISION',
          `Summary line code "${summary.code}" collides with a form line code`,
          { code: summary.code },
        ),
      );
    }

    if (summary.formula === 'SUM_LINE_TOTALS') {
      if (!summary.sourceLineRange) {
        errors.push(
          issue(
            'error',
            'MISSING_SUMMARY_RANGE',
            `Summary line ${summary.code} requires sourceLineRange`,
            { code: summary.code },
          ),
        );
      } else {
        const [start, end] = summary.sourceLineRange;
        if (!lineCodeSet.has(start) || !lineCodeSet.has(end)) {
          errors.push(
            issue(
              'error',
              'INVALID_SUMMARY_RANGE',
              `Summary line ${summary.code} sourceLineRange [${start}, ${end}] references unknown form lines`,
              { code: summary.code, start, end },
            ),
          );
        }
      }
    }
  }

  const template = registry.templates[templateId];
  if (!template) {
    errors.push(
      issue('error', 'UNKNOWN_TEMPLATE', `Template "${templateId}" is not defined in registry`, {
        templateId,
      }),
    );
  } else {
    const exactAccountOwners = new Map<string, AccountLineMapping[]>();

    for (const line of registry.lines) {
      for (const source of line.sources ?? []) {
        if (source.templateId !== templateId) continue;

        for (const accountCode of collectSourceAccounts(source)) {
          const entry: AccountLineMapping = {
            accountCode,
            lineCode: line.code,
            templateId,
            allowShared: source.allowShared === true,
          };
          const owners = exactAccountOwners.get(accountCode) ?? [];
          owners.push(entry);
          exactAccountOwners.set(accountCode, owners);
        }
      }
    }

    for (const [accountCode, owners] of exactAccountOwners.entries()) {
      if (owners.length <= 1) continue;
      const allShared = owners.every((owner) => owner.allowShared);
      if (!allShared) {
        errors.push(
          issue(
            'error',
            'CONFLICTING_ACCOUNT_MAPPING',
            `Account "${accountCode}" is explicitly mapped to multiple form lines without allowShared`,
            {
              accountCode,
              lineCodes: owners.map((owner) => owner.lineCode),
            },
          ),
        );
      }
    }

    if (options?.validateCoverage !== false) {
      try {
        const coverage = buildRegistryCoverageReport(registry, templateId);
        const minimumCoverage = options?.minimumCoveragePercentage ?? 95;

        if (coverage.unmappedAccounts > 0) {
          const message = `Template ${templateId} has ${coverage.unmappedAccounts} unmapped leaf account(s) (${coverage.coveragePercentage.toFixed(1)}% coverage)`;
          if (template.unmappedAccountPolicy === 'ERROR' || coverage.coveragePercentage < minimumCoverage) {
            errors.push(
              issue('error', 'UNMAPPED_ACCOUNTS', message, {
                ...coverage,
              }),
            );
          } else {
            warnings.push(
              issue('warning', 'UNMAPPED_ACCOUNTS', message, {
                ...coverage,
              }),
            );
          }
        }

        const patternMappings = resolveAccountLineMappings(
          registry,
          templateId,
          coverage.coverageEligibleAccounts > 0
            ? parseTelefilmTemplateAccounts({
                templatePath: resolveFromMonorepoRoot(template.sourceFile),
                sheetName: template.sheetName,
              })
                .filter(
                  (account) =>
                    !account.isHeader &&
                    !accountMatchesAnyPattern(account.code, template.coverageExcludePatterns),
                )
                .map((account) => account.code)
            : [],
        );

        const byAccount = new Map<string, AccountLineMapping[]>();
        for (const mapping of patternMappings) {
          const entries = byAccount.get(mapping.accountCode) ?? [];
          entries.push(mapping);
          byAccount.set(mapping.accountCode, entries);
        }

        for (const [accountCode, owners] of byAccount.entries()) {
          const distinctLines = [...new Set(owners.map((owner) => owner.lineCode))];
          if (distinctLines.length <= 1) continue;
          const allShared = owners.every((owner) => owner.allowShared);
          if (!allShared) {
            errors.push(
              issue(
                'error',
                'CONFLICTING_PATTERN_MAPPING',
                `Account "${accountCode}" matches multiple form lines without allowShared`,
                {
                  accountCode,
                  lineCodes: distinctLines,
                },
              ),
            );
          }
        }
      } catch (error) {
        errors.push(
          issue(
            'error',
            'COVERAGE_VALIDATION_FAILED',
            error instanceof Error ? error.message : 'Coverage validation failed',
          ),
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function findLineByCode(
  registry: BocFormRegistry,
  lineCode: string,
): BocFormLineDefinition | undefined {
  return registry.lines.find((line) => line.code === lineCode);
}

export function lineMapsAccount(
  line: BocFormLineDefinition,
  accountCode: string,
  templateId: string,
): boolean {
  return (line.sources ?? []).some(
    (source) => source.templateId === templateId && accountMatchesRule(accountCode, source),
  );
}
