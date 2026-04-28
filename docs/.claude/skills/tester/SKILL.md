---
name: tester
description: Comprehensive testing skill for Metafy AI Platform. Covers unit, integration, e2e, performance, and contract testing strategies across all 18 NestJS services and the Next.js dashboard. Encodes what to test, how to structure tests, what to mock, and how to measure coverage meaningfully.
user-invocable: true
---

# Tester Skill — Metafy AI Platform

## Testing Pyramid for Metafy

```
          [E2E]          ← Few. Full HTTP flow through gateway → service → DB
        [Integration]    ← Most. Service + real MongoDB, mocked external HTTP
      [Unit]             ← Fast. Pure functions, service logic with mocked repo
```

**Golden rule:** Test behavior, not implementation. If a test breaks when you rename a variable, it's testing the wrong thing.

---

## Test File Locations

```
apps/[service]/src/
  [domain]/
    [domain].service.spec.ts      ← unit test
    [domain].controller.spec.ts   ← e2e test (with supertest)
    [domain].repository.spec.ts   ← integration (real MongoDB)
  test/
    app.e2e-spec.ts               ← full app e2e
    helpers/
      auth.helper.ts              ← JWT token factory
      factories.ts                ← mock data factories
```

---

## Unit Testing — Service Layer

```typescript
// [domain].service.spec.ts
describe('ProductService', () => {
  let service: ProductService;
  let repo: jest.Mocked<ProductRepository>;
  let kafka: jest.Mocked<KafkaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: ProductRepository, useValue: mockRepository() },
        { provide: KafkaService, useValue: mockKafka() },
        { provide: Logger, useValue: mockLogger() },
      ],
    }).compile();

    service = module.get(ProductService);
    repo = module.get(ProductRepository);
    kafka = module.get(KafkaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create product with tenant context from user', async () => {
      const user = buildUser({ orgId: 'org-1', projectId: 'proj-1' });
      const dto = buildCreateProductDto();
      const expected = buildProduct({ orgId: 'org-1', projectId: 'proj-1' });
      repo.create.mockResolvedValue(expected);

      const result = await service.create(dto, user);

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        orgId: 'org-1',
        projectId: 'proj-1',
        createdBy: user.id,
      }));
      expect(kafka.emit).toHaveBeenCalledWith('product-created', expect.objectContaining({
        productId: expected.id,
        orgId: 'org-1',
      }));
      expect(result).toEqual(expected);
    });

    it('should still create product if Kafka emit fails', async () => {
      repo.create.mockResolvedValue(buildProduct());
      kafka.emit.mockRejectedValue(new Error('Kafka down'));

      // Should NOT throw — Kafka failure is non-blocking
      await expect(service.create(buildCreateProductDto(), buildUser())).resolves.toBeDefined();
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException when product does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findById('missing-id', buildUser()))
        .rejects.toThrow(NotFoundException);
    });

    it('should return product when found within tenant scope', async () => {
      const product = buildProduct();
      repo.findById.mockResolvedValue(product);

      const result = await service.findById(product.id, buildUser());
      expect(result).toEqual(product);
    });
  });
});
```

---

## Integration Testing — Repository + Real MongoDB

```typescript
// [domain].repository.spec.ts
// Uses real MongoDB (in-memory via mongodb-memory-server)
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('ProductRepository (integration)', () => {
  let mongod: MongoMemoryServer;
  let repo: ProductRepository;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
      ],
      providers: [ProductRepository],
    }).compile();

    repo = module.get(ProductRepository);
  });

  afterAll(async () => {
    await mongod.stop();
  });

  afterEach(async () => {
    // Clean up between tests
    await mongoose.connection.collection('products').deleteMany({});
  });

  it('should enforce tenant isolation — org-1 cannot see org-2 products', async () => {
    await repo.create(buildProduct({ orgId: 'org-1', projectId: 'proj-1', name: 'Org1 Product' }));
    await repo.create(buildProduct({ orgId: 'org-2', projectId: 'proj-1', name: 'Org2 Product' }));

    const org1Results = await repo.find({ orgId: 'org-1', projectId: 'proj-1' });

    expect(org1Results).toHaveLength(1);
    expect(org1Results[0].name).toBe('Org1 Product');
  });
});
```

---

## E2E Testing — Full HTTP with Supertest

```typescript
// test/app.e2e-spec.ts
describe('Products API (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    token = await getTestToken({ orgId: 'test-org', projectId: 'test-proj' });
  });

  afterAll(() => app.close());

  describe('POST /products', () => {
    it('201 — creates product with valid data', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Product', status: 'active' })
        .expect(201);

      expect(body).toMatchObject({
        id: expect.any(String),
        name: 'Test Product',
        orgId: 'test-org',
      });
    });

    it('401 — rejects missing token', () =>
      request(app.getHttpServer()).post('/products').send({}).expect(401));

    it('400 — rejects missing name', () =>
      request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'active' }) // missing name
        .expect(400));
  });
});
```

---

## Test Factories (shared helpers)

```typescript
// test/helpers/factories.ts
import { faker } from '@faker-js/faker';

export const buildUser = (overrides: Partial<User> = {}): User => ({
  id: faker.string.uuid(),
  orgId: faker.string.uuid(),
  projectId: faker.string.uuid(),
  email: faker.internet.email(),
  role: 'member',
  ...overrides,
});

export const buildProduct = (overrides: Partial<Product> = {}): Product => ({
  id: faker.string.uuid(),
  orgId: faker.string.uuid(),
  projectId: faker.string.uuid(),
  name: faker.commerce.productName(),
  status: 'active',
  createdBy: faker.string.uuid(),
  updatedBy: faker.string.uuid(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const buildCreateProductDto = (overrides = {}): CreateProductDto => ({
  name: faker.commerce.productName(),
  status: ProductStatus.ACTIVE,
  ...overrides,
});

// Mock factories
export const mockRepository = () => ({
  create: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  findById: jest.fn().mockResolvedValue(null),
  updateById: jest.fn(),
  deleteById: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
});

export const mockKafka = () => ({
  emit: jest.fn().mockResolvedValue(undefined),
});

export const mockLogger = () => ({
  log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn(),
});
```

---

## LLM / Agent Testing

```typescript
// Mock Anthropic for agent tests — never call real LLM in CI
jest.mock('@anthropic-ai/sdk');

const mockAnthropic = {
  messages: {
    create: jest.fn().mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'I found 3 matching products.' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    }),
  },
};

// Test tool use flow
it('should execute search tool when user asks for products', async () => {
  mockAnthropic.messages.create
    .mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [{
        type: 'tool_use',
        id: 'tool-123',
        name: 'search_products',
        input: { query: 'running shoes' },
      }],
    })
    .mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Here are the products I found.' }],
    });

  const result = await agentService.chat('Find running shoes', mockContext);

  expect(searchToolSpy).toHaveBeenCalledWith({ query: 'running shoes' });
  expect(result).toContain('products I found');
});
```

---

## Running Tests

```bash
# Single service
cd apps/product-service && npm run test

# Watch mode (development)
cd apps/product-service && npm run test -- --watch

# Coverage report
cd apps/product-service && npm run test -- --coverage

# Specific test file
npm run test -- --testPathPattern="product.service"

# All services
npm run test  # from root

# E2E only
npm run test -- --testPathPattern="e2e"
```

---

## Coverage Targets

| Layer | Target | How to measure |
|-------|--------|---------------|
| Service business logic | ≥ 80% | `npm run test -- --coverage` |
| Controller (HTTP) | All endpoints | Manual check per route |
| Tenant isolation | 100% | Explicit cross-org test per entity |
| Repository query methods | Key paths | Repository integration tests |
| Utility functions | ≥ 90% | Unit tests |
| LLM/Agent logic | Tool calls, error paths | Mocked Anthropic |
