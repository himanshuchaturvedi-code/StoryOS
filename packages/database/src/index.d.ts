/**
 * @storyos/database
 *
 * Exports:
 * 1. Prisma-generated client (PrismaClient, all model types, enums)
 *    — requires `npm run db:generate` to be run first
 * 2. Soft-delete middleware
 * 3. Temporal query helpers
 *
 * Usage in apps/api:
 *   import { PrismaClient } from '@storyos/database';
 *   import { softDeleteMiddleware } from '@storyos/database';
 *   import { asOf, currentlyEffective } from '@storyos/database';
 */
export * from './generated/prisma';
export { applySoftDelete } from './middleware/soft-delete';
export { asOf, currentlyEffective, activeDuring, activeOn } from './helpers/temporal';
export type { TemporalFilter, DateRangeFilter } from './helpers/temporal';
//# sourceMappingURL=index.d.ts.map