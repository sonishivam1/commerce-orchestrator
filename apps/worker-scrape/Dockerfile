FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ packages/
COPY apps/worker-scrape/package.json apps/worker-scrape/
RUN pnpm install --frozen-lockfile --filter @cdo/worker-scrape... --filter @cdo/worker-scrape

FROM deps AS builder
COPY . .
RUN pnpm --filter @cdo/worker-scrape build

FROM node:20-alpine AS runner
# Install Chromium for Playwright scraping
RUN apk add --no-cache chromium
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/worker-scrape/dist ./apps/worker-scrape/dist
COPY --from=builder /app/apps/worker-scrape/package.json ./apps/worker-scrape/

ENV NODE_ENV=production

CMD ["node", "apps/worker-scrape/dist/main.js"]
