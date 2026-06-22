export { loadCptcBocRegistry, loadCptcBocRegistryFromString } from './load-cptc-boc-registry';
export {
  validateCptcBocRegistry,
  buildRegistryCoverageReport,
  resolveAccountLineMappings,
  findLineByCode,
  lineMapsAccount,
  type AccountLineMapping,
} from './validate-cptc-boc-registry';
export { parseTelefilmTemplateAccounts, type TelefilmTemplateAccount } from './telefilm-template-accounts';
export { matchAccountPattern, accountMatchesRule, accountMatchesAnyPattern } from './pattern-match';
export { findMonorepoRoot, resolveFromMonorepoRoot, getDefaultCptcBocRegistryPath } from './paths';

export const CPTC_BOC_REGISTRY_FORM_CODE = '01F21';
export const CPTC_BOC_REGISTRY_TEMPLATE_ID = 'telefilm-doc-v1';
