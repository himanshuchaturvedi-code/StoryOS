import { Prisma } from '@storyos/database';
import { asOf } from '@storyos/database';
import { EvaluationSource } from '@storyos/types';
import type { SpendRecord, SpendRecordFilters, DerivedRolesResult } from '@storyos/types';
import type { PrismaService } from '../prisma/prisma.service';
import type { CalculatorInput } from './calculator.interface';
import { budgetLineToSpendRecord, expenseFactToSpendRecord } from './spend-record.projection';
import { BudgetRoleDerivationService } from './budget-role-derivation.service';

type ExpenseFactWithActualLine = Prisma.ExpenseFactGetPayload<{
  include: { actualLine: true };
}>;

type ExpenseFactWithRelations = Prisma.ExpenseFactGetPayload<{
  include: {
    actualLine: true;
    location: true;
    vendor: { include: { principalPerson: true } };
  };
}>;

type BudgetLineWithRelations = Prisma.BudgetLineGetPayload<{
  include: {
    account: true;
    location: true;
    vendor: { include: { principalPerson: true } };
  };
}>;

type ParticipantResidency = Prisma.ParticipantResidencyStatusGetPayload<{}>;

type ActivityPlanWithLocation = Prisma.ActivityPlanGetPayload<{ include: { location: true } }>;

type ActivityDayCached = Prisma.ActivityDayGetPayload<{ include: { location: true; person: true } }>;

export type ActivityDaySummaryFilters = {
  locationFilter?: { country?: string; provinceState?: string; regionCodes?: string[] };
  phaseIds?: string[];
};

/** Per location × phase; `days` is planned days (BUDGET) or distinct activity dates in that group (ACTUAL / BLENDED). */
export interface ActivityDaySummary {
  locationId: string;
  productionPhaseId: string | null;
  days: number;
  location: {
    country: string;
    provinceState: string | null;
    incentiveRegionCode: string | null;
  };
}

export interface ActivityDaySummaryResult {
  summaries: ActivityDaySummary[];
  /** BUDGET: sum of matching planned days. ACTUAL/BLENDED: sum of distinct activity dates per location×phase group (= sum of summary.days). */
  distinctCalendarDaysTotal: number;
}

/**
 * Shared data-loading context for a single evaluation run.
 * Caches results per evaluation so multiple calculators
 * querying the same fact tables don't hit the DB repeatedly.
 */
export class CalculatorContext {
  private expenseFactsCache: ExpenseFactWithActualLine[] | null = null;
  private expenseFactsWithRelationsCache: ExpenseFactWithRelations[] | null = null;
  private budgetLinesWithRelationsCache: BudgetLineWithRelations[] | null = null;
  private spendRecordsCache: SpendRecord[] | null = null;
  private activityDaysCache: ActivityDayCached[] | null = null;
  private activityPlansCache: ActivityPlanWithLocation[] | null = null;
  private residencyBatchCache: Map<string, ParticipantResidency> | null = null;
  private derivedRolesCache: Map<string, DerivedRolesResult> = new Map();
  private readonly budgetRoleDerivation = new BudgetRoleDerivationService();

  constructor(
    private readonly prisma: PrismaService,
    private readonly input: CalculatorInput,
  ) {}

  async getExpenseFacts(filters?: {
    labourFlag?: boolean;
    serviceFlag?: boolean;
  }): Promise<ExpenseFactWithActualLine[]> {
    if (!this.expenseFactsCache) {
      this.expenseFactsCache = await this.prisma.expenseFact.findMany({
        where: {
          projectId: this.input.projectId,
          organizationId: this.input.organizationId,
          deletedAt: null,
        },
        include: { actualLine: true },
      });
    }

    let facts = this.expenseFactsCache;
    if (filters?.labourFlag !== undefined) {
      facts = facts.filter((f) => f.labourFlag === filters.labourFlag);
    }
    if (filters?.serviceFlag !== undefined) {
      facts = facts.filter((f) => f.serviceFlag === filters.serviceFlag);
    }
    return facts;
  }

  async getSpendRecords(filters?: SpendRecordFilters): Promise<SpendRecord[]> {
    if (!this.spendRecordsCache) {
      if (this.input.evaluationSource === EvaluationSource.BLENDED) {
        this.spendRecordsCache = await this.loadBlendedSpendRecords();
      } else if (this.input.evaluationSource === EvaluationSource.BUDGET) {
        this.spendRecordsCache = await this.loadBudgetSpendRecords();
      } else {
        this.spendRecordsCache = await this.loadActualSpendRecords();
      }
    }

    let records = this.spendRecordsCache;
    if (filters?.isLabour !== undefined) {
      records = records.filter((r) => r.isLabour === filters.isLabour);
    }
    if (filters?.isService !== undefined) {
      records = records.filter((r) => r.isService === filters.isService);
    }
    if (filters?.accountTypes?.length) {
      const typeSet = new Set(filters.accountTypes);
      records = records.filter((r) => r.account?.accountType && typeSet.has(r.account.accountType));
    }
    if (filters?.activityTypes?.length) {
      const typeSet = new Set(filters.activityTypes);
      records = records.filter((r) => r.activityType && typeSet.has(r.activityType));
    }
    if (filters?.locationFilter?.country) {
      records = records.filter((r) => r.location?.country === filters.locationFilter!.country);
    }
    if (filters?.locationFilter?.provinceState) {
      records = records.filter((r) => r.location?.provinceState === filters.locationFilter!.provinceState);
    }
    if (filters?.locationFilter?.regionCodes?.length) {
      const regionSet = new Set(filters.locationFilter.regionCodes);
      records = records.filter((r) => r.location?.incentiveRegionCode && regionSet.has(r.location.incentiveRegionCode));
    }
    return records;
  }

  private async loadBudgetSpendRecords(): Promise<SpendRecord[]> {
    if (!this.input.budgetVersionId) return [];
    if (!this.budgetLinesWithRelationsCache) {
      this.budgetLinesWithRelationsCache = await this.prisma.budgetLine.findMany({
        where: {
          budgetVersionId: this.input.budgetVersionId,
          organizationId: this.input.organizationId,
          deletedAt: null,
        },
        include: {
          account: true,
          location: true,
          vendor: { include: { principalPerson: true } },
        },
      });
    }
    return this.budgetLinesWithRelationsCache.map(budgetLineToSpendRecord);
  }

  /**
   * BLENDED mode: merge budget and actual spend records per account.
   * For each BudgetAccount, the accountSourceOverrides map determines
   * whether to source from BUDGET or ACTUAL. Default fallback: BUDGET
   * for accounts that have budget lines, ACTUAL otherwise.
   */
  private async loadBlendedSpendRecords(): Promise<SpendRecord[]> {
    const budgetRecords = await this.loadBudgetSpendRecords();
    const actualRecords = await this.loadActualSpendRecords();

    const overrides = this.input.accountSourceOverrides;

    if (!overrides || overrides.size === 0) {
      return budgetRecords;
    }

    const budgetAccountIds = new Set(
      budgetRecords.map((r) => r.budgetAccountId).filter((id): id is string => id != null),
    );
    const actualByAccount = new Map<string, SpendRecord[]>();
    for (const r of actualRecords) {
      if (r.budgetAccountId) {
        const arr = actualByAccount.get(r.budgetAccountId) ?? [];
        arr.push(r);
        actualByAccount.set(r.budgetAccountId, arr);
      }
    }

    const budgetByAccount = new Map<string, SpendRecord[]>();
    for (const r of budgetRecords) {
      if (r.budgetAccountId) {
        const arr = budgetByAccount.get(r.budgetAccountId) ?? [];
        arr.push(r);
        budgetByAccount.set(r.budgetAccountId, arr);
      }
    }

    const allAccountIds = new Set([...budgetAccountIds, ...actualByAccount.keys()]);
    const result: SpendRecord[] = [];

    for (const accountId of allAccountIds) {
      const source = overrides.get(accountId);
      if (source === EvaluationSource.ACTUAL) {
        const actuals = actualByAccount.get(accountId) ?? [];
        result.push(...actuals);
      } else {
        const budgets = budgetByAccount.get(accountId) ?? [];
        result.push(...budgets);
      }
    }

    const budgetRecordsWithoutAccount = budgetRecords.filter((r) => !r.budgetAccountId);
    const actualRecordsWithoutAccount = actualRecords.filter((r) => !r.budgetAccountId);
    result.push(...budgetRecordsWithoutAccount);
    result.push(...actualRecordsWithoutAccount);

    return result;
  }

  private async loadActualSpendRecords(): Promise<SpendRecord[]> {
    if (!this.expenseFactsWithRelationsCache) {
      this.expenseFactsWithRelationsCache = await this.prisma.expenseFact.findMany({
        where: {
          projectId: this.input.projectId,
          organizationId: this.input.organizationId,
          deletedAt: null,
        },
        include: {
          actualLine: true,
          location: true,
          vendor: { include: { principalPerson: true } },
        },
      });
    }
    return this.expenseFactsWithRelationsCache.map(expenseFactToSpendRecord);
  }

  async getResidencyBatch(personIds: string[]): Promise<Map<string, ParticipantResidency>> {
    if (!this.residencyBatchCache) {
      this.residencyBatchCache = new Map();
    }

    const missing = personIds.filter((id) => !this.residencyBatchCache!.has(id));
    if (missing.length > 0) {
      const results = await this.prisma.participantResidencyStatus.findMany({
        where: {
          personId: { in: missing },
          organizationId: this.input.organizationId,
          deletedAt: null,
          ...asOf(this.input.evaluationDate),
        },
      });
      for (const r of results) {
        this.residencyBatchCache.set(r.personId, r);
      }
    }

    const result = new Map<string, ParticipantResidency>();
    for (const id of personIds) {
      const residency = this.residencyBatchCache.get(id);
      if (residency) result.set(id, residency);
    }
    return result;
  }

  async getActivityDays(filters?: {
    locationFilter?: { country?: string; provinceState?: string; regionCodes?: string[] };
    phaseIds?: string[];
  }) {
    if (!this.activityDaysCache) {
      this.activityDaysCache = await this.prisma.activityDay.findMany({
        where: {
          projectId: this.input.projectId,
          organizationId: this.input.organizationId,
          deletedAt: null,
        },
        include: { location: true, person: true },
      });
    }

    let days = this.activityDaysCache;
    if (filters?.locationFilter?.country) {
      days = days.filter((d) => d.location.country === filters.locationFilter!.country);
    }
    if (filters?.locationFilter?.provinceState) {
      days = days.filter((d) => d.location.provinceState === filters.locationFilter!.provinceState);
    }
    if (filters?.locationFilter?.regionCodes?.length) {
      const regionSet = new Set(filters.locationFilter.regionCodes);
      days = days.filter((d) => d.location?.incentiveRegionCode && regionSet.has(d.location.incentiveRegionCode));
    }
    if (filters?.phaseIds?.length) {
      const phaseSet = new Set(filters.phaseIds);
      days = days.filter((d) => d.productionPhaseId && phaseSet.has(d.productionPhaseId));
    }
    return days;
  }

  /**
   * Activity totals for day-based calculators. BUDGET: ActivityPlan rows.
   * ACTUAL and BLENDED: ActivityDay rows grouped by location × phase; each group’s `days` is distinct activityDate count.
   */
  async getActivityDaySummary(filters?: ActivityDaySummaryFilters): Promise<ActivityDaySummaryResult> {
    if (this.input.evaluationSource === EvaluationSource.BUDGET) {
      return this.getActivityDaySummaryFromPlans(filters);
    }
    return this.getActivityDaySummaryFromActualDays(filters);
  }

  /**
   * Aggregates activity days by incentive region code.
   * Null region codes represent days spent in non-canonical/free-form locations.
   */
  async getActivityRegionSummary(
    filters?: ActivityDaySummaryFilters,
  ): Promise<Array<{ regionCode: string | null; totalDays: number }>> {
    const { summaries } = await this.getActivityDaySummary(filters);
    
    const regionMap = new Map<string | null, number>();
    for (const s of summaries) {
      const code = s.location.incentiveRegionCode;
      const existing = regionMap.get(code) ?? 0;
      regionMap.set(code, existing + s.days);
    }

    return Array.from(regionMap.entries()).map(([regionCode, totalDays]) => ({
      regionCode,
      totalDays,
    }));
  }

  private async getActivityDaySummaryFromPlans(filters?: ActivityDaySummaryFilters): Promise<ActivityDaySummaryResult> {
    if (!this.activityPlansCache) {
      this.activityPlansCache = await this.prisma.activityPlan.findMany({
        where: {
          projectId: this.input.projectId,
          organizationId: this.input.organizationId,
          deletedAt: null,
        },
        include: { location: true },
      });
    }

    let plans = this.activityPlansCache;
    if (filters?.locationFilter?.country) {
      plans = plans.filter((p) => p.location.country === filters.locationFilter!.country);
    }
    if (filters?.locationFilter?.provinceState) {
      plans = plans.filter((p) => p.location.provinceState === filters.locationFilter!.provinceState);
    }
    if (filters?.locationFilter?.regionCodes?.length) {
      const regionSet = new Set(filters.locationFilter.regionCodes);
      plans = plans.filter((p) => p.location.incentiveRegionCode && regionSet.has(p.location.incentiveRegionCode));
    }
    if (filters?.phaseIds?.length) {
      const phaseSet = new Set(filters.phaseIds);
      plans = plans.filter((p) => phaseSet.has(p.productionPhaseId));
    }

    const distinctCalendarDaysTotal = plans.reduce((sum, p) => sum + p.plannedDays, 0);
    const summaries: ActivityDaySummary[] = plans.map((p) => {
      if (!p.location.incentiveRegionCode) {
        console.warn(`[Safeguard] ActivityPlan ${p.id} references location ${p.locationId} with null incentiveRegionCode`);
      }
      return {
        locationId: p.locationId,
        productionPhaseId: p.productionPhaseId,
        days: p.plannedDays,
        location: {
          country: p.location.country,
          provinceState: p.location.provinceState ?? null,
          incentiveRegionCode: p.location.incentiveRegionCode ?? null,
        },
      };
    });

    return { summaries, distinctCalendarDaysTotal };
  }

  private async getActivityDaySummaryFromActualDays(
    filters?: ActivityDaySummaryFilters,
  ): Promise<ActivityDaySummaryResult> {
    const filtered = await this.getActivityDays(filters);

    const groupMap = new Map<string, ActivityDayCached[]>();
    for (const d of filtered) {
      const key = `${d.locationId}\0${d.productionPhaseId ?? ''}`;
      const arr = groupMap.get(key) ?? [];
      arr.push(d);
      groupMap.set(key, arr);
    }

    const summaries: ActivityDaySummary[] = [];
    let distinctCalendarDaysTotal = 0;
    for (const rows of groupMap.values()) {
      const first = rows[0]!;
      if (!first.location.incentiveRegionCode) {
        console.warn(`[Safeguard] ActivityDay group for location ${first.locationId} has null incentiveRegionCode`);
      }
      const distinctDatesInGroup = new Set(
        rows.map((d) => d.activityDate.toISOString().slice(0, 10)),
      ).size;
      distinctCalendarDaysTotal += distinctDatesInGroup;
      summaries.push({
        locationId: first.locationId,
        productionPhaseId: first.productionPhaseId,
        days: distinctDatesInGroup,
        location: {
          country: first.location.country,
          provinceState: first.location.provinceState ?? null,
          incentiveRegionCode: first.location.incentiveRegionCode ?? null,
        },
      });
    }

    return { summaries, distinctCalendarDaysTotal };
  }

  async getResidencyAsOf(personId: string) {
    return this.prisma.participantResidencyStatus.findFirst({
      where: {
        personId,
        organizationId: this.input.organizationId,
        deletedAt: null,
        ...asOf(this.input.evaluationDate),
      },
    });
  }

  async getVendorEligibilityAsOf(vendorId: string, programCode: string) {
    return this.prisma.vendorEligibility.findFirst({
      where: {
        vendorId,
        programCode,
        organizationId: this.input.organizationId,
        deletedAt: null,
        ...asOf(this.input.evaluationDate),
      },
    });
  }

  async getCorporateOwnerships() {
    return this.prisma.corporateOwnership.findMany({
      where: {
        organizationId: this.input.organizationId,
        deletedAt: null,
        ...asOf(this.input.evaluationDate),
      },
    });
  }

  async getProjectOwnerships() {
    return this.prisma.projectOwnership.findMany({
      where: {
        projectId: this.input.projectId,
        organizationId: this.input.organizationId,
        deletedAt: null,
        ...asOf(this.input.evaluationDate),
      },
    });
  }

  async getRightsControlFacts(controlType?: string) {
    return this.prisma.rightsControlFact.findMany({
      where: {
        projectId: this.input.projectId,
        organizationId: this.input.organizationId,
        deletedAt: null,
        ...asOf(this.input.evaluationDate),
        ...(controlType ? { controlType: controlType as any } : {}),
      },
    });
  }

  async getBudgetLines() {
    if (!this.input.budgetVersionId) return [];
    return this.prisma.budgetLine.findMany({
      where: {
        budgetVersionId: this.input.budgetVersionId,
        organizationId: this.input.organizationId,
        deletedAt: null,
      },
      include: {
        account: true,
        person: true,
        vendor: { include: { principalPerson: true } },
        location: true,
        productionPhase: true,
      },
    });
  }

  async getActualLines() {
    return this.prisma.actualLine.findMany({
      where: {
        organizationId: this.input.organizationId,
        deletedAt: null,
        budget: { projectId: this.input.projectId },
      },
    });
  }

  async getProject() {
    return this.prisma.project.findFirst({
      where: {
        id: this.input.projectId,
        organizationId: this.input.organizationId,
        deletedAt: null,
      },
      include: {
        format: true,
      },
    });
  }

  async getDocumentsByCategory(category: string) {
    return this.prisma.document.findMany({
      where: {
        projectId: this.input.projectId,
        organizationId: this.input.organizationId,
        category: category as any,
        deletedAt: null,
      },
    });
  }

  /**
   * Budget-derived role assignments for a given program.
   * Cached per programCode — computed once per evaluation run.
   * Requires budgetVersionId on CalculatorInput; throws if missing.
   */
  async getDerivedRoles(programCode: string): Promise<DerivedRolesResult> {
    const cached = this.derivedRolesCache.get(programCode);
    if (cached) return cached;

    if (!this.input.budgetVersionId) {
      throw new Error(
        `getDerivedRoles requires budgetVersionId but it is null (programCode=${programCode})`,
      );
    }

    const result = await this.budgetRoleDerivation.derive(this.prisma, {
      budgetVersionId: this.input.budgetVersionId,
      organizationId: this.input.organizationId,
      evaluationDate: this.input.evaluationDate,
      programCode,
    });

    this.derivedRolesCache.set(programCode, result);
    return result;
  }

  /** @deprecated Use getDerivedRoles() for incentive eligibility. Retained for document generation compatibility. */
  async getParticipantsWithRoles() {
    return this.prisma.projectParticipant.findMany({
      where: {
        projectId: this.input.projectId,
        organizationId: this.input.organizationId,
        deletedAt: null,
      },
      include: {
        person: true,
        roles: {
          where: { deletedAt: null },
          include: { roleType: true },
        },
      },
    });
  }
}
