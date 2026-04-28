---
name: kafka-event
description: Kafka event design and implementation skill for Metafy microservices. Encodes the event naming convention, payload structure, producer pattern, consumer pattern, and cross-service event flow. Invoke when adding a new domain event, wiring a producer, or consuming events in a new service.
user-invocable: true
---

# Kafka Event Skill — Metafy AI Platform

This skill encodes the complete pattern for designing and implementing Kafka events across the microservices.

---

## Event Naming Convention

```
[domain]-[past-tense-verb]

Examples:
  product-created
  product-updated
  product-deleted
  feed-run-started
  feed-run-completed
  checkout-session-created
  checkout-completed
  org-member-invited
  billing-subscription-activated
```

Rules:
- Always kebab-case
- Always past tense (event already happened)
- Domain prefix matches the owning service domain
- Be specific: `feed-run-completed` not `feed-updated`

---

## Event Payload Structure

Every event payload MUST include the tenant context and a timestamp:

```typescript
// packages/types/src/events/[domain].events.ts
export interface ProductCreatedEvent {
  // Tenant context — ALWAYS required
  orgId: string;
  projectId: string;

  // Entity identification
  productId: string;

  // Event metadata
  timestamp: string;       // ISO 8601: new Date().toISOString()
  triggeredBy: string;     // userId who triggered the action

  // Domain-specific payload (keep it lean — include IDs, not full objects)
  name: string;
  status: string;
  feedId?: string;
}
```

Rules:
- Include `orgId` + `projectId` on every event (consumers need tenant context)
- Include `timestamp` (ISO string) on every event
- Include `triggeredBy` (userId) for audit trail
- Pass IDs, not full nested objects (events should be small)
- Add payload type to `packages/types/src/events/`

---

## Producer Pattern

```typescript
// In the service layer — emit after successful operation
import { KafkaService } from '@metafy/messaging';
import { ProductCreatedEvent } from '@metafy/types';

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly kafkaService: KafkaService,
  ) {}

  async create(dto: CreateProductDto, user: User): Promise<Product> {
    const product = await this.productRepository.create({
      ...dto,
      orgId: user.orgId,
      projectId: user.projectId,
      createdBy: user.id,
      updatedBy: user.id,
    });

    // Emit event AFTER successful DB write
    const event: ProductCreatedEvent = {
      orgId: product.orgId,
      projectId: product.projectId,
      productId: product.id,
      name: product.name,
      status: product.status,
      timestamp: new Date().toISOString(),
      triggeredBy: user.id,
    };

    await this.kafkaService.emit('product-created', event);
    this.logger.debug(`Emitted product-created for ${product.id}`);

    return product;
  }
}
```

Rules:
- Emit events AFTER the DB write succeeds (not before)
- Wrap emit in try/catch — a Kafka failure should NOT fail the API request
- Log the emit at debug level
- Never await Kafka in a way that blocks the API response for more than ~100ms

```typescript
// Emit without blocking the response (fire-and-forget pattern for non-critical events)
this.kafkaService.emit('product-updated', event).catch(err =>
  this.logger.error('Failed to emit product-updated event', err)
);
```

---

## Consumer Pattern

```typescript
// In the consuming service's event handler
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProductCreatedEvent } from '@metafy/types';

@Controller()
export class ProductEventConsumer {
  private readonly logger = new Logger(ProductEventConsumer.name);

  constructor(private readonly feedService: FeedService) {}

  @MessagePattern('product-created')
  async handleProductCreated(@Payload() event: ProductCreatedEvent): Promise<void> {
    this.logger.debug(`Received product-created for product ${event.productId}`);

    try {
      await this.feedService.indexProduct(event);
    } catch (error) {
      // Log and handle — do NOT re-throw (will cause Kafka redelivery loop)
      this.logger.error(
        `Failed to handle product-created for ${event.productId}`,
        error.stack,
      );
      // Consider: dead-letter queue for failed events
    }
  }
}
```

Rules:
- Never re-throw errors in Kafka consumers (causes infinite retry loops)
- Log errors with full stack trace
- Make consumer handlers idempotent — the same event may be delivered more than once
- Always validate the payload shape before processing

---

## Service Setup: Kafka Consumer Bootstrap

For a service that consumes Kafka (in addition to serving HTTP):

```typescript
// main.ts — hybrid app (HTTP + Kafka consumer)
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Connect Kafka microservice transport
  app.connectMicroservice({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [configService.get('KAFKA_BROKER')],
      },
      consumer: {
        groupId: `[service-name]-consumer`,  // unique per service
      },
    },
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  await app.startAllMicroservices(); // start Kafka consumer
  await app.listen(port);           // start HTTP server
}
```

---

## Event Registry (Document These)

When adding a new event, document it here and in the service README:

| Event | Producer | Consumers | Payload |
|-------|----------|-----------|---------|
| `product-created` | product-service | feed-service, analytics-service, aeo-service | ProductCreatedEvent |
| `product-updated` | product-service | feed-service, analytics-service | ProductUpdatedEvent |
| `feed-run-completed` | feed-service | analytics-service, data-service | FeedRunCompletedEvent |
| `checkout-completed` | agent-commerce-service | billing-service, audit-service, analytics-service | CheckoutCompletedEvent |
| `org-member-invited` | organization-service | auth-service | OrgMemberInvitedEvent |

---

## Checklist When Adding a New Event

- [ ] Event name follows `[domain]-[past-tense]` convention
- [ ] Payload type defined in `packages/types/src/events/`
- [ ] Payload includes: `orgId`, `projectId`, `timestamp`, `triggeredBy`
- [ ] Payload contains IDs, not full embedded objects
- [ ] Producer emits AFTER successful DB write
- [ ] Producer wraps emit in try/catch (Kafka failure ≠ API failure)
- [ ] Consumer is idempotent (handles duplicate delivery gracefully)
- [ ] Consumer does NOT re-throw errors
- [ ] Consumer group ID is unique to the consuming service
- [ ] Event documented in the registry table above
