---
name: performance
description: Performance optimization skill for Metafy AI Platform. Covers MongoDB query optimization, NestJS response latency, LLM call optimization, Redis usage, Cloud Run cold start mitigation, connection pooling, async patterns, and how to profile and measure before optimizing.
user-invocable: true
---

# Performance Skill — Metafy AI Platform

## Golden Rule: Measure First, Optimize Second

Never optimize based on intuition. Profile first:
1. Find the actual bottleneck (DB query? LLM call? N+1? Cold start?)
2. Measure baseline
3. Apply one change
4. Measure again
5. Only keep changes that show measurable improvement

---

## Database Performance

### 1. Index Coverage (Most Impactful)
```typescript
// Find queries doing collection scans (COLLSCAN) in production
// Add to any service's bootstrap for development profiling:
mongoose.set('debug', (collection, method, query) => {
  if (process.env.LOG_DB_QUERIES === 'true') {
    console.log(`DB: ${collection}.${method}`, JSON.stringify(query));
  }
});

// Check slow queries in MongoDB Atlas:
// Performance Advisor → Suggested Indexes (auto-detected from slow query log)
```

```typescript
// Before adding code optimizations, check index coverage
const explanation = await this.productModel
  .find({ orgId, projectId, status: 'active' })
  .explain('executionStats');

// COLLSCAN = no index used → add compound index
// IXSCAN with totalDocsExamined >> nReturned → index not selective enough
```

### 2. Use .lean() on All Read Queries
```typescript
// Up to 3x faster for reads — returns plain JS, skips Mongoose overhead
const products = await this.productModel.find(filter).lean<Product[]>();
```

### 3. Projection — Fetch Only What You Need
```typescript
// For list views: never fetch all fields
const summaries = await this.productModel
  .find(filter, { name: 1, status: 1, createdAt: 1, _id: 1 })
  .lean();
// Reduces network transfer + memory allocation
```

### 4. Parallelise Independent Queries
```typescript
// SLOW — sequential (200ms + 150ms = 350ms)
const user = await this.userService.findById(userId);
const org = await this.orgService.findById(orgId);

// FAST — parallel (max(200ms, 150ms) = 200ms)
const [user, org] = await Promise.all([
  this.userService.findById(userId),
  this.orgService.findById(orgId),
]);
```

### 5. Aggregation Pipeline Optimization
```typescript
// Always $match first (uses index), always $project last (reduce data early)
pipeline = [
  { $match: { orgId, projectId, status: 'active' } },  // 1st: filter on index
  { $group: { _id: '$category', count: { $sum: 1 } } }, // 2nd: group
  { $sort: { count: -1 } },                              // 3rd: sort
  { $limit: 10 },                                        // 4th: limit
  { $project: { category: '$_id', count: 1, _id: 0 } }, // last: reshape
];
```

---

## API Response Latency

### Target Latencies
| Endpoint Type | P50 target | P95 target |
|--------------|-----------|-----------|
| Simple CRUD (read) | < 50ms | < 150ms |
| Complex query | < 150ms | < 500ms |
| LLM-backed endpoint | < 500ms streaming start | N/A |
| Feed run / batch job | Async — no user wait | N/A |

### Measure with Middleware Timing
```typescript
// Add timing to any endpoint automatically
@UseInterceptors(TimingInterceptor)
@Controller('products')
export class ProductController {}

// TimingInterceptor logs duration of every handler
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const { method, url } = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - start;
        if (durationMs > 500) {
          this.logger.warn(`Slow request: ${method} ${url} took ${durationMs}ms`);
        }
      }),
    );
  }
}
```

---

## LLM Performance

### 1. Stream Responses — Never Block
```typescript
// WRONG — user waits 10-30 seconds for full LLM response
const fullResponse = await anthropic.messages.create({ ... });
return fullResponse.content[0].text;

// CORRECT — stream starts showing in ~500ms
const stream = await anthropic.messages.stream({ ... });
for await (const chunk of stream) {
  res.write(`data: ${chunk.delta?.text}\n\n`);
}
```

### 2. Cache Identical LLM Calls
```typescript
// Content analysis for the same content should never call the LLM twice
const contentHash = sha256(content);
const cached = await this.cache.get(cacheKey.aeoAnalysis(orgId, contentHash));
if (cached) return cached; // saves ~$0.01-0.10 per call + 2-10 seconds
```

### 3. Choose the Right Model
```typescript
// Classification / tagging → Haiku (10x cheaper, 3x faster than Sonnet)
// Reasoning / tool use → Sonnet (default)
// Complex multi-step analysis → Opus (only when needed)

// Wrong: using Opus for simple classification
model: 'claude-opus-4-6'  // $75/M tokens
// Right:
model: 'claude-haiku-4-5-20251001'  // $1.25/M tokens, same quality for simple tasks
```

### 4. Batch LLM Calls
```typescript
// WRONG — N sequential LLM calls for N products
for (const product of products) {
  await this.analyzeProduct(product); // 2s per product × 100 products = 200s
}

// BETTER — parallel batches (respect rate limits)
const BATCH_SIZE = 5; // Anthropic allows ~50 concurrent by default
const batches = chunk(products, BATCH_SIZE);
for (const batch of batches) {
  await Promise.all(batch.map(p => this.analyzeProduct(p)));
}
```

---

## Cloud Run Cold Start Mitigation

Cold starts occur when a new container instance starts. Can take 1-5 seconds.

### 1. Keep Critical Services Warm
```yaml
# services.yaml — set minInstances for latency-critical services
gateway:
  minInstances: 1  # Always warm
auth-service:
  minInstances: 1  # Always warm
product-service:
  minInstances: 0  # Scale to zero (accept cold start for cost savings)
```

### 2. Reduce Image Size (Faster Cold Start)
```dockerfile
# Use alpine — smallest Node image
FROM node:20-alpine

# Remove devDependencies in production stage
RUN npm ci --only=production
```

### 3. Lazy Load Heavy Modules
```typescript
// Don't import Anthropic SDK at module load time if it's rarely used
// Import dynamically where needed
const Anthropic = await import('@anthropic-ai/sdk').then(m => m.default);
```

---

## Connection Pool Sizing

```typescript
// MongoDB — default pool is 5 connections per service
// For high-throughput services (feed, data):
mongoose.connect(uri, {
  maxPoolSize: 20,    // Increase for services with high DB concurrency
  minPoolSize: 5,     // Keep minimum connections warm
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

// Redis — connection pooling via IORedis
const redis = new Redis({
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  // lazyConnect: true — only connect when first command is sent
});
```

---

## Async Job Offloading (BullMQ)

Move slow work off the HTTP request path:

```typescript
// Controller — fast HTTP response
@Post('feeds/:id/run')
async triggerFeedRun(@Param('id') feedId: string, @CurrentUser() user: User) {
  // Queue the job — return immediately
  await this.feedQueue.add('run-feed', { feedId, orgId: user.orgId });
  return { status: 'queued', feedId };
}

// Worker (separate process) — does the heavy lifting
@Processor('feed-jobs')
export class FeedWorker {
  @Process('run-feed')
  async runFeed(job: Job<{ feedId: string; orgId: string }>) {
    // This runs async — can take minutes, doesn't block any user
    await this.feedService.executeRun(job.data.feedId, job.data.orgId);
  }
}
```

**Rule:** Any operation taking > 2 seconds should be async (queue + webhook/SSE for completion notification).

---

## Performance Monitoring Checklist

- [ ] Slow query logging enabled in development (`LOG_DB_QUERIES=true`)
- [ ] Timing interceptor applied to critical controllers
- [ ] P95 latency under target for all user-facing endpoints
- [ ] No N+1 query patterns (check aggregation or batch queries)
- [ ] `.lean()` on all read-only Mongoose queries
- [ ] Parallel `Promise.all()` for independent async operations
- [ ] LLM calls streamed or cached
- [ ] Background jobs offloaded to BullMQ
- [ ] Cache hit rate > 80% for expensive computations
- [ ] Cloud Run minInstances=1 for gateway and auth
