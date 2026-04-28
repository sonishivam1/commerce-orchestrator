---
description: Shared packages rules — auto-loads when editing any file in packages/ (database, config, logger, messaging, etc.)
globs:
  - "packages/database/src/**/*.ts"
  - "packages/config/src/**/*.ts"
  - "packages/logger/src/**/*.ts"
  - "packages/messaging/src/**/*.ts"
  - "packages/identity-context/src/**/*.ts"
  - "packages/cache/src/**/*.ts"
  - "packages/types/src/**/*.ts"
  - "packages/common-services/src/**/*.ts"
  - "packages/ui/src/**/*.tsx"
  - "packages/ui/src/**/*.ts"
---

# Shared Packages Rules (Auto-loaded for packages/ files)

## CRITICAL: Breaking Change Awareness
Changes to shared packages affect ALL 18 services simultaneously. Before modifying any shared package:

1. **Search all usages** across the monorepo before changing any exported interface
2. **Never remove or rename** an exported function/class/type without updating all consumers
3. **Additive changes only** — add new exports, add optional fields. Never remove.
4. **Run `npm run build:packages`** after changes and fix all type errors before committing

```bash
# Always verify no type errors across the monorepo after package changes
npm run build:packages
```

## Package-Specific Rules

### `packages/database` (BaseSchema + BaseRepository)
- `BaseSchema` fields (`orgId`, `projectId`, `createdBy`, `updatedBy`) are sacred — never remove or rename
- `BaseRepository` query methods must ALWAYS require `orgId` + `projectId` — this is the tenant isolation enforcement
- Any new BaseRepository method must be tested against multi-tenant scenarios

### `packages/types` (Shared TypeScript types)
- Types here are imported by both frontend AND backend — keep them framework-agnostic
- No NestJS decorators (`@IsString()`) in shared types — those belong in service DTOs
- No Mongoose types in shared types — use plain TypeScript interfaces
- Export everything from `index.ts`

### `packages/config` (Joi-validated config)
- Validation schemas live here — Joi validators for each service's config shape
- When adding a new env variable to a service, add it to both: the service's config registration AND here if it's shared

### `packages/logger` (Winston)
- The `LoggerService` is a NestJS-injectable wrapper around Winston
- Never change the log format without coordinating with Cloud Logging queries in production
- Log levels: `error` > `warn` > `info` > `http` > `debug`

### `packages/messaging` (Kafka)
- Kafka topic names are defined as constants here — never hardcode topic strings in services
- When adding a new Kafka topic: add to the constants file, document producer and expected consumers
- Message payload types must be defined in `packages/types`

### `packages/identity-context` (Auth)
- `JwtAuthGuard` and `@CurrentUser()` live here — used by every service
- The `User` type extracted from JWT must match what `auth-service` puts in the token
- Any change to the JWT payload shape requires coordinating auth-service + identity-context + every consuming service

### `packages/ui` (Shared React components)
- Components here are used by both `dashboard` and `platform-admin`
- Follow shadcn/ui pattern: Radix UI primitive + CVA variants + Tailwind
- All components must support dark mode (`dark:` Tailwind classes)
- Export component + its props type from `index.ts`

## Build Order
Packages must be built before apps. Always:
```bash
npm run build:packages   # first
npm run build:apps       # then
```

Never import from a package's `src/` directly in an app — always use the compiled output via the package name (`@metafy/database`, not `../../packages/database/src/`).
