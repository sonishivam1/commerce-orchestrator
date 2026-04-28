---
description: DTO and validation rules — auto-loads when editing DTO files or files containing class-validator decorators
globs:
  - "**/dto/**/*.ts"
  - "**/dtos/**/*.ts"
  - "**/*.dto.ts"
---

# DTO & Validation Rules (Auto-loaded for DTO files)

## Required on Every DTO Field
```typescript
// Public field → @ApiProperty()
// Optional public field → @ApiPropertyOptional()
// Always pair with class-validator decorator
```

## Standard DTO Patterns

### String Fields
```typescript
@IsString()
@IsNotEmpty()
@ApiProperty({ description: 'Product name', example: 'Running Shoes' })
name: string;

@IsString()
@IsOptional()
@ApiPropertyOptional({ description: 'Product description' })
description?: string;

@IsString()
@MinLength(2)
@MaxLength(100)
@ApiProperty()
code: string;
```

### Enum Fields
```typescript
@IsEnum(ProductStatus)
@ApiProperty({ enum: ProductStatus, example: ProductStatus.ACTIVE })
status: ProductStatus;
```

### Number Fields
```typescript
@IsNumber()
@Min(0)
@ApiProperty({ description: 'Price in cents', example: 1999 })
price: number;

@IsInt()
@Min(1)
@Max(100)
@IsOptional()
@ApiPropertyOptional({ default: 20 })
limit?: number;
```

### Boolean Fields
```typescript
@IsBoolean()
@IsOptional()
@ApiPropertyOptional({ default: false })
isActive?: boolean;
```

### Array Fields
```typescript
@IsArray()
@IsString({ each: true })
@IsOptional()
@ApiPropertyOptional({ type: [String] })
tags?: string[];
```

### Nested DTOs
```typescript
@IsObject()
@ValidateNested()
@Type(() => AddressDto)
@ApiProperty({ type: AddressDto })
address: AddressDto;
```

### Date Fields
```typescript
@IsDateString()
@IsOptional()
@ApiPropertyOptional()
scheduledAt?: string;
```

## Never Include These in DTOs
These fields come from the authenticated user or are set server-side:
```typescript
// NEVER include in request DTOs:
orgId: string;       // comes from @CurrentUser()
projectId: string;   // comes from @CurrentUser()
createdBy: string;   // set by service from @CurrentUser()
updatedBy: string;   // set by service from @CurrentUser()
createdAt: Date;     // set by Mongoose timestamps
updatedAt: Date;     // set by Mongoose timestamps
id: string;          // comes from MongoDB, not from request
```

## Response DTOs / Serialization
For response types, use `@Exclude()` to hide internal fields:
```typescript
export class ProductResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @Exclude()
  __v: number; // hide Mongoose version key

  @Exclude()
  _id: string; // hide raw MongoDB _id if you expose id instead
}
```

## DTO Inheritance
Use base DTOs for shared fields:
```typescript
export class BaseFilterDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  @ApiPropertyOptional({ default: 1 })
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @ApiPropertyOptional({ default: 20 })
  limit?: number = 20;
}

export class ProductFilterDto extends BaseFilterDto {
  @IsEnum(ProductStatus)
  @IsOptional()
  @ApiPropertyOptional({ enum: ProductStatus })
  status?: ProductStatus;
}
```

## Validation Pipe (Ensure Global Setup in main.ts)
```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,              // strip unknown properties
  forbidNonWhitelisted: true,   // throw on unknown properties
  transform: true,              // auto-transform types (string '5' → number 5)
  transformOptions: {
    enableImplicitConversion: true,
  },
}));
```
