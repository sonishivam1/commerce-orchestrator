---
description: NestJS backend rules — auto-loads when editing any backend service controller, service, or module file
globs:
  - "apps/auth-service/src/**/*.ts"
  - "apps/organization-service/src/**/*.ts"
  - "apps/project-service/src/**/*.ts"
  - "apps/product-service/src/**/*.ts"
  - "apps/data-service/src/**/*.ts"
  - "apps/feed-service/src/**/*.ts"
  - "apps/analytics-service/src/**/*.ts"
  - "apps/audit-service/src/**/*.ts"
  - "apps/billing-service/src/**/*.ts"
  - "apps/admin-service/src/**/*.ts"
  - "apps/lead-service/src/**/*.ts"
  - "apps/competitor-service/src/**/*.ts"
  - "apps/platform-service/src/**/*.ts"
  - "apps/enrichment-service/src/**/*.ts"
  - "apps/aeo-service/src/**/*.ts"
  - "apps/gateway/src/**/*.ts"
---

# NestJS Backend Rules (Auto-loaded for all backend service files)

## Layer Separation (strict)
- **Controller** → HTTP only: parse request, call service, return response. No business logic. No Mongoose.
- **Service** → Business logic only. Calls repositories. No direct Mongoose model access.
- **Repository** → Data access only. Extends BaseRepository. Never contains business decisions.

```typescript
// WRONG — business logic in controller
@Post()
async create(@Body() dto: CreateProductDto) {
  const exists = await this.productModel.findOne({ name: dto.name }); // WRONG
  if (exists) throw new ConflictException();
  return this.productModel.create(dto); // WRONG
}

// CORRECT — controller delegates everything
@Post()
async create(@Body() dto: CreateProductDto, @CurrentUser() user: User) {
  return this.productService.create(dto, user);
}
```

## Multi-Tenancy (NON-NEGOTIABLE)
- `orgId` and `projectId` ALWAYS come from `@CurrentUser()` — never from `@Body()` or `@Param()`
- Every repository call must include `orgId` + `projectId`
- Never call `this.model.find({})` — always scoped

```typescript
// CORRECT
async findAll(user: User) {
  return this.productRepository.find({ orgId: user.orgId, projectId: user.projectId });
}

// WRONG — unscoped, cross-tenant data leak
async findAll() {
  return this.productRepository.find({});
}
```

## Authentication
- `@UseGuards(JwtAuthGuard)` on every controller class (or endpoint if mixed public/private)
- `@CurrentUser()` to extract the authenticated user
- Never trust `orgId`/`projectId` from the request body

## Validation
- Every `@Body()` parameter must use a typed DTO class (never `object`, `any`, `Record<string, unknown>`)
- DTOs use `class-validator` decorators (`@IsString()`, `@IsNotEmpty()`, etc.)
- Every DTO field has `@ApiProperty()` or `@ApiPropertyOptional()` for Swagger
- Global ValidationPipe with `whitelist: true, forbidNonWhitelisted: true, transform: true`

## Error Handling
Use NestJS built-in exceptions — never `throw new Error()`:
```typescript
throw new NotFoundException(`Product ${id} not found`);
throw new BadRequestException('Invalid status value');
throw new ConflictException('Product with this name already exists');
throw new ForbiddenException('You do not have access to this resource');
```

## Logging
- Inject `Logger` from `@nestjs/common` — never `console.log`
- Log at `debug` level for normal operations, `warn` for unexpected but handled, `error` for failures
- Never log sensitive data: tokens, passwords, full user objects

```typescript
private readonly logger = new Logger(ProductService.name);

// In methods:
this.logger.debug(`Creating product for org ${user.orgId}`);
this.logger.error(`Failed to create product`, error.stack);
```

## Swagger Documentation
Every public endpoint must have:
```typescript
@ApiTags('products')
@ApiBearerAuth()
@ApiOperation({ summary: 'Create a product' })
@ApiResponse({ status: 201, description: 'Product created', type: Product })
@ApiResponse({ status: 400, description: 'Validation error' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
```

## Module Registration
When adding any new provider, always register it in the feature module:
```typescript
@Module({
  imports: [MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }])],
  controllers: [ProductController],
  providers: [ProductService, ProductRepository],
  exports: [ProductService], // only if needed by other modules
})
```

## Configuration
- Use `ConfigService` from `@nestjs/config` — never `process.env.X` directly in services
- Environment variables must be validated with Joi in the config module

## Async Patterns
- Parallelize independent async operations:
```typescript
// CORRECT
const [user, org] = await Promise.all([getUser(userId), getOrg(orgId)]);

// WRONG — sequential when there's no dependency
const user = await getUser(userId);
const org = await getOrg(orgId);
```
