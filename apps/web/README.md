# apps/web

Next.js App Router frontend for the Commerce Data Orchestrator.

## Structure (to be scaffolded)

```
apps/web/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing / dashboard
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── jobs/
│   │   ├── page.tsx        # Job list
│   │   ├── [id]/page.tsx   # Job detail + progress
│   │   └── new/page.tsx    # Create new job
│   ├── credentials/
│   │   └── page.tsx        # Manage platform credentials
│   └── dlq/
│       └── page.tsx        # Dead Letter Queue viewer + replay
├── lib/
│   ├── graphql/
│   │   ├── client.ts       # Apollo Client setup
│   │   ├── queries/
│   │   └── mutations/
│   └── auth/
│       └── session.ts      # JWT handling (httpOnly cookie)
└── components/
    ├── JobCard.tsx
    ├── ProgressBar.tsx
    └── CredentialForm.tsx
```

> Note: GraphQL client is Apollo Client connecting to `apps/api` GraphQL endpoint.
