import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AuthModule } from './modules/auth/auth.module';
import { CredentialModule } from './modules/credential/credential.module';
import { JobModule } from './modules/job/job.module';
import { TenantModule } from './modules/tenant/tenant.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      context: ({ req }: { req: Record<string, unknown> }) => ({ req }),
    }),
    AuthModule,
    CredentialModule,
    JobModule,
    TenantModule,
  ],
})
export class AppModule { }
