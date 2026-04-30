import { AssessmentResult } from '@storyos/types';
import type { FormatEligibilityConfig } from '@storyos/types';
import type { Calculator, CalculatorInput, CalculatorOutput } from '../calculator.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CalculatorContext } from '../calculator.context';

const EPISODIC_FORMATS = new Set([
  'TV_SERIES',
  'DOCUMENTARY_SERIES',
  'WEB_SERIES',
  'ANIMATION_SERIES',
]);

export class FormatEligibilityCalculator implements Calculator {
  readonly code = 'format_eligibility';
  readonly version = '1.1.0';

  async evaluate(input: CalculatorInput, prisma: PrismaService, context: CalculatorContext): Promise<CalculatorOutput> {
    const config = input.configuration as FormatEligibilityConfig;
    const allowedFormats = new Set(config.allowedFormats);

    const project = await context.getProject();

    const formatType = project?.format?.formatType;
    const storedTotalRuntime = project?.format?.totalRuntimeMinutes;
    const episodeRuntime = project?.format?.episodeRuntimeMinutes;
    const numberOfEpisodes = project?.format?.numberOfEpisodes;

    const formatPass = formatType ? allowedFormats.has(formatType) : false;

    const isEpisodic = formatType ? EPISODIC_FORMATS.has(formatType) : false;
    const effectiveTotalRuntime = this.resolveEffectiveTotalRuntime(
      isEpisodic, storedTotalRuntime, episodeRuntime, numberOfEpisodes,
    );

    let runtimePass = true;
    if (config.minRuntimeMinutes !== undefined && config.minRuntimeMinutes > 0 && effectiveTotalRuntime < config.minRuntimeMinutes) {
      runtimePass = false;
    }
    if (config.maxRuntimeMinutes !== undefined && effectiveTotalRuntime > config.maxRuntimeMinutes) {
      runtimePass = false;
    }

    let episodesPass = true;
    if (config.minEpisodes !== undefined && (numberOfEpisodes ?? 0) < config.minEpisodes) {
      episodesPass = false;
    }

    const passes = formatPass && runtimePass && episodesPass;
    const result = passes ? AssessmentResult.PASS : AssessmentResult.FAIL;

    const failureReasons: string[] = [];
    if (!formatPass) failureReasons.push(`Format "${formatType ?? 'not set'}" is not in the allowed list`);
    if (!runtimePass) failureReasons.push(`Effective total runtime (${effectiveTotalRuntime} min) does not meet the ${config.minRuntimeMinutes ? `minimum ${config.minRuntimeMinutes} min` : ''}${config.maxRuntimeMinutes ? ` / maximum ${config.maxRuntimeMinutes} min` : ''} requirement`);
    if (!episodesPass) failureReasons.push(`Episode count (${numberOfEpisodes ?? 0}) is below the minimum (${config.minEpisodes})`);

    return {
      result,
      computedValue: {
        formatType: formatType ?? null,
        isEpisodic,
        storedTotalRuntimeMinutes: storedTotalRuntime ?? null,
        episodeRuntimeMinutes: episodeRuntime ?? null,
        effectiveTotalRuntimeMinutes: effectiveTotalRuntime,
        numberOfEpisodes: numberOfEpisodes ?? null,
        allowedFormats: config.allowedFormats,
        formatPass,
        runtimePass,
        episodesPass,
        minRuntimeMinutes: config.minRuntimeMinutes ?? null,
        maxRuntimeMinutes: config.maxRuntimeMinutes ?? null,
        minEpisodes: config.minEpisodes ?? null,
        failureReasons: failureReasons.length > 0 ? failureReasons : undefined,
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }

  /**
   * For episodic formats (TV_SERIES, DOCUMENTARY_SERIES, etc.), the stored
   * totalRuntimeMinutes often represents per-episode runtime rather than
   * series total. We compute the effective total as:
   *
   *   1. If episodeRuntimeMinutes is set: episodeRuntimeMinutes × numberOfEpisodes
   *   2. If totalRuntimeMinutes seems per-episode (episodic + episodes > 1):
   *      totalRuntimeMinutes × numberOfEpisodes
   *   3. Otherwise: totalRuntimeMinutes as-is
   */
  private resolveEffectiveTotalRuntime(
    isEpisodic: boolean,
    storedTotal: number | null | undefined,
    episodeRuntime: number | null | undefined,
    episodes: number | null | undefined,
  ): number {
    const epCount = episodes ?? 1;

    if (episodeRuntime != null && episodeRuntime > 0 && epCount > 0) {
      return episodeRuntime * epCount;
    }

    if (isEpisodic && epCount > 1 && storedTotal != null && storedTotal > 0) {
      return storedTotal * epCount;
    }

    return storedTotal ?? 0;
  }
}
