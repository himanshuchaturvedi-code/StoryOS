import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as public — bypasses the global JwtAuthGuard.
 *
 * Use for: auth/register, auth/login, invitation verify/accept.
 * Every other route requires a valid JWT by default.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
