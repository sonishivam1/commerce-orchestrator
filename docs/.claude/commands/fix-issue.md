---
name: fix-issue
description: Read a GitHub issue, find the relevant files, implement the fix, run type-check and lint, then commit — all in one go
argument-hint: "[GitHub issue number, e.g. 42]"
---

Fix GitHub issue: $ARGUMENTS

## Execute these steps autonomously — do not stop to ask unless truly blocked

### Step 1: Read the Issue
```bash
gh issue view $ARGUMENTS --json title,body,labels,comments
```
Understand exactly what is broken and what the expected behavior should be.

### Step 2: Identify Affected Service(s)
Based on the issue description, determine which service(s) are involved.
Refer to the service map in CLAUDE.md.

### Step 3: Find the Relevant Files
Search for the relevant controller, service, repository, and schema files.
Read them. Do not guess — understand the existing code before changing anything.

Common search patterns:
```bash
# Find by keyword in the issue
grep -r "keyword" apps/[service]/src/ --include="*.ts" -l

# Find controller handling a specific route
grep -r "@Get\|@Post\|@Put\|@Delete" apps/[service]/src/ --include="*.ts" -l
```

### Step 4: Diagnose Root Cause
Trace the code path. State clearly:
- What the bug is
- Where in the code it originates
- Why it produces the wrong behavior

### Step 5: Implement the Fix
Make the minimal, surgical change needed. Follow all rules:
- Multi-tenancy rules (orgId/projectId from @CurrentUser())
- Layer separation (controller → service → repository)
- Use NestJS exceptions, not raw Error
- No console.log — use NestJS Logger
- Match the existing code style exactly

### Step 6: Run Type Check
```bash
cd apps/[affected-service] && npm run build 2>&1 | head -50
```
Fix any TypeScript errors before proceeding.

### Step 7: Run Lint
```bash
cd apps/[affected-service] && npm run lint 2>&1 | head -50
```
Fix any lint errors before proceeding.

### Step 8: Run Existing Tests
```bash
cd apps/[affected-service] && npm run test 2>&1 | tail -20
```
Verify no existing tests are broken.

### Step 9: Add a Regression Test
Add a test that would have caught this bug. Place it in the appropriate `.spec.ts` file.

### Step 10: Commit
```bash
git add [specific files changed]
git commit -m "fix: [concise description of what was fixed]

Fixes #$ARGUMENTS

- [specific change 1]
- [specific change 2]

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Step 11: Report
Summarize:
- Root cause found
- Files changed
- Fix applied
- Test added
- Build and lint status
