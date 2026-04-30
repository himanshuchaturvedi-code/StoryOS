import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  EXPECTED_PROGRAM_REQUIREMENTS,
  getExpectedRequirements,
} from '@storyos/types';
import type { ExpectedRequirement } from '@storyos/types';
import { PrismaService } from './prisma/prisma.service';

type ProgramVersionSnapshot = {
  id: string;
  versionCode: string;
  program: {
    code: string;
  };
  requirements: Array<{
    code: string;
    requirementCategory: string;
    configuration: unknown;
  }>;
};

interface ValidationFailure {
  programCode: string;
  versionCode: string;
  missingCodes: string[];
  categoryMismatches: Array<{
    code: string;
    expected: string;
    actual: string;
  }>;
  configKeyViolations: Array<{
    code: string;
    missingKeys: string[];
  }>;
}

@Injectable()
export class ProgramConfigValidationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProgramConfigValidationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const { failures, checkedCount, diffs } = await this.validateAll();

    if (diffs.length > 0) {
      for (const diff of diffs) {
        this.logger.warn(`Config diff [${diff.programCode}@${diff.versionCode}]: ${diff.detail}`);
      }
    }

    if (failures.length > 0) {
      const details = failures.map((f) => this.formatFailure(f)).join('\n');
      throw new Error(`Program configuration validation failed:\n${details}`);
    }

    this.logger.log(
      `Program configuration validation passed for ${checkedCount} managed program version(s)`,
    );
  }

  private async validateAll(): Promise<{
    checkedCount: number;
    failures: ValidationFailure[];
    diffs: Array<{ programCode: string; versionCode: string; detail: string }>;
  }> {
    const programVersions = await this.prisma.programVersion.findMany({
      where: {
        program: {
          code: { in: Object.keys(EXPECTED_PROGRAM_REQUIREMENTS) },
        },
      },
      include: {
        program: { select: { code: true } },
        requirements: {
          select: { code: true, requirementCategory: true, configuration: true },
        },
      },
    });

    const failures: ValidationFailure[] = [];
    const diffs: Array<{ programCode: string; versionCode: string; detail: string }> = [];

    for (const pv of programVersions as ProgramVersionSnapshot[]) {
      const expected = getExpectedRequirements(pv.program.code);
      if (!expected) continue;

      const actualByCode = new Map(
        pv.requirements.map((r) => [
          r.code,
          { category: r.requirementCategory, configuration: r.configuration },
        ]),
      );

      const failure: ValidationFailure = {
        programCode: pv.program.code,
        versionCode: pv.versionCode,
        missingCodes: [],
        categoryMismatches: [],
        configKeyViolations: [],
      };

      for (const req of expected) {
        const actual = actualByCode.get(req.code);

        if (!actual) {
          failure.missingCodes.push(req.code);
          continue;
        }

        if (actual.category !== req.category) {
          failure.categoryMismatches.push({
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
            failure.configKeyViolations.push({
              code: req.code,
              missingKeys: missing,
            });
          }
        }

        this.logConfigDiff(pv, req, actual, diffs);
      }

      const extraCodes = pv.requirements
        .filter((r) => !expected.some((e) => e.code === r.code))
        .map((r) => r.code);
      if (extraCodes.length > 0) {
        diffs.push({
          programCode: pv.program.code,
          versionCode: pv.versionCode,
          detail: `Extra requirements not in manifest: ${extraCodes.join(', ')}`,
        });
      }

      const hasFailures =
        failure.missingCodes.length > 0 ||
        failure.categoryMismatches.length > 0 ||
        failure.configKeyViolations.length > 0;

      if (hasFailures) {
        failures.push(failure);
      }
    }

    return { checkedCount: programVersions.length, failures, diffs };
  }

  private logConfigDiff(
    pv: ProgramVersionSnapshot,
    expected: ExpectedRequirement,
    actual: { category: string; configuration: unknown },
    diffs: Array<{ programCode: string; versionCode: string; detail: string }>,
  ): void {
    if (!expected.configKeys?.length) return;
    const config = (actual.configuration ?? {}) as Record<string, unknown>;
    const presentKeys = expected.configKeys.filter(
      (k) => config[k] !== undefined && config[k] !== null,
    );
    for (const key of presentKeys) {
      const val = config[key];
      const serialized = typeof val === 'object' ? JSON.stringify(val) : String(val);
      diffs.push({
        programCode: pv.program.code,
        versionCode: pv.versionCode,
        detail: `${expected.code}.${key} = ${serialized}`,
      });
    }
  }

  private formatFailure(f: ValidationFailure): string {
    const parts: string[] = [];
    if (f.missingCodes.length > 0) {
      parts.push(`missing: ${f.missingCodes.join(', ')}`);
    }
    if (f.categoryMismatches.length > 0) {
      const items = f.categoryMismatches
        .map((m) => `${m.code} expected=${m.expected} actual=${m.actual}`)
        .join('; ');
      parts.push(`category mismatch: ${items}`);
    }
    if (f.configKeyViolations.length > 0) {
      const items = f.configKeyViolations
        .map((v) => `${v.code} missing keys=[${v.missingKeys.join(',')}]`)
        .join('; ');
      parts.push(`config violations: ${items}`);
    }
    return `  ${f.programCode}@${f.versionCode}: ${parts.join(' | ')}`;
  }
}
