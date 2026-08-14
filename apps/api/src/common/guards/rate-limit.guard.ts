import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Rate-limit guard that extracts the HTTP request from both REST and GraphQL
 * execution contexts so @nestjs/throttler can read the client IP.
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
    protected getRequestResponse(context: ExecutionContext) {
        const gqlCtx = GqlExecutionContext.create(context);
        const ctx = gqlCtx.getContext<{ req: Request; res: Response }>();
        // GraphQL context — ctx.req / ctx.res are the Express request/response
        if (ctx?.req) {
            return { req: ctx.req, res: ctx.res };
        }
        // Fallback: REST HTTP context
        const http = context.switchToHttp();
        return { req: http.getRequest(), res: http.getResponse() };
    }
}
