import { Module } from '@nestjs/common';
import { AuthModule as CoreAuthModule } from '@cdo/auth';
import { TenantModule } from '../tenant/tenant.module';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';

@Module({
    imports: [CoreAuthModule, TenantModule],
    providers: [AuthResolver, AuthService],
    exports: [AuthService],
})
export class AuthModule { }
