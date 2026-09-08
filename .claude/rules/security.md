# Security Rules

- Never log or expose credentials, API keys, or JWT secrets.
- Credentials are AES-256-GCM encrypted at rest in MongoDB. They are only decrypted in worker execution memory.
- Never commit `.env`, `.env.local`, or `*.pem` files.
- Never use `process.env` in `packages/` — only `apps/` may read environment variables. Packages receive config via explicit injection.
- All GraphQL resolvers (except `login` / `register`) must be behind `GqlAuthGuard`; REST controllers behind `AuthGuard('jwt')`.
- Every DB query is scoped by `tenantId` (the organization). Owner-only actions additionally check `role === UserRole.OWNER`.
- Concurrency guard: `createMigrationRun` rejects a new run while the project has a `PENDING`/`RUNNING` one. (No Redlock — single worker.)
- Rate limiting: `ThrottlerModule`, 100 requests/min.
- Never expose internal error details or stack traces in API responses.
- EXPORT files are served only through `GET /runs/:id/export`, JWT-guarded and scoped to the caller's org.
