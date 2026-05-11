---
description: Scaffold a complete new NestJS API module with resolver, service, and wiring
argument-hint: "[module-name, e.g. 'webhook']"
---

Scaffold new API module: **$ARGUMENTS**

## Execute autonomously

### Step 1: Read Existing Module for Reference
Read these files from `apps/api/src/modules/job/`:
- `job.module.ts`
- `job.service.ts`
- `job.resolver.ts`

### Step 2: Create Module Directory
```
apps/api/src/modules/$ARGUMENTS/
  $ARGUMENTS.module.ts
  $ARGUMENTS.service.ts
  $ARGUMENTS.resolver.ts
  dto/
    create-$ARGUMENTS.input.ts
    $ARGUMENTS.type.ts
```

### Step 3: Implement Each File

**Resolver:** `@UseGuards(GqlAuthGuard)`, `@CurrentTenant()`, `@Query`, `@Mutation`
**Service:** Logger injected, tenant-scoped queries, NestJS exceptions
**Module:** Register resolver + service, export service
**DTOs:** `@InputType()` for inputs, `@ObjectType()` for return types

### Step 4: Wire Into AppModule
Add import to `apps/api/src/app.module.ts`

### Step 5: Verify
```bash
npx tsc --noEmit 2>&1 | tail -20
```

### Step 6: Report
- Files created (full list)
- Module registered in AppModule
- Any remaining TODOs
