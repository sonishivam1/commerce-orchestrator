---
name: new-service
description: Scaffold a complete new NestJS microservice in the monorepo — package.json, module, controller, service, repository, schema, DTOs, main.ts, health check, Swagger, then type-check
argument-hint: "[service-name, e.g. 'notification-service']"
---

Scaffold new microservice: $ARGUMENTS

## Execute autonomously

### Step 1: Read an Existing Service for Reference
Read these files from `apps/product-service/` to understand exact patterns:
- `src/main.ts`
- `src/app.module.ts`
- `src/product/product.module.ts`
- `src/product/product.controller.ts`
- `src/product/product.service.ts`
- `src/product/product.repository.ts`
- `src/product/schemas/product.schema.ts`
- `package.json`
- `tsconfig.json`

### Step 2: Determine Port
Check CLAUDE.md service port map. Pick the next available port after 8092 (or 3005+).

### Step 3: Create the Service Directory Structure
```
apps/$ARGUMENTS/
  src/
    $ARGUMENTS/
      $ARGUMENTS.controller.ts
      $ARGUMENTS.service.ts
      $ARGUMENTS.repository.ts
      $ARGUMENTS.module.ts
      dto/
        create-$ARGUMENTS.dto.ts
        update-$ARGUMENTS.dto.ts
      schemas/
        $ARGUMENTS.schema.ts
    app.module.ts
    main.ts
  package.json
  tsconfig.json
  tsconfig.build.json
  .eslintrc.js
  .env.example
```

### Step 4: Implement Each File

Follow patterns exactly from product-service. Every file must have:

**Schema:** extends BaseSchema, explicit collection name, indexes
**Repository:** extends BaseRepository
**Service:** Logger injected, NestJS exceptions, tenant-scoped queries
**Controller:** @UseGuards(JwtAuthGuard), @ApiTags, @ApiBearerAuth, @CurrentUser()
**main.ts:** ValidationPipe (whitelist+forbidNonWhitelisted+transform), Helmet, Swagger at /api-docs, health check at /health
**app.module.ts:** ConfigModule with Joi validation, DatabaseModule, FeatureModule
**package.json:** name @metafy/[service-name], correct start script with port env var

### Step 5: Add to Root Workspace
Show the exact line to add to root `package.json` workspaces array.

### Step 6: Type Check the New Service
```bash
cd apps/$ARGUMENTS && npm install && npm run build 2>&1 | head -50
```
Fix all TypeScript errors.

### Step 7: Report
- Port assigned
- Files created (full list)
- Next steps: add to `npm run dev` in root package.json, add to CI/CD (manual step for deployment planning)
