---
name: product-manager
description: Product management skill for Metafy AI Platform. Encodes how to write specs, prioritize the backlog, plan sprints, define success metrics, write user stories, create roadmap items, and communicate feature decisions — tailored to the AEO SaaS product and the Metafy team workflow.
user-invocable: true
---

# Product Manager Skill — Metafy AI Platform

## Product Context

**What Metafy sells:** AI Experience Optimization (AEO) — helping brands get cited, recommended, and discovered by AI-powered search (ChatGPT, Perplexity, Google AI, Claude).

**Core value prop:** "When someone asks an AI assistant to recommend [your product category], we make sure your brand comes up."

**Business model:** B2B SaaS subscription (organizations + projects)
**Revenue levers:** Seat expansion, project limits, API usage, agentic commerce transaction fees

---

## Feature Spec Template

```markdown
# Feature: [Name]

**Status:** Draft | In Review | Approved | In Dev | Released
**Owner:** [Name]
**Target Release:** [Quarter/Sprint]
**Stakeholders:** [Engineering lead, Design, Customer Success]

## Problem Statement
What specific user pain are we solving?
What data or evidence (support tickets, interviews, usage analytics) confirms this is real?
What happens if we don't build this?

## Proposed Solution
1-3 sentences. Not the implementation — the user-visible outcome.

## User Stories
| As a... | I want to... | So that... |
|---------|-------------|-----------|
| E-commerce manager | see which queries trigger AI recommendations for my brand | I know where to invest content creation |
| Platform admin | view org-level AEO score trends | I can report ROI to leadership |

## Acceptance Criteria
- [ ] [Specific, testable condition 1]
- [ ] [Specific, testable condition 2]
- [ ] 401 returned for unauthenticated requests
- [ ] Data scoped to authenticated org (tenant isolation)
- [ ] Error states show actionable message (not raw error code)

## Scope
**In scope:**
- [Explicit item]

**Out of scope (next iteration):**
- [Explicit exclusion — prevents scope creep]

## Success Metrics
- Primary: [metric that proves the problem is solved — e.g., "Dashboard visits per org per week increases by 20%"]
- Secondary: [supporting metric]
- Counter-metric: [what we don't want to regress — e.g., "API response latency stays < 200ms"]

## Technical Notes
- Affected services: [list]
- New Kafka events: [list]
- Schema changes: [describe]
- Breaking API changes: [yes/no — if yes, versioning plan]
- Billing implications: [does this change what's metered?]
- Audit trail needed: [yes/no]

## Open Questions
1. [Question + owner + due date]

## Dependencies
- [What must ship first]
- [External dependency — Stripe API version, WorkOS feature]
```

---

## Prioritization Framework (RICE)

```
Score = (Reach × Impact × Confidence) / Effort

Reach:      How many orgs/users affected this quarter? (1-10)
Impact:     Effect on primary metric if it works? (0.25 / 0.5 / 1 / 2 / 3)
Confidence: How sure are we? (50% / 80% / 100%)
Effort:     Person-weeks to build + maintain (1-10)
```

**Metafy priority tiers:**
1. **Revenue-critical** — directly ties to new ARR or expansion
2. **Retention-critical** — prevents churn, fixes pain in core workflow
3. **Growth-enabling** — unlocks a new segment or channel
4. **Technical debt** — slows delivery if not addressed
5. **Nice-to-have** — good idea, low urgency

---

## Sprint Planning Format

```markdown
## Sprint [N] — [Start Date] to [End Date]

### Sprint Goal
One sentence: what would make this sprint a success?

### Committed Work
| Item | Service | Estimate | Owner |
|------|---------|----------|-------|
| [Feature/bug] | product-service | 3d | [Dev] |

### Stretch Goals (only if committed work ships)
- [Item]

### Not in Sprint
- [Explicitly excluded to manage expectations]

### Risks
- [Dependency not ready]
- [Technical unknown]
```

---

## Roadmap Structure

```
Now (this sprint/month):
  - [High-confidence, small scope items]

Next (next 1-2 months):
  - [Prioritized, roughly scoped items]
  - Dependencies identified

Later (3-6 months):
  - [Direction, not commitments]
  - Still being validated
```

**Rule:** Don't put dates on "Later" items. Put quarters on "Next" items. Put sprint numbers on "Now" items.

---

## Stakeholder Update Template

```markdown
## Product Update — [Date]

### Shipped This Week
- ✅ [Feature]: [one-line description of user impact]
- ✅ [Bug fix]: [what was broken, what's fixed]

### In Progress
- 🔄 [Feature] — [% complete, expected ship date]
- 🔄 [Feature] — blocked on [dependency]

### Upcoming (Next 2 Weeks)
- 📋 [Feature]: [brief description]

### Metrics Update
- [Key metric]: [value vs last period] [trend arrow]

### Decisions Needed
- [Decision] by [date] — [context, options, recommendation]
```

---

## Writing Good Acceptance Criteria

**Bad:** "The feature works correctly"
**Good:** "Given a logged-in user, when they navigate to /aeo/analysis, they see a list of their analyses sorted by most recent first, with a loading skeleton shown while data fetches"

**Bad:** "The API is fast"
**Good:** "P95 response time for GET /products is under 200ms with 100 concurrent users"

**Bad:** "It handles errors"
**Good:** "When the LLM provider returns a 429, the user sees 'Analysis temporarily unavailable. Please try again in a moment.' and the error is logged with correlationId"

---

## Metafy-Specific PM Considerations

Every feature spec must answer:
1. **Tenant isolation** — does this work correctly when the same user is a member of multiple orgs?
2. **Billing impact** — does this change what we charge for or what tier gates it?
3. **Audit trail** — does a compliance team need a record of this action?
4. **LLM cost** — if this uses AI, what's the per-org monthly cost at scale?
5. **AEO core metric** — how does this help the user improve their AI search presence?
