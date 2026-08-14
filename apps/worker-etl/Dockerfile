FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ packages/
COPY apps/worker-etl/package.json apps/worker-etl/
RUN pnpm install --frozen-lockfile --filter @cdo/worker-etl... --filter @cdo/worker-etl

FROM deps AS builder
COPY . .
RUN pnpm --filter @cdo/worker-etl build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/worker-etl/dist ./apps/worker-etl/dist
COPY --from=builder /app/apps/worker-etl/package.json ./apps/worker-etl/

ENV NODE_ENV=production

CMD ["node", "apps/worker-etl/dist/main.js"]
