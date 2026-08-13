---
description: Generate a concise git commit message from staged changes following conventional commits
---

## Staged Changes
!`git diff --cached --stat`

## Diff Details
!`git diff --cached`

Generate a conventional commit message for the staged changes. Format:

```
<type>(<scope>): <short description>

<optional body with key details>
```

**Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`
**Scopes**: `core`, `mapping`, `connectors`, `ingestion`, `db`, `queue`, `auth`, `api`, `worker-etl`, `worker-scrape`, `web`, `ui`, `gql`, `shared`, `infra`

Rules:
- Subject line max 72 characters.
- Body explains WHY, not WHAT (the diff shows what).
- Reference the affected package or app as scope.
- If multiple packages are affected, use the most important one as scope.

Output ONLY the commit message, nothing else.
