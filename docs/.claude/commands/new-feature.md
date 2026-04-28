---
name: new-feature
description: Plan and implement a complete new feature end-to-end — schema, DTOs, repository, service, controller, tests, then lint and commit
argument-hint: "[feature description, e.g. 'add product variants']"
---

Implement this feature: $ARGUMENTS

## Execute these steps autonomously

### Step 1: Clarify Scope (read, don't ask)
Read CLAUDE.md to identify:
- Which service owns this feature
- What existing patterns to follow
- Which shared packages are relevant

If a GitHub issue number is provided, read it:
```bash
gh issue view [number] --json title,body,labels
```

### Step 2: Design (state before implementing)
Write out your plan:
- Service(s) affected
- New endpoints: `[METHOD] /path` with request/response shapes
- Schema changes (new fields or new collection)
- New Kafka events to emit
- Estimated files to create/modify

### Step 3: Read Existing Code in the Target Service
Read the existing controller, service, repository, and module files.
Match their exact patterns. Do not invent new approaches.

### Step 4: Implement — In This Order
1. **Schema** — extend BaseSchema, define fields, add indexes
2. **DTOs** — create/update with class-validator + @ApiProperty
3. **Repository** — extend BaseRepository, add query methods
4. **Service** — business logic, tenant-scoped, use NestJS exceptions
5. **Controller** — HTTP layer only, @UseGuards(JwtAuthGuard), @CurrentUser()
6. **Module** — register all new providers

### Step 5: Verify Checklist
- [ ] All queries include orgId + projectId from @CurrentUser()
- [ ] All DTOs validated with class-validator
- [ ] All DTO fields have @ApiProperty()
- [ ] JwtAuthGuard on new endpoints
- [ ] NestJS Logger used (not console.log)
- [ ] NestJS exceptions used (not raw Error)
- [ ] Module registers new providers
- [ ] Kafka events emitted where appropriate (audit, analytics)

### Step 6: Write Tests
Write at minimum:
- Unit test for the service method (happy path + tenant isolation)
- E2E test for the endpoint (happy path + 401 + 400 validation)

### Step 7: Type Check + Lint
```bash
cd apps/[service] && npm run build 2>&1 | head -30
cd apps/[service] && npm run lint 2>&1 | head -30
```
Fix all errors before committing.

### Step 8: Commit
```bash
git add [specific files]
git commit -m "feat([service]): [short description]

- [what was added]
- [endpoints added]
- [schema changes]

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Step 9: Report
- Files created/modified
- Endpoints added with HTTP method and path
- Schema changes
- Tests written
- Build/lint status
