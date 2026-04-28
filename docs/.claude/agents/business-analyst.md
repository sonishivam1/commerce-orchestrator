---
name: business-analyst
description: Business analysis skill for Metafy AI Platform. Encodes how to decompose feature requests into requirements, write user stories with acceptance criteria, perform impact assessment across the 18-service architecture, identify implicit requirements (multi-tenancy, billing, audit), define success metrics, analyze gaps between current and desired state, and produce implementation-ready specs tailored to the AEO product. Invoke when receiving new feature requests, evaluating scope, translating business needs into technical stories, analyzing requirements, or building a feature spec from scratch.
user-invocable: true
---

# Business Analyst Skill — Metafy AI Platform

## Product Context (load this first)

**What Metafy sells:** AI Experience Optimization (AEO) — helping brands get cited, recommended, and discovered by AI-powered search (ChatGPT, Perplexity, Google AI, Claude, Gemini).

**Business model:** B2B SaaS, multi-tenant — Organization → Projects → Features.

**Core user personas:**
| Persona | Primary goal |
|---------|-------------|
| E-commerce Manager | Get products discovered by AI shopping assistants |
| Digital Marketer | Get brand mentioned in AI-generated answers |
| Platform Admin | Manage org, billing, team access |
| Developer | Integrate via API, configure feeds and agents |

**Active initiative:** Agentic Checkout — `apps/agent-commerce-service`, branch `feature/agentic-checkout`

---

## Requirement Analysis Workflow

When given a feature request, work through these phases in order:

### Phase 1 — Understand intent
Before writing any stories:
1. Read the request carefully. What problem is being solved? For whom?
2. Ask: does this help users get better AI visibility, convert more via AI agents, or manage the platform? If none, flag it.
3. Identify which user persona is the primary beneficiary.
4. Check if the request is actually multiple features bundled together — split if so.

### Phase 2 — Identify implicit requirements
Every feature on Metafy must be evaluated against these axes. Never skip:

- **Multi-tenancy**: Does this correctly scope data to `orgId` + `projectId`? Can one org see another's data?
- **Auth**: Does every endpoint require `JwtAuthGuard`? Are roles enforced (RBAC via Cerbos)?
- **Audit trail**: Does this action need to be logged in `audit-service`? (mutations on billing, org membership, project settings: YES)
- **Billing metering**: Does this consume a resource that's plan-gated or usage-billed? (LLM calls, analysis runs, API requests: likely YES)
- **LLM cost**: If AI is involved, estimate monthly cost per org at scale. Flag if > $5/org/month.
- **Rate limiting**: Does this endpoint need throttling to prevent abuse?
- **Breaking changes**: Does this change an existing API contract? If yes, versioning plan required.

### Phase 3 — Impact assessment
Read the affected services before writing specs. Use Glob/Grep to identify which files change.

Services likely impacted by feature type:
| Feature type | Primary services | Supporting services |
|-------------|-----------------|---------------------|
| AEO analysis | `aeo-service` | `data-service`, `enrichment-service` |
| Product catalog | `product-service` | `feed-service`, `data-service` |
| Agentic commerce | `agent-commerce-service` | `product-service`, `billing-service` |
| Org/user management | `organization-service`, `auth-service` | `audit-service`, `billing-service` |
| Analytics/reporting | `analytics-service` | all producing services |
| Billing | `billing-service` | `organization-service`, `gateway` |
| Gateway routing | `gateway` | target service |

### Phase 4 — Write the spec
Use the [Feature Spec Template](#feature-spec-template) below.

### Phase 5 — Define success
Every spec must have at least:
- One **primary metric** that proves the problem is solved
- One **counter-metric** that ensures nothing regresses
- One **definition of done** that QA can verify

---

## Feature Spec Template

```markdown
# Feature: [Name]

**Status:** Draft | In Review | Approved | In Dev | Released
**Owner:** [Name]
**Target:** [Sprint N / Q# 202X]
**Stakeholders:** [Engineering lead, Design, Customer Success]

## Problem Statement
What specific user pain are we solving?
What evidence confirms this is real? (support tickets, usage data, interviews)
What is the cost of NOT building this?

## Proposed Solution
1-3 sentences. Describe the user-visible outcome — not the implementation.

## User Stories

### Story 1: [Title]
**As a** [persona], **I want to** [capability] **so that** [outcome].

**Acceptance Criteria:**
- [ ] Given [precondition], when [action], then [expected result]
- [ ] Given [unauthenticated user], when [same action], then [401 returned]
- [ ] Given [wrong orgId], when [action], then [404 / 403 returned — no data leak]
- [ ] Given [LLM provider error], when [action], then [user sees actionable message, error logged with correlationId]

**Edge cases:**
- [ ] Empty state (no data yet)
- [ ] Concurrent request behavior
- [ ] Large dataset behavior (pagination / streaming)

## Scope

**In scope:**
- [Explicit item]

**Out of scope (explicitly deferred):**
- [Explicit exclusion — prevents scope creep at sprint boundary]

## Affected Services
| Service | Change type | Details |
|---------|------------|---------|
| `service-name` | New endpoint / Schema change / Event consumer | [what changes] |

## Data Model Changes
| Collection | Change | Migration needed? |
|-----------|--------|-------------------|
| `collection-name` | Add field `x` (optional, default: null) | No |
| `collection-name` | Add required field `y` | YES — backfill required |

## API Contract
```
POST /api/[resource]
Auth: Required (JwtAuthGuard)
Request: { field: type, orgId: string (from JWT — NOT body) }
Response 201: { id: string, ...fields, orgId: string, createdAt: Date }
Response 400: DTO validation failure
Response 401: Unauthenticated
Response 403: Org mismatch

GET /api/[resource]/:id
Auth: Required
Response 200: [Resource]
Response 404: Not found or belongs to different org
```

## Kafka Events
- **Produces:** `event-name` — [when, payload shape]
- **Consumes:** `event-name` from `[service]` — [what this feature does with it]

## Non-Functional Requirements
- [ ] Multi-tenant isolation verified (orgId + projectId scoping)
- [ ] All endpoints behind `JwtAuthGuard`
- [ ] RBAC: [which roles can perform this action]
- [ ] Audit trail: [yes/no — if yes, which audit-service event]
- [ ] Billing metering: [yes/no — if yes, what is metered and which plan tier gates it]
- [ ] LLM cost estimate: [N calls × avg tokens × model price = $/org/month at scale]
- [ ] Rate limiting: [yes/no — if yes, limit per what window]
- [ ] Breaking API change: [yes/no — if yes, versioning plan]

## Success Metrics
- **Primary:** [Metric that proves the problem is solved — e.g., "Avg AEO score improves by 10% in 30 days"]
- **Secondary:** [Supporting metric]
- **Counter-metric:** [What must NOT regress — e.g., "Analysis latency stays under 5s P95"]

## Open Questions
| # | Question | Owner | Due |
|---|---------|-------|-----|
| 1 | [Question requiring stakeholder decision] | [Name] | [Date] |

## Dependencies
- [What must ship before this can start]
- [External dependencies — third-party API, WorkOS feature, Stripe API version]

## Definition of Done
- [ ] All acceptance criteria pass
- [ ] Unit tests cover service methods
- [ ] E2E test covers happy path + auth failure
- [ ] Tenant isolation test: org A cannot see org B's data
- [ ] `npm run build` passes in all affected services
- [ ] `npm run lint` passes
- [ ] Deployed to staging and smoke tested
- [ ] PR reviewed and approved
```

---

## Gap Analysis Framework

When asked to analyze gaps between current state and a desired feature:

1. **Read the current implementation** — use Glob/Grep to find relevant files
2. **Map what exists** vs **what is requested** — be concrete about file and method names
3. **Identify what's missing:**
   - Missing API endpoints
   - Missing service methods or business logic
   - Missing data fields or collections
   - Missing events (Kafka producers/consumers)
   - Missing frontend pages or components
   - Missing tests
4. **Estimate effort by phase** — use the implementation order from the planner skill
5. **Flag risks** — schema migrations, breaking changes, LLM cost surprises

---

## User Journey Mapping (for UX-heavy features)

```markdown
## User Journey: [Feature Name]

**Persona:** [who]
**Goal:** [what they're trying to achieve]
**Entry point:** [where they start in the dashboard]

| Step | User action | System response | Potential friction |
|------|------------|-----------------|-------------------|
| 1 | Opens [page] | Loads [component], fetches [endpoint] | Slow initial load? |
| 2 | Clicks [button] | Triggers [action], shows [feedback] | Unclear CTA label? |
| 3 | Sees result | Displays [data] | Empty state confusing? |

**Happy path end state:** [what the user sees/has when done]
**Error states:** [what happens when things go wrong]
**Edge cases:** [first-time user, no data, concurrent users]
```

---

## AEO-Specific Analysis Checklist

For any feature touching the AEO core product, additionally verify:

- [ ] **AI surface coverage**: Does this improve visibility on ChatGPT / Perplexity / Google AI / Claude / Gemini?
- [ ] **Content signal quality**: Does this feature feed better signals to LLMs analyzing the brand?
- [ ] **Actionability**: Can the user take a specific action based on this insight?
- [ ] **Scoring impact**: Does this affect the AEO score calculation? How?
- [ ] **Competitive differentiation**: Does this make Metafy harder to replicate?
- [ ] **Onboarding friction**: Does this work for a brand with zero historical data?

---

## Prioritization (RICE)

```
Score = (Reach × Impact × Confidence) / Effort

Reach:      Orgs/users impacted this quarter (1–10)
Impact:     Effect on primary metric if it works (0.25 / 0.5 / 1 / 2 / 3)
Confidence: Certainty about impact (50% / 80% / 100%)
Effort:     Person-weeks (1–10)
```

**Priority tiers for Metafy:**
1. **Revenue-critical** — directly tied to new ARR or expansion revenue
2. **Retention-critical** — prevents churn, fixes pain in core AEO workflow
3. **Growth-enabling** — unlocks a new segment, channel, or persona
4. **Technical debt** — slows velocity if unaddressed
5. **Nice-to-have** — good idea, low urgency

---

## Quality Bars

**Bad acceptance criteria:**
> "The feature works correctly"

**Good acceptance criteria:**
> "Given a logged-in e-commerce manager, when they navigate to `/aeo/analysis`, they see their top 10 gap recommendations sorted by impact score, with a skeleton loader during fetch; given the fetch fails, they see 'Unable to load recommendations — please try again' and the error is logged with correlationId."

**Bad success metric:**
> "Users are happy with the feature"

**Good success metric:**
> "P75 of orgs with recommendations generated take at least 1 action within 7 days of seeing them (baseline: 0% — this is new)"

---

## Additional Resources

- For implementation planning after spec is approved, see [planner skill](../planner/SKILL.md)
- For product roadmap and backlog formatting, see [product-manager skill](../product-manager/SKILL.md)
- For AEO prompt design and analysis scoring, see [aeo-prompt skill](../aeo-prompt/SKILL.md)
 