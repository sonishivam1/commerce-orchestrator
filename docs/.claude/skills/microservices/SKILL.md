---
name: microservices
description: Microservices architecture skill for Metafy AI Platform. Encodes inter-service communication patterns, service discovery, circuit breaking, health checks, shared package usage, event-driven wiring, and the correct way to add or extend any of the 18 NestJS services.
user-invocable: true
---

# Microservices Skill — Metafy AI Platform

## Service Inventory & Ownership

| Service | Port | Owns | Never Touch |
|---------|------|------|-------------|
| gateway | 9000 | Routing, auth forwarding, rate limiting | Business logic |
| auth-service | 8080 | Users, sessions, WorkOS SSO, JWT | Any other domain data |
| organization-service | 8081 | Orgs, memberships, API keys | User passwords |
| project-service | 8082 | Projects, project settings | Org billing |
| product-service | 8083 | Product catalog, drafts | Feed execution |
| data-service | 8084 | Data pipelines, transforms | Raw LLM calls |
| feed-service | 8085 | Feed configs, feed runs, product sync | Product schema |
| analytics-service | 8086 | Events, metrics, aggregations | Raw product data |
| audit-service | 8087 | Immutable audit log (append-only) | Any update/delete |
| billing-service | 8088 | Subscriptions, invoices, Stripe | Feature flags |
| admin-service | 8089 | Internal admin ops | Public API |
| lead-service | 8090 | Lead capture, enrichment | Billing |
| competitor-service | 8091 | Competitor analysis, tracking | AEO scoring |
| platform-service | 8092 | Platform core config | Individual domains |
| enrichment-service | 3002 | Data enrichment pipelines | Product storage |
| aeo-service | 3003 | AEO analysis, scoring, optimization | Feed management |
| agent-commerce-service | 3004 | Agentic checkout, Claude tool use, MCP | Billing execution |

---

## Inter-Service Communication Patterns

### Pattern 1: Synchronous HTTP (request-scoped, user-initiated)
Use `packages/http-client` for service-to-service HTTP calls.

```typescript
// packages/http-client usage
@Injectable()
export class ProductHttpClient {
  constructor(private readonly httpClient: HttpClientService) {}

  async getProduct(productId: string, orgId: string, projectId: string) {
    return this.httpClient.get<Product>(
      `http://product-service:8083/products/${productId}`,
      { headers: { 'x-org-id': orgId, 'x-project-id': projectId } },
    );
  }
}
```

**Use when:**
- Response is needed immediately to serve the current request
- The operation is user-facing (real-time)
- Failure should propagate to the caller

**Failure handling:**
```typescript
try {
  const product = await this.productHttpClient.getProduct(id, orgId, projectId);
} catch (error) {
  if (error.response?.status === 404) throw new NotFoundException('Product not found');
  if (error.response?.status === 503) throw new ServiceUnavailableException('Product service unavailable');
  throw new InternalServerErrorException('Failed to fetch product');
}
```

### Pattern 2: Async Kafka Events (eventual consistency, cross-domain)
Use `packages/messaging` for domain events.

```typescript
// Producer — fire after DB write succeeds
await this.kafkaService.emit('product-created', event);

// Consumer — idempotent handler
@MessagePattern('product-created')
async handle(@Payload() event: ProductCreatedEvent) {
  // Must be idempotent — may receive same event multiple times
  await this.indexService.upsertProduct(event.productId, event.orgId, event.projectId);
}
```

**Use when:**
- Cross-service data sync (analytics, audit, search indexing)
- Non-critical fan-out (multiple consumers)
- Decoupled workflows (feed runs, enrichment)
- Failure tolerance needed (consumer retries independently)

### Pattern 3: Never Do This
```typescript
// WRONG — direct Mongoose access across service boundaries
import { ProductSchema } from '../../product-service/src/schemas/product.schema'; // NO

// WRONG — shared database collection across services
// Each service owns its collections exclusively

// WRONG — synchronous HTTP in a Kafka consumer (blocks consumer)
@MessagePattern('product-created')
async handle(@Payload() event) {
  const user = await this.httpClient.get(`/users/${event.userId}`); // NO — will slow consumer
}
```

---

## Service Bootstrap Checklist (main.ts)

Every service `main.ts` must have:

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || DEFAULT_PORT;

  // 1. Global validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // 2. Security headers
  app.use(helmet());

  // 3. CORS (dev only)
  if (configService.get('NODE_ENV') !== 'production') {
    app.enableCors({ origin: true });
  }

  // 4. Swagger (non-production)
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('[Service] API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document);
  }

  // 5. Health check endpoint (Cloud Run requires this)
  app.use('/health', (_, res) => res.json({ status: 'ok' }));

  // 6. Start Kafka microservice (if this service consumes events)
  // app.connectMicroservice(kafkaOptions);
  // await app.startAllMicroservices();

  await app.listen(port);
  logger.log(`[Service] running on port ${port}`);
}
```

---

## Adding a New Endpoint to an Existing Service

1. Read the existing controller in that service
2. Add the DTO in `src/[domain]/dto/`
3. Add the service method in `src/[domain]/[domain].service.ts`
4. Add the repository query in `src/[domain]/[domain].repository.ts` (if needed)
5. Add the controller endpoint with full decorators
6. Run `npm run build` in the service to verify types
7. Run `npm run lint` in the service

Never touch `main.ts`, `app.module.ts`, or shared packages just to add an endpoint.

---

## Service Health & Readiness

Cloud Run calls `/health` before routing traffic. Always keep it lightweight:

```typescript
// CORRECT — no DB call
app.use('/health', (_, res) => res.json({ status: 'ok', service: 'product-service' }));

// WRONG — a failing DB will make Cloud Run think the instance is unhealthy
app.use('/health', async (_, res) => {
  await mongoose.connection.db.ping(); // expensive, kills startup
  res.json({ status: 'ok' });
});
```

---

## Correlation ID Tracing

Every request entering the gateway gets a `x-correlation-id` header. All services propagate it:

```typescript
// In service middleware
const correlationId = req.headers['x-correlation-id'] || uuid();
req.headers['x-correlation-id'] = correlationId;

// In logger context — always include correlation ID
this.logger.debug(`Processing request`, { correlationId, orgId: user.orgId });

// In outbound HTTP calls
headers: { 'x-correlation-id': correlationId }
```

To trace a request across all 18 services:
```bash
grep "correlationId:abc-123" logs/*.log
```

---

## Service Dependency Map (who calls whom)

```
Client → Gateway (9000)
         ├── auth-service (8080)       [every request for JWT validation]
         ├── organization-service (8081)
         ├── project-service (8082)
         ├── product-service (8083)    → feed-service [HTTP for feed sync]
         ├── feed-service (8085)       → product-service [HTTP for product data]
         ├── aeo-service (3003)        → competitor-service [HTTP for analysis]
         └── agent-commerce-service (3004) → product-service [HTTP for catalog]
                                           → billing-service [HTTP for charge]

Kafka event flows:
  product-service → [product-created] → feed-service, analytics-service, aeo-service
  feed-service → [feed-run-completed] → analytics-service, data-service
  billing-service → [subscription-activated] → organization-service
  agent-commerce-service → [checkout-completed] → billing-service, audit-service
  ANY service → [*] → audit-service (audit log)
```
