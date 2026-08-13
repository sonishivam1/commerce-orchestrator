import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'crypto';

/**
 * Injects a unique X-Trace-Id header into every response.
 * This trace ID correlates request logs across the API and worker services.
 */
@Injectable()
export class TraceInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const ctx = GqlExecutionContext.create(context);
        const req = ctx.getContext()?.req;

        if (req && !req.traceId) {
            req.traceId = randomUUID();
        }

        return next.handle();
    }
}
