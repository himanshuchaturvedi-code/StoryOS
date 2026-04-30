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

// Generated Prisma client — run `npm run db:generate` from repo root if this fails
export * from './generated/prisma';

// Soft-delete extension (Prisma 6+)
export { applySoftDelete } from './middleware/soft-delete';

// Temporal helpers
export { asOf, currentlyEffective, activeDuring, activeOn } from './helpers/temporal';
export type { TemporalFilter, DateRangeFilter } from './helpers/temporal';
