import fs from 'fs';
import yaml from 'js-yaml';
import type {
  BocColumnFamily,
  BocColumnKey,
  BocFormRegistry,
  BocLineSourceRule,
  BocPolicyMatchRule,
  BocPolicyNote,
  BocPolicyRoutingOverride,
  BocSummaryFormulaType,
} from '@storyos/types';
import { getCptcBocRegistryPath, getDefaultCptcBocRegistryPath, type CptcBocFormCode } from './paths';

const VALID_BOC_COLUMN_KEYS: readonly BocColumnKey[] = [
  'keyCreativeCanadian',
  'keyCreativeNonCanadian',
  'servicesCanadian',
  'servicesNonCanadian',
  'postProductionLabCanadian',
  'postProductionLabNonCanadian',
  'otherCosts',
];

const SUMMARY_FORMULA_TYPES: BocSummaryFormulaType[] = [
  'SUM_LINE_TOTALS',
  'SUM_KEY_CREATIVE_COLUMNS',
  'SUM_POST_LAB_COLUMNS',
  'RATIO_KEY_CREATIVE_CANADIAN',
  'RATIO_POST_LAB_CANADIAN',
];

const VALID_COLUMN_FAMILIES: readonly BocColumnFamily[] = [
  'keyCreative',
  'producerRemuneration',
  'lineProducerRemuneration',
  'producerServices',
  'producerTravel',
  'lineProducerTravel',
  'postProduction',
  'services',
  'other',
];

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Registry field "${field}" must be a non-empty string`);
  }
  return value;
}

function parseSourceRule(raw: unknown, lineCode: string, index: number): BocLineSourceRule {
  if (raw == null || typeof raw !== 'object') {
    throw new Error(`Line ${lineCode} source[${index}] must be an object`);
  }

  const source = raw as Record<string, unknown>;
  const templateId = assertString(source.templateId, `lines.${lineCode}.sources[${index}].templateId`);

  const parseStringArray = (field: string): string[] | undefined => {
    const value = source[field];
    if (value == null) return undefined;
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
      throw new Error(`Line ${lineCode} source[${index}].${field} must be a string array`);
    }
    return value;
  };

  return {
    templateId,
    accounts: parseStringArray('accounts'),
    patterns: parseStringArray('patterns'),
    rollups: parseStringArray('rollups'),
    excludeAccounts: parseStringArray('excludeAccounts'),
    allowShared: source.allowShared === true ? true : undefined,
  };
}

function parseAllowedColumns(raw: unknown, lineCode: string): BocColumnKey[] {
  if (!Array.isArray(raw)) {
    throw new Error(`Line ${lineCode} allowedColumns must be an array`);
  }

  for (const column of raw) {
    if (typeof column !== 'string' || !VALID_BOC_COLUMN_KEYS.includes(column as BocColumnKey)) {
      throw new Error(
        `Line ${lineCode} has invalid allowedColumn "${String(column)}". Expected one of: ${VALID_BOC_COLUMN_KEYS.join(', ')}`,
      );
    }
  }

  return raw as BocColumnKey[];
}

function parseStringArrayField(
  value: unknown,
  field: string,
): string[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${field} must be a string array`);
  }
  return value;
}

function parsePolicyMatchRule(raw: unknown, context: string): BocPolicyMatchRule {
  if (raw == null || typeof raw !== 'object') {
    throw new Error(`${context}.match must be an object`);
  }
  const match = raw as Record<string, unknown>;
  return {
    telefilmPatterns: parseStringArrayField(match.telefilmPatterns, `${context}.match.telefilmPatterns`),
    telefilmAccounts: parseStringArrayField(match.telefilmAccounts, `${context}.match.telefilmAccounts`),
    accountNamePatterns: parseStringArrayField(
      match.accountNamePatterns,
      `${context}.match.accountNamePatterns`,
    ),
    tags: parseStringArrayField(match.tags, `${context}.match.tags`),
    excludeAccounts: parseStringArrayField(match.excludeAccounts, `${context}.match.excludeAccounts`),
  };
}

function parsePolicyNotes(raw: unknown): BocPolicyNote[] | undefined {
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error('Registry policyNotes must be an array');
  }

  return raw.map((noteRaw, index) => {
    if (noteRaw == null || typeof noteRaw !== 'object') {
      throw new Error(`Registry policyNotes[${index}] must be an object`);
    }
    const note = noteRaw as Record<string, unknown>;
    const id = assertString(note.id, `policyNotes[${index}].id`);
    const description = assertString(note.description, `policyNotes[${index}].description`);

    if (!Array.isArray(note.overrides)) {
      throw new Error(`Policy ${id} overrides must be an array`);
    }

    const overrides: BocPolicyRoutingOverride[] = note.overrides.map((overrideRaw, overrideIndex) => {
      if (overrideRaw == null || typeof overrideRaw !== 'object') {
        throw new Error(`Policy ${id} overrides[${overrideIndex}] must be an object`);
      }
      const override = overrideRaw as Record<string, unknown>;
      return {
        match: parsePolicyMatchRule(override.match, `policyNotes[${index}].overrides[${overrideIndex}]`),
        interimLine: assertString(
          override.interimLine,
          `policyNotes[${index}].overrides[${overrideIndex}].interimLine`,
        ),
        officialLine: assertString(
          override.officialLine,
          `policyNotes[${index}].overrides[${overrideIndex}].officialLine`,
        ),
      };
    });

    return {
      id,
      description,
      useInterimRouting: note.useInterimRouting === false ? false : undefined,
      overrides,
    };
  });
}

function parseRegistry(raw: unknown): BocFormRegistry {
  if (raw == null || typeof raw !== 'object') {
    throw new Error('Registry root must be an object');
  }

  const doc = raw as Record<string, unknown>;
  const metaRaw = doc.meta;
  if (metaRaw == null || typeof metaRaw !== 'object') {
    throw new Error('Registry meta must be an object');
  }

  const metaObj = metaRaw as Record<string, unknown>;
  const meta = {
    programCode: assertString(metaObj.programCode, 'meta.programCode'),
    formCode: assertString(metaObj.formCode, 'meta.formCode'),
    formLabel: assertString(metaObj.formLabel, 'meta.formLabel'),
    formVersion: assertString(metaObj.formVersion, 'meta.formVersion'),
    registryVersion: assertString(metaObj.registryVersion, 'meta.registryVersion'),
    templateVersion: assertString(metaObj.templateVersion, 'meta.templateVersion'),
  };

  if (!Array.isArray(doc.lines)) {
    throw new Error('Registry lines must be an array');
  }

  const lines = doc.lines.map((lineRaw, index) => {
    if (lineRaw == null || typeof lineRaw !== 'object') {
      throw new Error(`Registry lines[${index}] must be an object`);
    }
    const line = lineRaw as Record<string, unknown>;
    const code = assertString(line.code, `lines[${index}].code`);
    const label = assertString(line.label, `lines[${index}].label`);
    const allowedColumns = parseAllowedColumns(line.allowedColumns, code);

    let sources: BocLineSourceRule[] | undefined;
    if (line.sources != null) {
      if (!Array.isArray(line.sources)) {
        throw new Error(`Line ${code} sources must be an array`);
      }
      sources = line.sources.map((source, sourceIndex) =>
        parseSourceRule(source, code, sourceIndex),
      );
    }

    return {
      code,
      label,
      parentCode: typeof line.parentCode === 'string' ? line.parentCode : undefined,
      isHeader: line.isHeader === true ? true : undefined,
      forceEmpty: line.forceEmpty === true ? true : undefined,
      allowedColumns,
      columnFamily:
        typeof line.columnFamily === 'string' &&
        VALID_COLUMN_FAMILIES.includes(line.columnFamily as BocColumnFamily)
          ? (line.columnFamily as BocColumnFamily)
          : undefined,
      sources,
    };
  });

  if (!Array.isArray(doc.summaryLines)) {
    throw new Error('Registry summaryLines must be an array');
  }

  const summaryLines = doc.summaryLines.map((summaryRaw, index) => {
    if (summaryRaw == null || typeof summaryRaw !== 'object') {
      throw new Error(`Registry summaryLines[${index}] must be an object`);
    }
    const summary = summaryRaw as Record<string, unknown>;
    const code = assertString(summary.code, `summaryLines[${index}].code`);
    const label = assertString(summary.label, `summaryLines[${index}].label`);
    const formula = summary.formula;
    if (typeof formula !== 'string' || !SUMMARY_FORMULA_TYPES.includes(formula as BocSummaryFormulaType)) {
      throw new Error(
        `Summary line ${code} has invalid formula "${String(formula)}". Expected one of: ${SUMMARY_FORMULA_TYPES.join(', ')}`,
      );
    }

    let sourceLineRange: [string, string] | undefined;
    if (summary.sourceLineRange != null) {
      if (
        !Array.isArray(summary.sourceLineRange) ||
        summary.sourceLineRange.length !== 2 ||
        typeof summary.sourceLineRange[0] !== 'string' ||
        typeof summary.sourceLineRange[1] !== 'string'
      ) {
        throw new Error(`Summary line ${code} sourceLineRange must be a two-element string array`);
      }
      sourceLineRange = [summary.sourceLineRange[0], summary.sourceLineRange[1]];
    }

    return {
      code,
      label,
      formula: formula as BocSummaryFormulaType,
      sourceLineRange,
    };
  });

  const templatesRaw = doc.templates;
  if (templatesRaw == null || typeof templatesRaw !== 'object') {
    throw new Error('Registry templates must be an object');
  }

  const templates: BocFormRegistry['templates'] = {};
  for (const [templateId, templateRaw] of Object.entries(templatesRaw)) {
    if (templateRaw == null || typeof templateRaw !== 'object') {
      throw new Error(`Template ${templateId} must be an object`);
    }
    const template = templateRaw as Record<string, unknown>;
    templates[templateId] = {
      sourceFile: assertString(template.sourceFile, `templates.${templateId}.sourceFile`),
      sheetName: typeof template.sheetName === 'string' ? template.sheetName : undefined,
      coverageExcludePatterns: Array.isArray(template.coverageExcludePatterns)
        ? template.coverageExcludePatterns.filter((entry): entry is string => typeof entry === 'string')
        : undefined,
      unmappedAccountPolicy:
        template.unmappedAccountPolicy === 'ERROR' ? 'ERROR' : 'WARN',
    };
  }

  return {
    meta,
    lines,
    summaryLines,
    templates,
    policyNotes: parsePolicyNotes(doc.policyNotes),
  };
}

export function loadCptcBocRegistry(filePath?: string): BocFormRegistry {
  const resolvedPath = filePath ?? getDefaultCptcBocRegistryPath();
  const contents = fs.readFileSync(resolvedPath, 'utf8');
  const parsed = yaml.load(contents);
  return parseRegistry(parsed);
}

export function loadCptcBocRegistryForForm(formCode: CptcBocFormCode): BocFormRegistry {
  return loadCptcBocRegistry(getCptcBocRegistryPath(formCode));
}

export function loadCptcBocRegistryFromString(yamlContents: string): BocFormRegistry {
  const parsed = yaml.load(yamlContents);
  return parseRegistry(parsed);
}
