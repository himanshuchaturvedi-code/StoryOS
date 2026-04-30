import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from './tenant.context';

/**
 * Base class for all tenant-scoped services.
 *
 * ARCHITECTURAL RULES:
 * 1. Every service that queries tenant-scoped data MUST extend this class.
 * 2. Every Prisma query on a tenant-scoped table MUST use tenantFilter() in its where clause.
 * 3. Every Prisma create on a tenant-scoped table MUST use tenantData() to inject organizationId.
 * 4. No service may construct a Prisma query on a tenant-scoped table without these helpers.
 *
 * TENANT-SCOPED TABLES (have organizationId column):
 *   Project, ProjectAccess, ProjectMetadata, ProjectFormat, ProjectStageHistory,
 *   ProductionPhase, ProjectMilestone, Person, ProjectParticipant,
 *   ProjectParticipantRole, Location, ProjectLocation, Document
 *
 * GLOBAL TABLES (no organizationId — do NOT apply tenant filter):
 *   User, ParticipantRoleType
 *
 * SOFT DELETE — TOP-LEVEL QUERIES:
 * tenantFilter() includes deletedAt: null by default.
 * To query deleted records (admin/restore operations), pass { deletedAt: undefined }.
 *
 * SOFT DELETE — INCLUDED RELATIONS:
 * The soft-delete extension only intercepts delete/deleteMany operations.
 * It does NOT auto-filter `include` relations. Soft-deleted related records
 * will be returned unless explicitly filtered.
 *
 * ALWAYS apply softDeleteFilter to every `include` clause on a soft-deletable relation:
 *
 * @example
 *   // CORRECT — included relations are filtered
 *   await this.prisma.project.findFirst({
 *     where: this.tenantFilter({ id }),
 *     include: {
 *       phases:       { where: this.softDeleteFilter },
 *       participants: { where: this.softDeleteFilter },
 *       documents:    { where: this.softDeleteFilter },
 *     },
 *   });
 *
 * @example
 *   // WRONG — soft-deleted phases will appear in results
 *   await this.prisma.project.findFirst({
 *     where: this.tenantFilter({ id }),
 *     include: { phases: true },
 *   });
 *
 * SOFT-DELETABLE RELATIONS (always apply softDeleteFilter when including):
 *   phases, milestones, participants (and their roles), locations, documents,
 *   access, metadata, format
 *
 * NON-SOFT-DELETABLE RELATIONS (no filter needed):
 *   stageHistory, roleType (ParticipantRoleType), productionPhase (reference only)
 *
 * @example
 *   // Find all active projects for the current tenant
 *   const projects = await this.prisma.project.findMany({
 *     where: this.tenantFilter({ status: 'ACTIVE' }),
 *   });
 *
 * @example
 *   // Create a project scoped to the current tenant
 *   const project = await this.prisma.project.create({
 *     data: this.tenantData({ title: 'My Film', createdById: this.tenant.userId }),
 *   });
 *
 * @example
 *   // Query including deleted records (explicit opt-in)
 *   const allProjects = await this.prisma.project.findMany({
 *     where: this.tenantFilter({ deletedAt: undefined }),
 *   });
 */
export abstract class TenantAwareService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly tenant: TenantContext,
  ) {}

  /**
   * Returns the current tenant's organizationId.
   * Throws if TenantContext is not initialized.
   */
  protected get organizationId(): string {
    return this.tenant.organizationId;
  }

  /**
   * Builds a WHERE fragment for tenant-scoped queries.
   * Always includes organizationId and deletedAt: null unless overridden.
   *
   * @param extra - Additional WHERE conditions to merge
   */
  protected tenantFilter<T extends Record<string, unknown>>(
    extra: T = {} as T,
  ): { organizationId: string; deletedAt: null } & T {
    const { deletedAt, ...rest } = extra as { deletedAt?: unknown } & Omit<T, 'deletedAt'>;
    return {
      organizationId: this.organizationId,
      deletedAt: deletedAt === undefined ? null : (deletedAt as null),
      ...rest,
    } as { organizationId: string; deletedAt: null } & T;
  }

  /**
   * Injects organizationId into create/update data.
   *
   * @param data - The data object to augment with tenant context
   */
  protected tenantData<T extends Record<string, unknown>>(data: T): T & { organizationId: string } {
    return { ...data, organizationId: this.organizationId };
  }

  /**
   * WHERE fragment for filtering soft-deleted records out of included relations.
   *
   * The soft-delete extension only intercepts delete/deleteMany — it does NOT
   * auto-filter `include` clauses. This constant must be applied manually to
   * every `include` on a soft-deletable relation.
   *
   * @example
   *   include: {
   *     phases:       { where: this.softDeleteFilter },
   *     participants: { where: this.softDeleteFilter },
   *     documents:    { where: this.softDeleteFilter },
   *   }
   */
  protected readonly softDeleteFilter = { deletedAt: null } as const;
}
