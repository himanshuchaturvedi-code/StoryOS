import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  id: string;
  email: string;
}

/**
 * Extracts the authenticated user from the request.
 * Available after JwtAuthGuard has validated the token.
 *
 * @example
 *   @Get('me')
 *   async getMe(@CurrentUser() user: RequestUser) { return user; }
 *
 * @example
 *   @Get('me')
 *   async getMyId(@CurrentUser('id') userId: string) { return userId; }
 */
export const CurrentUser = createParamDecorator(
  (field: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as RequestUser;
    return field ? user?.[field] : user;
  },
);
