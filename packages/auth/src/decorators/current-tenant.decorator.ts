import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export interface TenantContext {
    /** Organization id — the data-scoping axis for every repository call. */
    tenantId: string;
    /** The signed-in user's id. */
    userId: string;
    email: string;
    /** 'OWNER' | 'MEMBER' */
    role: string;
}

/**
 * @CurrentTenant() / @CurrentOrg() — injects the authenticated principal
 * (org + user) from the JWT into resolvers.
 */
export const CurrentTenant = createParamDecorator(
    (_: unknown, context: ExecutionContext): TenantContext => {
        const ctx = GqlExecutionContext.create(context);
        return ctx.getContext().req.user;
    },
);

/** Alias — same value, clearer name now that a user is also present. */
export const CurrentOrg = CurrentTenant;
