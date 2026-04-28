---
name: cache
description: Caching skill for Metafy AI Platform. Encodes Redis caching patterns using packages/cache, cache key conventions, TTL strategy, cache invalidation, multi-tenant cache isolation, and when to use cache vs when not to.
user-invocable: true
---

# Cache Skill — Metafy AI Platform

## Cache Stack
- **Primary:** Redis via IORedis 5.x (`packages/cache`)
- **In-Process:** `node-cache` for very-short-lived, per-instance data (config values, feature flags)
- **HTTP Response Cache:** NestJS `CacheInterceptor` for GET endpoints

---

## When to Cache

| Cache it | Don't cache it |
|----------|----------------|
| Expensive aggregation queries (analytics) | Individual product reads (cheap) |
| LLM responses for identical prompts | Anything with user PII |
| External API responses (enrichment, competitor data) | Authentication state (always fresh) |
| Computed metrics (dashboard stats) | Write operations |
| Configuration/feature flags | Data that must be real-time |
| Feed catalog counts | Audit log queries |

**Rule of thumb:** Cache when the computation cost > cache management cost AND staleness is acceptable.

---

## Cache Key Convention

**Format:** `[service]:[tenant]:[entity]:[identifier]:[variant]`

```typescript
// Key builder utility
export const cacheKey = {
  // Product catalog
  product: (orgId: string, projectId: string, productId: string) =>
    `product-service:${orgId}:${projectId}:product:${productId}`,

  // Product list (with optional filter hash)
  productList: (orgId: string, projectId: string, filterHash?: string) =>
    `product-service:${orgId}:${projectId}:products:${filterHash ?? 'all'}`,

  // Dashboard stats (tenant-wide)
  dashboardStats: (orgId: string, projectId: string) =>
    `analytics-service:${orgId}:${projectId}:dashboard-stats`,

  // AEO analysis result (content-based)
  aeoAnalysis: (orgId: string, contentHash: string) =>
    `aeo-service:${orgId}:aeo-analysis:${contentHash}`,

  // Competitor data (org-level, refreshed daily)
  competitorData: (orgId: string, competitorId: string) =>
    `competitor-service:${orgId}:competitor:${competitorId}`,

  // User session (cross-service)
  userSession: (userId: string) =>
    `auth-service:session:${userId}`,
};
```

**Critical rule:** Every cache key MUST include `orgId`. Never share cache entries across tenants.

---

## TTL Strategy

```typescript
export const CACHE_TTL = {
  // Short — frequently updated
  PRODUCT_LIST: 60,           // 1 minute — products change often
  DASHBOARD_STATS: 300,       // 5 minutes — acceptable staleness for metrics
  FEED_STATUS: 30,            // 30 seconds — feed runs update frequently

  // Medium — external data
  ENRICHMENT_DATA: 3600,      // 1 hour — enrichment data is stable
  COMPETITOR_ANALYSIS: 86400, // 24 hours — daily refresh is fine

  // Long — rarely changes
  AEO_ANALYSIS: 21600,        // 6 hours — content doesn't change often
  CONFIG_VALUES: 300,          // 5 minutes — feature flags

  // Session
  USER_SESSION: 604800,       // 7 days — JWT validity
} as const;
```

---

## Using packages/cache

```typescript
import { CacheService } from '@metafy/cache';

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly cache: CacheService,
    private readonly logger: Logger,
  ) {}

  async findAll(user: User): Promise<Product[]> {
    const key = cacheKey.productList(user.orgId, user.projectId);

    // Cache-aside pattern
    const cached = await this.cache.get<Product[]>(key);
    if (cached) {
      this.logger.debug('Cache hit', { key });
      return cached;
    }

    const products = await this.productRepository.find({
      orgId: user.orgId,
      projectId: user.projectId,
    });

    await this.cache.set(key, products, CACHE_TTL.PRODUCT_LIST);
    return products;
  }

  async create(dto: CreateProductDto, user: User): Promise<Product> {
    const product = await this.productRepository.create({ ...dto, ...tenantFields });

    // Invalidate list cache on write
    await this.invalidateProductCache(user.orgId, user.projectId);

    return product;
  }

  async update(id: string, dto: UpdateProductDto, user: User): Promise<Product> {
    const product = await this.productRepository.updateById(id, dto);

    // Invalidate both individual + list cache
    await Promise.all([
      this.cache.del(cacheKey.product(user.orgId, user.projectId, id)),
      this.invalidateProductCache(user.orgId, user.projectId),
    ]);

    return product;
  }

  private async invalidateProductCache(orgId: string, projectId: string) {
    // Use pattern delete for list variants
    await this.cache.delByPattern(`product-service:${orgId}:${projectId}:products:*`);
  }
}
```

---

## NestJS CacheInterceptor (HTTP Response Caching)

```typescript
// For GET endpoints with stable responses
@Get('stats')
@UseInterceptors(CacheInterceptor)
@CacheTTL(CACHE_TTL.DASHBOARD_STATS)
@CacheKey(/* key derived from request — includes user context */)
async getDashboardStats(@CurrentUser() user: User) {
  return this.analyticsService.getDashboardStats(user);
}
```

**Important:** NestJS CacheInterceptor derives the cache key from the URL by default. For multi-tenant safety, override the key to include `orgId + projectId`.

---

## Cache Invalidation Patterns

### 1. Invalidate on Write (most common)
```typescript
// After any mutation, invalidate related cache keys
await this.cache.del(cacheKey.product(orgId, projectId, productId));
await this.cache.delByPattern(`product-service:${orgId}:${projectId}:products:*`);
```

### 2. TTL-Based Expiry (acceptable staleness)
```typescript
// For analytics — don't bother invalidating, just let TTL expire
await this.cache.set(key, data, CACHE_TTL.DASHBOARD_STATS); // stale for up to 5 min
```

### 3. Tag-Based Invalidation (advanced)
```typescript
// Group related keys by tag for bulk invalidation
await this.cache.setWithTags(key, data, ttl, [`org:${orgId}`, `product:${productId}`]);

// Invalidate everything for an org (e.g., org deleted)
await this.cache.delByTag(`org:${orgId}`);
```

---

## Multi-Tenant Cache Isolation (CRITICAL)

```typescript
// CORRECT — key includes orgId
const key = `product-service:${orgId}:${projectId}:product:${productId}`;

// WRONG — shared key across tenants (data leak risk)
const key = `product:${productId}`; // org A could read org B's cached data
```

**Verify by inspection:** Every `cache.set()` call must use a key that includes `orgId`.

---

## Caching LLM Responses

```typescript
async analyzeContent(content: string, orgId: string): Promise<AeoResult> {
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');
  const key = cacheKey.aeoAnalysis(orgId, contentHash);

  const cached = await this.cache.get<AeoResult>(key);
  if (cached) return cached;

  // LLM call is expensive — always cache the result
  const result = await this.llmService.analyze(content);

  await this.cache.set(key, result, CACHE_TTL.AEO_ANALYSIS);
  return result;
}
```

---

## Cache Monitoring

```typescript
// Log cache hit/miss rates for key paths
private async withCache<T>(key: string, ttl: number, fetch: () => Promise<T>): Promise<T> {
  const cached = await this.cache.get<T>(key);
  if (cached) {
    this.metrics.increment('cache.hit', { key: key.split(':')[2] }); // service-level tag
    return cached;
  }

  this.metrics.increment('cache.miss', { key: key.split(':')[2] });
  const result = await fetch();
  await this.cache.set(key, result, ttl);
  return result;
}
```

Target cache hit rate for dashboard stats: > 80%. If below, increase TTL or investigate invalidation storms.
