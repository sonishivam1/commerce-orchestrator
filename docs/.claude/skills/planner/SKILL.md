---
name: planner
description: Implementation planning skill for Metafy AI Platform. Use before starting any significant feature or refactor. Produces a step-by-step implementation plan with file list, dependencies, risks, and implementation order — so the team aligns before writing a line of code.
user-invocable: true
---

# Planner Skill — Metafy AI Platform

## When to Use This Skill

Before implementing any feature that:
- Touches more than one service
- Requires schema changes
- Changes an existing API contract
- Takes more than 1 day to implement
- Has unclear dependencies

Don't plan one-line bug fixes. Plan anything that needs coordination.

---

## Implementation Plan Template

```markdown
# Implementation Plan: [Feature Name]

**Date:** [today]
**Branch:** feature/[kebab-name]
**Estimated effort:** [days/sprints]
**Services affected:** [list]

## Context
[1-2 sentences: what problem are we solving and why now]

## Approach
[2-3 sentences: the architectural decision and why]

## Implementation Order

### Phase 1: Foundation (must ship together)
1. [ ] `packages/types/src/` — Add shared type definitions
       Files: `[domain].types.ts`
       Why first: All other phases depend on these types

2. [ ] `apps/[service]/src/[domain]/schemas/[domain].schema.ts`
       Add: [new fields]
       Index changes: [list new indexes]
       Risk: Schema changes require migration if field is required

3. [ ] `apps/[service]/src/[domain]/[domain].repository.ts`
       Add methods: [list]

### Phase 2: Business Logic
4. [ ] `apps/[service]/src/[domain]/[domain].service.ts`
       Add methods: [list]
       Dependencies: Phase 1 must be complete

5. [ ] `apps/[service]/src/[domain]/dto/[action].dto.ts`
       New DTOs: [list]

### Phase 3: API Surface
6. [ ] `apps/[service]/src/[domain]/[domain].controller.ts`
       New endpoints: [METHOD /path]
       Auth: JwtAuthGuard ✓

### Phase 4: Events & Integration
7. [ ] Kafka event: `[event-name]`
       Producer: [service]
       Consumers: [list services + what they do]

8. [ ] Update consuming services to handle new event

### Phase 5: Frontend (if applicable)
9. [ ] `apps/dashboard/src/app/dashboard/[feature]/page.tsx`
10. [ ] New Zustand store or SWR key if needed

### Phase 6: Tests
11. [ ] Unit tests for service methods
12. [ ] E2E tests for new endpoints
13. [ ] Tenant isolation test

### Phase 7: Documentation
14. [ ] Update service README
15. [ ] Update CLAUDE.md if new service or major pattern change

## File Inventory

### New Files
| File | Purpose |
|------|---------|
| `path/to/file.ts` | [what it does] |

### Modified Files
| File | What Changes |
|------|-------------|
| `path/to/file.ts` | Add [method/field] |

## API Contract (new/changed endpoints)

```
POST /[resource]
Request: { field: type }
Response: { id: string, field: type, orgId: string }
Auth: Required

GET /[resource]/:id
Response: [Resource]
Auth: Required
Errors: 404 if not found or wrong org
```

## Database Changes

### New indexes
```typescript
Schema.index({ orgId: 1, projectId: 1, [field]: 1 });
```

### Migration needed?
[ ] No — all new fields are optional with defaults
[ ] Yes — required field addition needs backfill

## Breaking Changes

[ ] No breaking changes — additive only
[ ] Breaking: [endpoint/schema] changes in this way → [migration plan]

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Kafka consumer lag during rollout | Low | Medium | Deploy producer after consumers are live |
| Schema migration downtime | Medium | High | Use optional field + backfill pattern |
| LLM cost higher than expected | Medium | Low | Add usage cap + alert at 80% threshold |

## Rollout Plan

1. Deploy shared packages build
2. Deploy consuming services (they handle missing events gracefully)
3. Deploy producing service
4. Run migration script (if needed) against staging
5. Verify on staging
6. Run migration against production
7. Monitor for 24h

## Definition of Done

- [ ] All endpoints return correct responses
- [ ] All DTOs validated
- [ ] Multi-tenant isolation verified
- [ ] Unit + e2e tests pass
- [ ] `npm run build` passes across affected services
- [ ] `npm run lint` passes
- [ ] Deployed to staging and smoke tested
- [ ] PR reviewed and approved
```

---

## Planning Anti-Patterns to Avoid

**Don't plan without reading the code.** Always read the target service before estimating.

**Don't plan one giant phase.** Break into independently shippable phases. If phase 1 can go to prod alone, it should.

**Don't leave schema changes for last.** Schema changes (especially required fields) are the highest risk. Plan and test them first.

**Don't assume Kafka is instant.** Plan for eventual consistency — consumers may process events seconds or minutes after production.

**Don't forget the gateway.** If adding a route to a new service, the gateway needs a change too.
