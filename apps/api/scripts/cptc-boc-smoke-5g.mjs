import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FormatType } from '@storyos/types';
import { loadCptcBocRegistryForForm } from '@storyos/program-registry';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dist = path.join(root, 'apps/api/dist/apps/api/src/document-generation');

const { resolveCptcBocFormSelection } = await import(path.join(dist, 'cptc-boc-form-selection.js'));
const { mapCptcPartAWithRegistry } = await import(path.join(dist, 'cptc-part-a.mapper-v2.js'));
const { renderCptcPartAPdf, buildCptcPartAPdfHeaderLines, buildCptcPartAPdfSummaryRows } =
  await import(path.join(dist, 'pdf.renderer.js'));
const { buildCptcBocFileName, buildCptcBocDocumentTitle } = await import(
  path.join(dist, 'cptc-boc-document-metadata.js')
);
const { buildCptcPartAData, buildBudgetLine } = await import(
  path.join(dist, '__fixtures__/cptc-part-a.fixtures.js')
);
const { buildAnimationCptcPartAData } = await import(
  path.join(dist, '__fixtures__/cptc-part-a-animation.fixtures.js')
);
const { buildHybridCptcPartAData, buildRepresentativeHybridBudgetLines } = await import(
  path.join(dist, '__fixtures__/cptc-part-a-hybrid.fixtures.js')
);

const outDir = path.join(root, 'tmp/cptc-slice5g-smoke');
fs.mkdirSync(outDir, { recursive: true });

function summarizeScenario(label, data) {
  const selection = resolveCptcBocFormSelection(data.projectFormat, data.lines);
  const registry = loadCptcBocRegistryForForm(selection.formCode);
  const mapped = mapCptcPartAWithRegistry(data, registry);
  mapped.warnings.unshift(...selection.warnings);
  return { label, data, selection, mapped };
}

async function writeScenario(result) {
  const { label, data, selection, mapped } = result;
  const pdf = await renderCptcPartAPdf(mapped);
  const fileName = buildCptcBocFileName({
    formCode: mapped.formCode,
    projectTitle: data.project.title,
    generatedAt: mapped.generatedAt,
  });
  fs.writeFileSync(path.join(outDir, fileName), pdf);

  const meta = {
    label,
    formCode: mapped.formCode,
    reason: selection.reason,
    fileName,
    documentTitle: buildCptcBocDocumentTitle({
      formCode: mapped.formCode,
      formLabel: mapped.formLabel,
      projectTitle: data.project.title,
    }),
    header: buildCptcPartAPdfHeaderLines(mapped),
    summaryCodes: buildCptcPartAPdfSummaryRows(mapped).map((row) => row[0]),
    warnings: mapped.warnings.map((warning) => warning.message),
    totalCostOfProduction: mapped.summary.totalCostOfProduction,
  };

  fs.writeFileSync(path.join(outDir, `${label}.json`), JSON.stringify(meta, null, 2));
  return meta;
}

const liveActionLines = [
  buildBudgetLine({
    amount: 50000,
    account: { code: '05.01', name: 'Director' },
    personId: 'person-director',
  }),
  buildBudgetLine({
    amount: 8000,
    account: { code: '23.01', name: 'Key Grip' },
    location: { country: 'CA' },
  }),
];
const liveActionData = buildCptcPartAData(liveActionLines);
liveActionData.project.title = 'Smoke Live Action';
liveActionData.projectFormat = {
  formatType: FormatType.FEATURE_FILM,
  isLiveAction: true,
  hasAnimation: false,
  animationPercentage: null,
};

const animationLines = [
  buildBudgetLine({
    amount: 25000,
    account: { code: '06.01', name: 'Stars/Star (Lead) Voices' },
    personId: 'person-voice',
  }),
  buildBudgetLine({
    amount: 14000,
    account: { code: '55.10', name: 'Key Animator/Key Posing Artist' },
    personId: 'person-animator',
  }),
];
const animationData = buildAnimationCptcPartAData(animationLines);
animationData.project.title = 'Smoke Animation';

const hybridLines = buildRepresentativeHybridBudgetLines();
const hybridData = buildHybridCptcPartAData(hybridLines, 60);
hybridData.project.title = 'Smoke Hybrid';

const results = await Promise.all([
  writeScenario(summarizeScenario('live-action', liveActionData)),
  writeScenario(summarizeScenario('animation', animationData)),
  writeScenario(summarizeScenario('hybrid', hybridData)),
]);

console.log(JSON.stringify(results, null, 2));
