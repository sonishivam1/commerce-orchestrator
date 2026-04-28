---
description: Testing rules — auto-loads when editing test files (.spec.ts, .test.ts) or test directories
globs:
  - "**/*.spec.ts"
  - "**/*.test.ts"
  - "**/test/**/*.ts"
  - "**/__tests__/**/*.ts"
---

# Testing Rules (Auto-loaded for all test files)

## The Golden Rule
**Always test against real behavior, not implementation details.**
If your test would still pass after introducing a bug, it's not testing the right thing.

## What to Test (Priority Order)
1. **Tenant isolation** — org A cannot read/write org B's data (always test this)
2. **Authentication** — 401 without valid JWT, 403 with wrong permissions
3. **Business logic** — service methods return correct results
4. **Input validation** — 400 on invalid DTOs, required field errors
5. **Happy path** — the main success scenario works end-to-end
6. **Edge cases** — empty results, null optionals, boundary values

## NestJS Service Test Structure
```typescript
describe('ProductService', () => {
  let service: ProductService;
  let repository: jest.Mocked<ProductRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: ProductRepository,
          useValue: {
            create: jest.fn(),
            find: jest.fn(),
            findById: jest.fn(),
            updateById: jest.fn(),
            deleteById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    repository = module.get(ProductRepository);
  });

  afterEach(() => jest.clearAllMocks());
```

## Tenant Isolation Test (MANDATORY for any data access)
```typescript
it('should scope queries to the authenticated user tenant', async () => {
  const user = createMockUser({ orgId: 'org-123', projectId: 'proj-456' });
  repository.find.mockResolvedValue([]);

  await service.findAll(user);

  expect(repository.find).toHaveBeenCalledWith(
    expect.objectContaining({ orgId: 'org-123', projectId: 'proj-456' })
  );
});
```

## E2E Controller Test Structure
```typescript
describe('ProductController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => await app.close());
```

## Auth Tests (Never Skip These)
Every endpoint test must include:
```typescript
it('should return 401 without authentication', async () => {
  await request(app.getHttpServer())
    .get('/products')
    .expect(401);
});

it('should return 400 on invalid DTO', async () => {
  await request(app.getHttpServer())
    .post('/products')
    .set('Authorization', `Bearer ${validToken}`)
    .send({}) // missing required fields
    .expect(400);
});
```

## Mock Factory Helpers
Always create typed mock factories — never inline magic objects:
```typescript
// test/factories/user.factory.ts
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 'user-123',
    orgId: 'org-456',
    projectId: 'proj-789',
    email: 'test@example.com',
    role: 'member',
    ...overrides,
  };
}
```

## What NOT to Mock
- **MongoDB queries via BaseRepository** — test actual query behavior
- **Business logic inside the service being tested** — you're testing that logic!

## What to Mock
- **External HTTP calls** — other microservices, WorkOS, OpenAI/Anthropic APIs
- **Kafka producers** — verify `emit` was called with correct payload
- **Google Cloud services** — Storage, Tasks, Secret Manager
- **Email/SMS providers**

```typescript
// Mocking Kafka producer
const kafkaService = { emit: jest.fn().mockResolvedValue(undefined) };

// Verify correct event was emitted
expect(kafkaService.emit).toHaveBeenCalledWith('product-created', {
  orgId: 'org-123',
  productId: expect.any(String),
});
```

## Test Naming Convention
```typescript
describe('[ClassName]', () => {
  describe('[methodName]', () => {
    it('should [expected behavior] when [condition]', () => { ... });
    it('should throw NotFoundException when product does not exist', () => { ... });
    it('should return empty array when no products match filter', () => { ... });
  });
});
```

## Coverage Targets
| Layer | Minimum |
|-------|---------|
| Service business logic | 80% |
| Controller endpoints | All endpoints (happy + auth + validation) |
| Tenant isolation | 100% of data access methods |
| Utility functions | 90% |
