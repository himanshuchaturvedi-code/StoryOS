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

export function getDefaultCptcBocRegistryPath(startDir: string = __dirname): string {
  const candidates = [
    path.join(startDir, '..', 'cptc', '01F21.live-action.yaml'),
    path.join(startDir, '..', '..', 'cptc', '01F21.live-action.yaml'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('CPTC 01F21 registry file not found (01F21.live-action.yaml)');
}
