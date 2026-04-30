import { PrismaClient } from '../../src/generated/prisma';
import {
  EXPECTED_PROGRAM_REQUIREMENTS,
  getExpectedRequirementCodes,
  getExpectedRequirements,
} from '@storyos/types';

type ValidationFailure = {
  programCode: string;
  versionCode: string;
  programVersionId: string;
  missingCodes: string[];
  categoryMismatches: Array<{ code: string; expected: string; actual: string }>;
  configKeyViolations: Array<{ code: string; missingKeys: string[] }>;
};

async function main() {
  const prisma = new PrismaClient();

  try {
    const managedProgramCodes = Object.keys(EXPECTED_PROGRAM_REQUIREMENTS);
    const programVersions = await prisma.programVersion.findMany({
      where: {
        program: {
          code: { in: managedProgramCodes },
        },
      },
      include: {
        program: { select: { code: true, name: true } },
        requirements: {
          select: { code: true, requirementCategory: true, configuration: true },
        },
      },
      orderBy: [{ programId: 'asc' }, { versionCode: 'asc' }],
    });

    const failures: ValidationFailure[] = [];
    const rows = programVersions.map((programVersion) => {
      const expectedCodes = getExpectedRequirementCodes(programVersion.program.code) ?? [];
      const expectedReqs = getExpectedRequirements(programVersion.program.code) ?? [];
      const actualByCode = new Map(
        programVersion.requirements.map((r) => [
          r.code,
          {
            category: r.requirementCategory,
            configuration: r.configuration as Record<string, unknown> | null,
          },
        ]),
      );
      const actualCodes = new Set(actualByCode.keys());
      const missingCodes = expectedCodes.filter((code) => !actualCodes.has(code));
      const extraCodes = [...actualCodes].filter((code) => !expectedCodes.includes(code));

      const categoryMismatches: Array<{ code: string; expected: string; actual: string }> = [];
      const configKeyViolations: Array<{ code: string; missingKeys: string[] }> = [];

      for (const req of expectedReqs) {
        const actual = actualByCode.get(req.code);
        if (!actual) continue;

        if (actual.category !== req.category) {
          categoryMismatches.push({
            code: req.code,
            expected: req.category,
            actual: actual.category,
          });
        }

        if (req.configKeys?.length) {
          const config = (actual.configuration ?? {}) as Record<string, unknown>;
          const missing = req.configKeys.filter(
            (key) => config[key] === undefined || config[key] === null,
          );
          if (missing.length > 0) {
            configKeyViolations.push({ code: req.code, missingKeys: missing });
          }
        }
      }

      const hasIssues =
        missingCodes.length > 0 ||
        categoryMismatches.length > 0 ||
        configKeyViolations.length > 0;

      if (hasIssues) {
        failures.push({
          programCode: programVersion.program.code,
          versionCode: programVersion.versionCode,
          programVersionId: programVersion.id,
          missingCodes,
          categoryMismatches,
          configKeyViolations,
        });
      }

      return {
        programCode: programVersion.program.code,
        versionCode: programVersion.versionCode,
        expectedCount: expectedCodes.length,
        actualCount: actualCodes.size,
        missingCodes,
        extraCodes,
        categoryMismatches,
        configKeyViolations,
      };
    });

    console.log(JSON.stringify({ rows, failures }, null, 2));

    if (failures.length > 0) {
      const details = failures.map((f) => {
        const parts: string[] = [];
        if (f.missingCodes.length > 0) parts.push(`missing: ${f.missingCodes.join(', ')}`);
        if (f.categoryMismatches.length > 0)
          parts.push(
            `category mismatch: ${f.categoryMismatches
              .map((m) => `${m.code} expected=${m.expected} actual=${m.actual}`)
              .join('; ')}`,
          );
        if (f.configKeyViolations.length > 0)
          parts.push(
            `config violations: ${f.configKeyViolations
              .map((v) => `${v.code} missing [${v.missingKeys.join(',')}]`)
              .join('; ')}`,
          );
        return `${f.programCode}@${f.versionCode}: ${parts.join(' | ')}`;
      });
      throw new Error(`Program configuration validation failed:\n  ${details.join('\n  ')}`);
    }

    console.log(`Program configuration validation passed for ${rows.length} program version(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
