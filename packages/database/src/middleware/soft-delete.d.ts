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
import { PrismaClient } from '../generated/prisma';
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
export declare function applySoftDelete<T extends PrismaClient>(client: T): T;
//# sourceMappingURL=soft-delete.d.ts.map