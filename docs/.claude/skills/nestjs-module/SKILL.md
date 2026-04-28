---
name: nestjs-module
description: Complete NestJS module scaffolding skill for Metafy microservices. Encodes the exact file structure, class patterns, decorator usage, and wiring required to add a new domain module to any service. Invoke when adding a new feature domain to an existing service.
user-invocable: true
---

# NestJS Module Skill — Metafy AI Platform

This skill produces complete, production-ready NestJS module code that exactly matches Metafy conventions. Use it whenever adding a new domain (entity + CRUD) to an existing service.

---

## What This Skill Produces
Given a domain name (e.g., `ProductVariant`) and service (e.g., `product-service`), it generates:
1. `product-variant.schema.ts` — Mongoose schema extending BaseSchema
2. `create-product-variant.dto.ts` — validated request DTO
3. `update-product-variant.dto.ts` — partial update DTO
4. `product-variant.repository.ts` — extends BaseRepository
5. `product-variant.service.ts` — tenant-scoped business logic
6. `product-variant.controller.ts` — HTTP layer with auth + Swagger
7. `product-variant.module.ts` — wires everything together
8. Updates to `app.module.ts` — registers the new module

---

## Template: Schema

```typescript
// src/[domain]/schemas/[domain].schema.ts
import { BaseSchema } from '@metafy/database';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type [Domain]Document = [Domain] & Document;

export enum [Domain]Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

@Schema({ timestamps: true, collection: '[domains]' })
export class [Domain] extends BaseSchema {
  // DO NOT add: orgId, projectId, createdBy, updatedBy, createdAt, updatedAt
  // BaseSchema provides all of these

  @Prop({ required: true, index: true })
  name: string;

  @Prop({ required: true, enum: [Domain]Status, index: true })
  status: [Domain]Status;

  @Prop({ type: String, default: null })
  description: string | null;

  // Cross-service string ID reference (never ObjectId ref)
  // @Prop({ required: true, index: true })
  // parentId: string;
}

export const [Domain]Schema = SchemaFactory.createForClass([Domain]);

// Compound indexes — always start with orgId + projectId
[Domain]Schema.index({ orgId: 1, projectId: 1 });
[Domain]Schema.index({ orgId: 1, projectId: 1, status: 1 });
[Domain]Schema.index({ orgId: 1, projectId: 1, createdAt: -1 });
[Domain]Schema.index({ orgId: 1, projectId: 1, name: 1 });
```

---

## Template: Create DTO

```typescript
// src/[domain]/dto/create-[domain].dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength,
} from 'class-validator';
import { [Domain]Status } from '../schemas/[domain].schema';

export class Create[Domain]Dto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiProperty({ example: 'My [Domain]', description: '[Domain] name' })
  name: string;

  @IsEnum([Domain]Status)
  @ApiProperty({ enum: [Domain]Status, example: [Domain]Status.ACTIVE })
  status: [Domain]Status;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  @ApiPropertyOptional({ example: 'Description text' })
  description?: string;
}
```

---

## Template: Update DTO

```typescript
// src/[domain]/dto/update-[domain].dto.ts
import { PartialType } from '@nestjs/swagger';
import { Create[Domain]Dto } from './create-[domain].dto';

export class Update[Domain]Dto extends PartialType(Create[Domain]Dto) {}
```

---

## Template: Repository

```typescript
// src/[domain]/[domain].repository.ts
import { BaseRepository } from '@metafy/database';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { [Domain], [Domain]Document } from './schemas/[domain].schema';

@Injectable()
export class [Domain]Repository extends BaseRepository<[Domain]Document> {
  constructor(
    @InjectModel([Domain].name) private readonly [domain]Model: Model<[Domain]Document>,
  ) {
    super([domain]Model);
  }

  // Add custom query methods below if needed
  // All queries MUST include orgId + projectId in the filter
  async findByStatus(
    filter: FilterQuery<[Domain]Document>,
    status: string,
  ): Promise<[Domain]Document[]> {
    return this.[domain]Model.find({ ...filter, status }).lean();
  }
}
```

---

## Template: Service

```typescript
// src/[domain]/[domain].service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { User } from '@metafy/types';
import { [Domain]Repository } from './[domain].repository';
import { Create[Domain]Dto } from './dto/create-[domain].dto';
import { Update[Domain]Dto } from './dto/update-[domain].dto';

@Injectable()
export class [Domain]Service {
  private readonly logger = new Logger([Domain]Service.name);

  constructor(private readonly [domain]Repository: [Domain]Repository) {}

  private tenantFilter(user: User) {
    return { orgId: user.orgId, projectId: user.projectId };
  }

  async create(dto: Create[Domain]Dto, user: User) {
    this.logger.debug(`Creating [domain] for org ${user.orgId}`);
    return this.[domain]Repository.create({
      ...dto,
      orgId: user.orgId,
      projectId: user.projectId,
      createdBy: user.id,
      updatedBy: user.id,
    });
  }

  async findAll(user: User) {
    return this.[domain]Repository.find(this.tenantFilter(user));
  }

  async findById(id: string, user: User) {
    const item = await this.[domain]Repository.findById(id, this.tenantFilter(user));
    if (!item) throw new NotFoundException(`[Domain] ${id} not found`);
    return item;
  }

  async update(id: string, dto: Update[Domain]Dto, user: User) {
    await this.findById(id, user); // ensures ownership
    return this.[domain]Repository.updateById(id, {
      ...dto,
      updatedBy: user.id,
    });
  }

  async remove(id: string, user: User) {
    await this.findById(id, user); // ensures ownership
    await this.[domain]Repository.deleteById(id);
    this.logger.debug(`Deleted [domain] ${id} for org ${user.orgId}`);
  }
}
```

---

## Template: Controller

```typescript
// src/[domain]/[domain].controller.ts
import {
  Body, Controller, Delete, Get, Param, Post, Put, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard } from '@metafy/identity-context';
import { User } from '@metafy/types';
import { [Domain]Service } from './[domain].service';
import { Create[Domain]Dto } from './dto/create-[domain].dto';
import { Update[Domain]Dto } from './dto/update-[domain].dto';

@ApiTags('[domains]')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('[domains]')
export class [Domain]Controller {
  constructor(private readonly [domain]Service: [Domain]Service) {}

  @Post()
  @ApiOperation({ summary: 'Create [domain]' })
  @ApiResponse({ status: 201, description: '[Domain] created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() dto: Create[Domain]Dto, @CurrentUser() user: User) {
    return this.[domain]Service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List all [domains]' })
  findAll(@CurrentUser() user: User) {
    return this.[domain]Service.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get [domain] by ID' })
  @ApiResponse({ status: 404, description: '[Domain] not found' })
  findById(@Param('id') id: string, @CurrentUser() user: User) {
    return this.[domain]Service.findById(id, user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update [domain]' })
  update(
    @Param('id') id: string,
    @Body() dto: Update[Domain]Dto,
    @CurrentUser() user: User,
  ) {
    return this.[domain]Service.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete [domain]' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.[domain]Service.remove(id, user);
  }
}
```

---

## Template: Module

```typescript
// src/[domain]/[domain].module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { [Domain], [Domain]Schema } from './schemas/[domain].schema';
import { [Domain]Repository } from './[domain].repository';
import { [Domain]Service } from './[domain].service';
import { [Domain]Controller } from './[domain].controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: [Domain].name, schema: [Domain]Schema },
    ]),
  ],
  controllers: [[Domain]Controller],
  providers: [[Domain]Service, [Domain]Repository],
  exports: [[Domain]Service], // only export if other modules need it
})
export class [Domain]Module {}
```

---

## Wiring Into app.module.ts

```typescript
// Add to imports array in app.module.ts
import { [Domain]Module } from './[domain]/[domain].module';

@Module({
  imports: [
    // ... existing modules
    [Domain]Module,
  ],
})
export class AppModule {}
```

---

## Checklist After Generating
- [ ] Replace all `[Domain]` / `[domain]` / `[domains]` placeholders
- [ ] Collection name in @Schema matches plural form of domain
- [ ] Indexes defined after SchemaFactory.createForClass
- [ ] Module imported in app.module.ts
- [ ] Run `npm run build` to verify no TypeScript errors
- [ ] Run `npm run lint` to verify no lint errors
