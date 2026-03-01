import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export interface TenantContext {
    tenantId: string;
    email: string;
}

/**
 * @CurrentTenant() — injects the authenticated tenant from JWT into resolvers.
 * Usage: @CurrentTenant() tenant: TenantContext
 */
export const CurrentTenant = createParamDecorator(
    (_: unknown, context: ExecutionContext): TenantContext => {
        const ctx = GqlExecutionContext.create(context);
        return ctx.getContext().req.user;
    },
);
