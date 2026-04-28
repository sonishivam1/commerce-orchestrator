---
name: nestjs-module
description: NestJS module scaffolding for CDO API. Encodes the exact file structure, resolver/service/repository patterns, and wiring for adding a new domain module to apps/api.
user-invocable: true
---

# NestJS Module Skill — Commerce Data Orchestrator

Given a domain name (e.g., `Webhook`), this skill produces:
1. `[domain].resolver.ts` — GraphQL resolver with auth
2. `[domain].service.ts` — Tenant-scoped business logic
3. `[domain].module.ts` — Wires everything together
4. DTOs as `@InputType()` and `@ObjectType()` classes

## Template: Resolver

```typescript
// apps/api/src/modules/[domain]/[domain].resolver.ts
@Resolver(() => [Domain]Type)
@UseGuards(GqlAuthGuard)
export class [Domain]Resolver {
  constructor(private readonly service: [Domain]Service) {}

  @Query(() => [[Domain]Type])
  async [domains](@CurrentTenant() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Query(() => [Domain]Type)
  async [domain](@Args('id') id: string, @CurrentTenant() tenantId: string) {
    return this.service.findById(tenantId, id);
  }

  @Mutation(() => [Domain]Type)
  async create[Domain](
    @Args('input') input: Create[Domain]Input,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.create(tenantId, input);
  }
}
```

## Template: Service

```typescript
// apps/api/src/modules/[domain]/[domain].service.ts
@Injectable()
export class [Domain]Service {
  private readonly logger = new Logger([Domain]Service.name);

  constructor(private readonly repository: [Domain]Repository) {}

  async findAll(tenantId: string) {
    return this.repository.findAllForTenant(tenantId);
  }

  async findById(tenantId: string, id: string) {
    const item = await this.repository.findById(tenantId, id);
    if (!item) throw new NotFoundException(`[Domain] ${id} not found`);
    return item;
  }

  async create(tenantId: string, input: Create[Domain]Input) {
    return this.repository.create({ ...input, tenantId });
  }
}
```

## Template: Module

```typescript
@Module({
  providers: [[Domain]Resolver, [Domain]Service],
  exports: [[Domain]Service],
})
export class [Domain]Module {}
```

## Wiring into AppModule

```typescript
import { [Domain]Module } from './modules/[domain]/[domain].module';
@Module({ imports: [/* existing */, [Domain]Module] })
export class AppModule {}
```

## Checklist
- [ ] Replace `[Domain]`/`[domain]`/`[domains]` placeholders
- [ ] `@UseGuards(GqlAuthGuard)` on resolver class
- [ ] `@CurrentTenant()` extracts tenantId — never from args
- [ ] Module imported in `app.module.ts`
- [ ] Run `npx tsc --noEmit` to verify
