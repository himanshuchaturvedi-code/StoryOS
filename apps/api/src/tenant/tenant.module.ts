import { Module } from '@nestjs/common';
import { TenantContext } from './tenant.context';

/**
 * TenantModule provides the request-scoped TenantContext.
 *
 * Import this module in any NestJS module whose services extend TenantAwareService.
 * TenantGuard (added in Phase 1B) will depend on this module to initialize the context.
 */
@Module({
  providers: [TenantContext],
  exports: [TenantContext],
})
export class TenantModule {}
