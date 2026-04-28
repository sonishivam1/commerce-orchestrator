---
name: doc-creator
description: Documentation creation skill for Metafy AI Platform. Encodes standards for service READMEs, API documentation, architecture decision records (ADRs), runbooks, and inline code comments. Invoke when creating or reviewing documentation for any service or feature.
user-invocable: true
---

# Doc Creator Skill — Metafy AI Platform

## Documentation Types & When to Write Each

| Doc Type | When | Location |
|----------|------|----------|
| Service README | When adding/significantly changing a service | `apps/[service]/README.md` |
| ADR (Architecture Decision Record) | When making a non-obvious architectural choice | `docs/adr/` |
| Runbook | For any operational procedure (deploy, rollback, debug) | `docs/runbooks/` |
| API Reference | When adding public-facing endpoints | Swagger (auto) + `docs/api/` |
| Feature Guide | For complex features used by multiple teams | `docs/[feature]/` |

---

## Service README Template

```markdown
# [Service Name]

**Port:** [port]
**Responsibility:** [One sentence — what this service owns]

## What This Service Does
[2-3 sentences explaining the domain, what data it manages, and what other services depend on it]

## Tech Stack
- NestJS 10.x
- MongoDB (collection: [names])
- Kafka topics: produces [list], consumes [list]
- Redis: [yes/no, what for]

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /[resource] | JWT | Create [resource] |
| GET | /[resource] | JWT | List [resources] for org |
| GET | /[resource]/:id | JWT | Get [resource] by ID |
| PUT | /[resource]/:id | JWT | Update [resource] |
| DELETE | /[resource]/:id | JWT | Delete [resource] |

Full Swagger: `http://localhost:[port]/api-docs`

## Kafka Events

### Produces
| Event | When | Consumers |
|-------|------|-----------|
| `[event-name]` | [trigger] | [service list] |

### Consumes
| Event | From | What we do |
|-------|------|-----------|
| `[event-name]` | [service] | [action] |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `KAFKA_BROKER` | Yes | Kafka broker address |
| `JWT_SECRET` | Yes | JWT signing secret |
| `PORT` | No | Service port (default: [port]) |

## Running Locally

```bash
# From repo root
npm run dev  # starts core services including this one

# Or individually
cd apps/[service-name]
cp .env.example .env  # configure env vars
npm run start:dev
```

## Running Tests

```bash
cd apps/[service-name]
npm run test              # unit tests
npm run test:e2e          # e2e tests
npm run test -- --coverage  # with coverage
```

## Common Issues

**Q: Getting 401 on all requests**
A: Check that the JWT_SECRET matches auth-service. They must be identical.

**Q: MongoDB connection failing**
A: Verify MONGODB_URI is set and the IP whitelist in Atlas includes your IP.

**Q: Kafka consumer not receiving events**
A: Check consumer group ID — it must be unique per service. Also verify the topic name matches exactly (case-sensitive).
```

---

## Architecture Decision Record (ADR) Template

```markdown
# ADR-[number]: [Title]

**Date:** [YYYY-MM-DD]
**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-[n]
**Deciders:** [names]

## Context
What situation forced this decision?
What constraints existed (time, team, tech, cost)?

## Decision
What did we decide to do?

## Considered Alternatives

### Option A: [name] (CHOSEN)
- Pros: [list]
- Cons: [list]

### Option B: [name]
- Pros: [list]
- Cons: [list — why this was rejected]

## Consequences

**Positive:**
- [benefit]

**Negative / Trade-offs:**
- [cost or limitation we accepted]

**Risks:**
- [what could go wrong + mitigation]

## References
- [Link to relevant doc, PR, or discussion]
```

---

## Runbook Template

```markdown
# Runbook: [Procedure Name]

**Frequency:** [one-time / on-demand / weekly]
**Estimated time:** [X minutes]
**Who runs this:** [role]
**Prerequisites:** [tools/access needed]

## When to Use This
[Specific situation that triggers this runbook]

## Steps

### 1. [Step Name]
```bash
# Command to run
[command]
```
**Expected output:** [what success looks like]
**If it fails:** [what to check, alternative command]

### 2. [Step Name]
[instruction]

## Verification
How do you know it worked?
```bash
# Verification command
[command]
```

## Rollback
If something went wrong, how do you undo this?
```bash
[rollback command]
```

## Escalation
If this runbook doesn't resolve the issue, contact [role/channel].
```

---

## Inline Code Comment Standards

```typescript
// DO: Comment the WHY, not the WHAT
// BAD — states the obvious
// Increment counter
counter++;

// GOOD — explains non-obvious reasoning
// We increment before checking the limit because the first message
// (which triggered this call) already consumed one iteration.
counter++;

// DO: Document non-obvious business rules
// Org members can view all projects, but only project-assigned members
// can create/modify resources. This check enforces the latter.
if (!user.projectIds.includes(projectId)) {
  throw new ForbiddenException('Not a project member');
}

// DO: Mark TODOs with owner and issue
// TODO(mahaveer, #234): Replace with proper cursor-based pagination
// when collection exceeds 100k docs
const products = await repo.find(filter).skip(skip).limit(limit);

// DO: Explain magic numbers
const MAX_RETRY_DELAY_MS = 30_000; // Cap at 30s — beyond this, manual intervention is faster
```

---

## What NOT to Document

- **Code that's self-explanatory:** `// Create a user` above `createUser(dto)`
- **Git history:** Don't write comments like `// Added by Mahaveer 2024-03-01` — git blame has this
- **Obvious imports:** No comment needed above import blocks
- **TODO without a plan:** `// TODO: Fix this someday` — either fix it now or create a ticket

---

## Documentation Checklist

When adding a new service:
- [ ] `apps/[service]/README.md` created with all sections
- [ ] Swagger `@ApiOperation`, `@ApiResponse`, `@ApiProperty` on all endpoints and DTOs
- [ ] `.env.example` lists all required and optional env vars with descriptions
- [ ] Kafka events documented in README (produces + consumes)
- [ ] ADR written if a non-obvious architectural choice was made
- [ ] Common issues/FAQ section in README (preempt Slack questions)
