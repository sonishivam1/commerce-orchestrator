---
description: Run a comprehensive security audit on staged or recent changes
---

## Staged Changes
!`git diff --cached --name-only 2>/dev/null || git diff --name-only HEAD~3...HEAD`

## Security Scan

### 1. Tenant Isolation — Unscoped Queries
!`grep -rn "\.find({})\|\.findOne({})\|\.findAll()" packages/db/ apps/ --include="*.ts" --exclude-dir=node_modules 2>/dev/null | head -10 || echo "✅ No unscoped queries found"`

### 2. Credential Exposure — Secrets in Logs
!`grep -rn "console\.\(log\|debug\).*credential\|console\.\(log\|debug\).*password\|console\.\(log\|debug\).*apiKey\|console\.\(log\|debug\).*secret" packages/ apps/ --include="*.ts" --exclude-dir=node_modules 2>/dev/null | head -10 || echo "✅ No credential logging found"`

### 3. Auth Bypass — Missing Guards
!`grep -rn "@Resolver\|@Controller" apps/api/src/ --include="*.ts" -l 2>/dev/null`
Check each file above for `@UseGuards(GqlAuthGuard)`.

### 4. process.env in Packages
!`grep -rn "process\.env" packages/ --include="*.ts" --exclude-dir=node_modules 2>/dev/null | head -10 || echo "✅ No process.env in packages"`

### 5. Hardcoded Secrets
!`grep -rn "apiKey.*=.*['\"]sk_\|secret.*=.*['\"]" packages/ apps/ --include="*.ts" --exclude-dir=node_modules 2>/dev/null | head -5 || echo "✅ No hardcoded secrets found"`

Classify findings as CRITICAL / HIGH / MEDIUM / LOW.
