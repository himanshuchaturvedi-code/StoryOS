"use strict";
/**
 * Soft-delete extension for Prisma 6+.
 *
 * Prisma 6 removed the `$use()` middleware API in favour of Prisma Client Extensions.
 * This module exports:
 *   1. softDeleteExtension — a Prisma extension that intercepts delete operations
 *   2. applySoftDelete(client) — helper to apply the extension and return a typed client
 *
 * FILTERING CONVENTION:
 * This extension does NOT auto-inject `deletedAt: null` into find queries.
 * Every query on a soft-deletable table must explicitly filter via
 * TenantAwareService.tenantFilter(), which always includes `deletedAt: null`.
 *
 * This deliberate choice prevents the extension from silently breaking:
 *   - Aggregate queries
 *   - Admin queries that need to see deleted records
 *   - Restore operations
 *
 * To query deleted records, pass { deletedAt: undefined } to tenantFilter().
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.applySoftDelete = applySoftDelete;
const SOFT_DELETE_MODELS = [
    'user',
    'organization',
    'organizationMember',
    'project',
    'projectAccess',
    'projectMetadata',
    'projectFormat',
    'productionPhase',
    'projectMilestone',
    'person',
    'projectParticipant',
    'projectParticipantRole',
    'location',
    'projectLocation',
    'document',
];
function isSoftDeleteModel(model) {
    return SOFT_DELETE_MODELS.includes(model);
}
/**
 * Wraps a PrismaClient with the soft-delete extension.
 *
 * Usage in PrismaService:
 *   constructor() {
 *     super();
 *     return applySoftDelete(this) as this;
 *   }
 *
 * NOTE: Because Prisma extensions return a new client type, and NestJS requires
 * the injected PrismaService to be the exact class, we use Object.assign to
 * mutate the client in place. For type-safety in application code, use the
 * exported softDeleteExtension directly if needed.
 */
function applySoftDelete(client) {
    const extended = client.$extends({
        query: {
            $allModels: {
                async delete({ model, args, query }) {
                    if (!isSoftDeleteModel(model.charAt(0).toLowerCase() + model.slice(1))) {
                        return query(args);
                    }
                    // Cast to any to bypass strict typing on the dynamic model operation
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return client[model.charAt(0).toLowerCase() + model.slice(1)].update({
                        where: args.where,
                        data: { deletedAt: new Date() },
                    });
                },
                async deleteMany({ model, args, query }) {
                    if (!isSoftDeleteModel(model.charAt(0).toLowerCase() + model.slice(1))) {
                        return query(args);
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return client[model.charAt(0).toLowerCase() + model.slice(1)].updateMany({
                        where: args.where,
                        data: { deletedAt: new Date() },
                    });
                },
            },
        },
    });
    // Copy extended methods back onto the original client instance so NestJS DI works correctly
    Object.assign(client, extended);
    return client;
}
//# sourceMappingURL=soft-delete.js.map