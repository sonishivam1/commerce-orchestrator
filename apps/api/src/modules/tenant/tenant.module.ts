import { Module } from '@nestjs/common';
import { AuthModule } from '@cdo/auth';
import { TenantResolver } from './tenant.resolver';
import { TenantService } from './tenant.service';

@Module({
    imports: [AuthModule],
    providers: [TenantResolver, TenantService],
    exports: [TenantService],
})
export class TenantModule { }
