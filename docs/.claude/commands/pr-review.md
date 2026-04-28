---
name: pr-review
description: Review a pull request — read the diff, check all changed files, run lint, produce a structured verdict
argument-hint: "[PR number or branch name, e.g. 87 or feature/agentic-checkout]"
---

Review: $ARGUMENTS

## Execute autonomously

### Step 1: Get the PR Diff
If a PR number is given:
```bash
gh pr view $ARGUMENTS --json title,body,files,commits,additions,deletions
gh pr diff $ARGUMENTS
```

If a branch name is given:
```bash
git diff metafy-develop...$ARGUMENTS --name-only
git diff metafy-develop...$ARGUMENTS
```

### Step 2: Read Every Changed File
Do not review from the diff alone — read the full context of each changed file.
Understand what the code did before and what it does now.

### Step 3: Run Lint on Changed Files
```bash
# Identify affected services from changed file paths
cd apps/[affected-service] && npm run lint 2>&1
```

### Step 4: Apply the Full Review Checklist

**Architecture (blocking if violated):**
- [ ] Controller → Service → Repository layer separation
- [ ] No direct Mongoose model queries in services
- [ ] Module dependencies correctly registered

**Security & Tenancy (blocking if violated):**
- [ ] @UseGuards(JwtAuthGuard) on all non-public endpoints
- [ ] orgId/projectId sourced from @CurrentUser(), never @Body()
- [ ] All DB queries scoped to orgId + projectId
- [ ] No hardcoded secrets or API keys
- [ ] DTOs use class-validator (no raw @Body() object)

**Data Integrity:**
- [ ] Schema extends BaseSchema (no manual orgId/projectId)
- [ ] Repository extends BaseRepository
- [ ] New query patterns have indexes planned

**Code Quality:**
- [ ] No console.log (NestJS Logger only)
- [ ] No `any` types
- [ ] NestJS exceptions (not raw Error throws)
- [ ] Swagger @ApiProperty on DTO fields

**Frontend (if applicable):**
- [ ] No unnecessary 'use client' directives
- [ ] SWR for server state (not useState + useEffect)
- [ ] API calls through src/lib/api.ts

**Tests:**
- [ ] New business logic has tests
- [ ] New endpoints have e2e tests
- [ ] Tenant isolation tested

### Step 5: Produce Structured Verdict

```
## Code Review — [PR title / branch]

**Changed:** X files, +Y lines, -Z lines
**Services affected:** [list]

### Blocking Issues 🔴
(must fix before merge — list each with file:line)

### Warnings 🟡
(should fix — list each with file:line)

### Suggestions 🟢
(optional — list each)

### Lint Result
[PASS / FAIL with details]

### Verdict
[ ] APPROVE
[ ] APPROVE WITH COMMENTS
[ ] REQUEST CHANGES
```
