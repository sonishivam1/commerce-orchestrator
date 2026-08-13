FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ packages/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @cdo/api... --filter @cdo/api

# Build
FROM deps AS builder
COPY . .
RUN pnpm --filter @cdo/api build

# Runtime
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
