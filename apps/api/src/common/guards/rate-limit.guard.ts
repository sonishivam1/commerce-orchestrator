import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Global rate-limit guard.
 *
 * Behaviour:
 *  - Extracts the Express request from both REST and GraphQL execution contexts
 *    so @nestjs/throttler can locate the correct request object (GraphQL wraps
 *    the request inside a context object — `ctx.req` — rather than exposing it
 *    directly on the execution context).
 *
 *  - Keys the rate-limit counter on the authenticated tenant's `tenantId` when
 *    a JWT has been validated (`req.user.tenantId` is populated by JwtStrategy).
 *    Falls back to the client IP address for unauthenticated endpoints (login,
 *    register, health). This prevents one tenant from consuming another tenant's
 *    quota and stops IP-based attacks on public endpoints.
 *
 * Limit: 100 requests per 60 seconds (configured in ThrottlerModule.forRootAsync).
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
    /**
     * Extract the raw Express request from either a REST or GraphQL context.
     * ThrottlerGuard calls this to obtain `req` before invoking `getTracker`.
     */
    protected getRequestResponse(context: ExecutionContext) {
        const gqlCtx = GqlExecutionContext.create(context);
        const ctx = gqlCtx.getContext<{ req: Request; res: Response }>();
        // GraphQL path: ctx.req / ctx.res are the underlying Express objects
        if (ctx?.req) {
            return { req: ctx.req, res: ctx.res };
        }
        // REST path (health endpoint, etc.)
        const http = context.switchToHttp();
        return { req: http.getRequest(), res: http.getResponse() };
    }

    /**
     * Return the throttle key for the current request.
     *
     * Priority:
     *   1. `tenant:{tenantId}` — set after JwtStrategy validates the token
     *   2. Client IP address   — for unauthenticated requests
     *   3. `'anonymous'`       — last-resort when neither is available
     */
    protected async getTracker(req: Record<string, any>): Promise<string> {
        const tenantId = req?.user?.tenantId as string | undefined;
        if (tenantId) {
            return `tenant:${tenantId}`;
        }
        // Express sets req.ip; fall back to socket address when running behind a proxy
        const ip =
            (req?.ip as string | undefined) ??
            (req?.socket?.remoteAddress as string | undefined) ??
            'anonymous';
        return ip;
    }
}
