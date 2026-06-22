import fs from 'fs';
import path from 'path';

/** Walk up from startDir until a directory contains templates/standard-budget-template-documentary.xlsx. */
export function findMonorepoRoot(startDir: string = __dirname): string {
  let current = path.resolve(startDir);

  for (let depth = 0; depth < 8; depth++) {
    const marker = path.join(current, 'templates', 'standard-budget-template-documentary.xlsx');
    if (fs.existsSync(marker)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  throw new Error(
    'Could not locate StoryOS monorepo root (templates/standard-budget-template-documentary.xlsx not found)',
  );
}

export function resolveFromMonorepoRoot(relativePath: string, startDir?: string): string {
  return path.join(findMonorepoRoot(startDir), relativePath);
}

export const CPTC_BOC_FORM_CODE_LIVE_ACTION = '01F21' as const;
export const CPTC_BOC_FORM_CODE_ANIMATION = '01F22' as const;

export type CptcBocFormCode =
  | typeof CPTC_BOC_FORM_CODE_LIVE_ACTION
  | typeof CPTC_BOC_FORM_CODE_ANIMATION;

const REGISTRY_FILE_BY_FORM_CODE: Record<CptcBocFormCode, string> = {
  [CPTC_BOC_FORM_CODE_LIVE_ACTION]: '01F21.live-action.yaml',
  [CPTC_BOC_FORM_CODE_ANIMATION]: '01F22.animation.yaml',
};

function resolveRegistryCandidates(fileName: string, startDir: string = __dirname): string[] {
  return [
    path.join(startDir, '..', 'cptc', fileName),
    path.join(startDir, '..', '..', 'cptc', fileName),
  ];
}

export function getCptcBocRegistryPath(
  formCode: CptcBocFormCode = CPTC_BOC_FORM_CODE_LIVE_ACTION,
  startDir: string = __dirname,
): string {
  const fileName = REGISTRY_FILE_BY_FORM_CODE[formCode];
  if (!fileName) {
    throw new Error(`Unsupported CPTC BOC form code "${formCode}"`);
  }

  for (const candidate of resolveRegistryCandidates(fileName, startDir)) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`CPTC BOC registry file not found for form ${formCode} (${fileName})`);
}

/** Default loader path — preserves live-action 01F21 behavior for existing generation. */
export function getDefaultCptcBocRegistryPath(startDir: string = __dirname): string {
  return getCptcBocRegistryPath(CPTC_BOC_FORM_CODE_LIVE_ACTION, startDir);
}
