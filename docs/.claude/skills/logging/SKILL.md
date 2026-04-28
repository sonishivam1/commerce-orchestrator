---
name: logging
description: Logging skill for Metafy AI Platform. Encodes Winston logger usage, structured log format, log levels, correlation ID propagation, what to log and what not to log, Cloud Logging integration, and how to query logs in production.
user-invocable: true
---

# Logging Skill — Metafy AI Platform

## Logger Setup — Always Use NestJS Logger

```typescript
// In any service class — inject per-class for context
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);
  // Logger.name automatically becomes 'ProductService' — shows in logs
}
```

**Never use `console.log`** — it bypasses Winston formatting and loses structured context.

---

## Log Levels — When to Use Each

| Level | Method | When |
|-------|--------|------|
| ERROR | `this.logger.error(msg, stack)` | Unhandled exceptions, data loss risk, external service failures |
| WARN | `this.logger.warn(msg)` | Unexpected but handled: deprecated usage, retries, rate limit approaching |
| LOG | `this.logger.log(msg)` | Important lifecycle events: service started, job completed, user action |
| DEBUG | `this.logger.debug(msg)` | Detailed flow tracking: entering/exiting key methods, query params |
| VERBOSE | `this.logger.verbose(msg)` | Very noisy detail: loop iterations, cache hits, raw payloads |

**Production:** LOG and above
**Staging:** DEBUG and above
**Development:** VERBOSE and above

---

## Structured Logging Pattern

Always include context in logs. Use object form for structured fields:

```typescript
// CORRECT — structured, queryable in Cloud Logging
this.logger.debug('Product created', {
  productId: product.id,
  orgId: product.orgId,
  projectId: product.projectId,
  correlationId,
  durationMs: Date.now() - startTime,
});

// WRONG — flat string, hard to filter in production
this.logger.log(`Product ${product.id} created for org ${product.orgId}`);
```

---

## What to Log

### Always Log
```typescript
// Service startup
this.logger.log(`ProductService initialized`);

// Significant user actions (not every read, just writes/deletes)
this.logger.log('Product created', { productId, orgId, triggeredBy: user.id });
this.logger.log('Product deleted', { productId, orgId, triggeredBy: user.id });

// External service calls (start + result)
this.logger.debug('Calling enrichment-service', { productId, endpoint });
this.logger.debug('Enrichment response received', { productId, durationMs });

// Kafka events emitted
this.logger.debug('Emitted Kafka event', { topic: 'product-created', productId });

// Background job start/complete/fail
this.logger.log('Feed run started', { feedId, orgId });
this.logger.log('Feed run completed', { feedId, orgId, productsProcessed: 342, durationMs });

// LLM calls (without the prompt content)
this.logger.debug('LLM call started', { model, orgId, sessionId });
this.logger.debug('LLM call completed', { model, inputTokens, outputTokens, durationMs });
```

### Never Log
```typescript
// NEVER — sensitive data
this.logger.log(`User password: ${password}`);
this.logger.log(`API key: ${apiKey}`);
this.logger.log(`JWT token: ${token}`);
this.logger.log(`Stripe webhook: ${JSON.stringify(payload)}`); // may contain card data

// NEVER — full request body (may contain PII)
this.logger.debug(`Request body: ${JSON.stringify(req.body)}`);

// NEVER — full LLM prompt (may contain user PII)
this.logger.debug(`Prompt: ${systemPrompt + userMessage}`);

// NEVER — full MongoDB documents (may be large + contain sensitive fields)
this.logger.debug(`User: ${JSON.stringify(userDocument)}`);
```

---

## Correlation ID — Trace Requests Across Services

Every log entry in a request context should include `correlationId`:

```typescript
// Extract from request context
import { RequestContextService } from '@metafy/request-context';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(private readonly requestContext: RequestContextService) {}

  async create(dto: CreateProductDto, user: User) {
    const correlationId = this.requestContext.get('correlationId');

    this.logger.debug('Creating product', {
      correlationId,
      orgId: user.orgId,
      name: dto.name,
    });

    const product = await this.productRepository.create({ ...dto, ...tenantFields });

    this.logger.log('Product created', {
      correlationId,
      productId: product.id,
      orgId: product.orgId,
    });

    return product;
  }
}
```

---

## Error Logging Pattern

```typescript
// Always log error with stack trace
try {
  await this.kafkaService.emit('product-created', event);
} catch (error) {
  this.logger.error(
    'Failed to emit product-created event',
    error instanceof Error ? error.stack : String(error),
    { productId: product.id, orgId: product.orgId, correlationId },
  );
  // Don't re-throw — Kafka failure is non-blocking
}

// NestJS exception filter (global) already logs 5xx errors
// Don't double-log exceptions that the framework handles
```

---

## Winston Configuration (packages/logger)

```typescript
// packages/logger/src/logger.config.ts
const winstonConfig = {
  transports: [
    // Console — structured JSON in production, pretty in dev
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
    }),
    // File — daily rotation in non-production
    ...(process.env.NODE_ENV !== 'production' ? [
      new DailyRotateFile({
        filename: 'logs/%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '7d',
        format: winston.format.json(),
      }),
    ] : []),
  ],
};
```

In production (Cloud Run), all logs go to stdout → Cloud Logging automatically.

---

## Querying Logs in Production (Cloud Logging)

```bash
# All errors in product-service in the last hour
gcloud logging read \
  'resource.labels.service_name="product-service" severity>=ERROR' \
  --limit=50 --format=json

# Trace a specific correlation ID across all services
gcloud logging read \
  'jsonPayload.correlationId="abc-123-def"' \
  --limit=100

# All logs for a specific org (useful for support)
gcloud logging read \
  'jsonPayload.orgId="org-xyz"' \
  --limit=100 --freshness=1h

# Count errors per service in the last 24h
gcloud logging read \
  'severity=ERROR' --freshness=24h \
  --format="value(resource.labels.service_name)" | sort | uniq -c | sort -rn
```

---

## Performance Logging (Timing)

```typescript
// Measure duration of critical operations
async processLargeDataset(feedId: string, orgId: string) {
  const startTime = Date.now();
  this.logger.debug('Starting feed processing', { feedId, orgId });

  try {
    const result = await this.doWork(feedId, orgId);
    const durationMs = Date.now() - startTime;

    this.logger.log('Feed processing completed', {
      feedId, orgId,
      productsProcessed: result.count,
      durationMs,
      // Flag slow operations for investigation
      slow: durationMs > 5000,
    });

    return result;
  } catch (error) {
    this.logger.error('Feed processing failed', error.stack, {
      feedId, orgId,
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}
```

---

## Log Hygiene Checklist

- [ ] NestJS `Logger` used (not `console.log`)
- [ ] Logger name = class name (`new Logger(MyService.name)`)
- [ ] `correlationId` included in all request-scoped logs
- [ ] `orgId` included in all tenant-scoped logs
- [ ] No passwords, tokens, API keys, or PII in logs
- [ ] Errors logged with `.stack` (full stack trace)
- [ ] Durations logged for external calls and batch jobs
- [ ] Log level appropriate (debug for flow, log for events, error for failures)
