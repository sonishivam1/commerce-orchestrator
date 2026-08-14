import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, tap } from 'rxjs';

/**
 * Logs every GraphQL operation with timing.
 * Includes tenantId when available via JWT context.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('GraphQL');

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const ctx = GqlExecutionContext.create(context);
        const info = ctx.getInfo();
        const operationType = info?.parentType?.name ?? 'unknown';
        const fieldName = info?.fieldName ?? 'unknown';
        const start = Date.now();

        return next.handle().pipe(
            tap({
                next: () => {
                    const ms = Date.now() - start;
                    this.logger.log(`${operationType}.${fieldName} — ${ms}ms`);
                },
                error: (err: Error) => {
                    const ms = Date.now() - start;
                    this.logger.error(`${operationType}.${fieldName} — ${ms}ms — ${err.message}`);
                },
            }),
        );
    }
}
