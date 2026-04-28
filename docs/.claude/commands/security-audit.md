---
name: security-audit
description: Run a security audit on a service, feature, or set of files in the Metafy AI Platform
argument-hint: "[service name or file path, e.g. 'agent-commerce-service']"
---

Perform a security audit on: $ARGUMENTS

## Audit Process

1. **Read all relevant files** — do not audit what you haven't read

2. **Check tenant isolation** (CRITICAL — highest priority):
   - All DB queries scoped with orgId + projectId?
   - orgId/projectId sourced from JWT (`@CurrentUser()`), not request body?
   - No raw Mongoose queries that bypass BaseRepository?

3. **Check authentication**:
   - `@UseGuards(JwtAuthGuard)` on all non-public endpoints?
   - Admin-only endpoints have role check?
   - JWT expiry reasonable (not infinite)?

4. **Check input validation**:
   - All `@Body()` parameters use typed DTOs with class-validator?
   - No `JSON.parse(userInput)` fed directly to MongoDB queries?
   - No user-controlled data in Mongoose `$where` or aggregation stages?

5. **Check secrets**:
   - No hardcoded API keys, tokens, passwords?
   - Sensitive env vars reference Secret Manager in production?
   - Passwords hashed with Argon2?
   - Tokens not logged?

6. **Check LLM security** (if reviewing agent-commerce-service):
   - User input sanitized before inclusion in prompts?
   - System prompt not user-controllable?
   - Tool calls validated before execution?
   - Per-session spending/action limits enforced?
   - Agent actions logged to audit-service?

7. **Check API surface**:
   - CORS configured with explicit origins (not `*`)?
   - Rate limiting on auth and sensitive endpoints?
   - Helmet configured?
   - Error messages generic (not exposing internals)?

8. **Produce the audit report**:
   - CRITICAL findings (block deployment)
   - HIGH findings (fix before next release)
   - MEDIUM findings (fix within sprint)
   - LOW findings (tech debt)
   - Verified secure areas
