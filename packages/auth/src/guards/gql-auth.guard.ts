import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
    getRequest(context: ExecutionContext) {
        const ctx = GqlExecutionContext.create(context);
        return ctx.getContext().req;
    }

    handleRequest<TUser = { tenantId: string }>(err: Error | null, user: TUser | false): TUser {
        if (err || !user) {
            throw new UnauthorizedException('Invalid or expired token');
        }
        return user;
    }
}
