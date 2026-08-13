# Security Rules

- Never log or expose credentials, API keys, or JWT secrets.
- Credentials are AES-256-GCM encrypted at rest in MongoDB. They are only decrypted in worker execution memory.
- Never commit `.env`, `.env.local`, or `*.pem` files.
- Never use `process.env` in `packages/` — only `apps/` may read environment variables. Packages receive config via explicit injection.
- All GraphQL resolvers (except login/register) must be behind `GqlAuthGuard`.
- Distributed locking (Redlock) must be acquired before any destructive target operations. Key format: `lock:{tenantId}:{targetCredentialId}`.
- Rate limiting: max 100 requests/min per tenant via Redis (when implemented).
- Never expose internal error details or stack traces in API responses.
