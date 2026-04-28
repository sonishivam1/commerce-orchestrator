---
name: api-gateway
description: API Gateway skill for Metafy platform. Encodes routing rules, auth forwarding, rate limiting, request transformation, CORS, correlation ID injection, and the correct way to add new routes or middleware to the gateway service (port 9000).
user-invocable: true
---

# API Gateway Skill — Metafy AI Platform (port 9000)

## Gateway Responsibilities
The gateway is the **single entry point** for all external traffic. It:
1. Validates JWT tokens and forwards auth context downstream
2. Routes requests to the correct microservice
3. Injects correlation IDs for distributed tracing
4. Applies rate limiting per org/user
5. Enforces CORS for browser clients
6. Applies security headers (Helmet)

**The gateway does NOT contain business logic.** It routes.

---

## Routing Pattern

```typescript
// Gateway route registration pattern
@Controller()
export class GatewayController {
  constructor(private readonly proxyService: ProxyService) {}

  // Route: /products/** → product-service:8083
  @All('products*')
  @UseGuards(JwtAuthGuard)
  async proxyToProductService(
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser() user: User,
  ) {
    return this.proxyService.forward(req, res, {
      target: `http://product-service:${PORTS.PRODUCT_SERVICE}`,
      // Inject auth context headers so downstream doesn't need to re-validate JWT
      headers: {
        'x-user-id': user.id,
        'x-org-id': user.orgId,
        'x-project-id': user.projectId,
        'x-user-role': user.role,
        'x-correlation-id': req.headers['x-correlation-id'],
      },
    });
  }

  // Public route (no auth guard)
  @All('auth*')
  async proxyToAuthService(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, {
      target: `http://auth-service:${PORTS.AUTH_SERVICE}`,
    });
  }
}
```

---

## Auth Context Forwarding

The gateway validates the JWT **once** and passes user context to downstream services via headers. Downstream services trust these headers (they come from the gateway, not the client).

```typescript
// Gateway extracts from JWT and forwards:
'x-user-id'      → user.id
'x-org-id'       → user.orgId
'x-project-id'   → user.projectId
'x-user-role'    → user.role
'x-correlation-id' → generated UUID if not present

// Downstream service reads from headers (NOT from JWT again)
// packages/identity-context handles this extraction
```

**Never validate JWT again in downstream services** — trust the gateway's forwarded headers.

---

## Rate Limiting

```typescript
// Gateway-level rate limiting via @nestjs/throttler
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,    // 1 second
        limit: 20,    // 20 requests/second per IP
      },
      {
        name: 'medium',
        ttl: 60000,   // 1 minute
        limit: 500,   // 500 requests/minute per org
      },
    ]),
  ],
})

// Apply stricter limits to auth endpoints
@Throttle({ short: { ttl: 1000, limit: 5 } })
@All('auth/login*')
async proxyLogin() { ... }

// Stricter limits for LLM/AI endpoints (expensive)
@Throttle({ medium: { ttl: 60000, limit: 50 } })
@All('aeo*')
async proxyAeo() { ... }
```

---

## Correlation ID Middleware

```typescript
// gateway/src/middleware/correlation-id.middleware.ts
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
  }
}
```

Apply globally in `app.module.ts`:
```typescript
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
```

---

## Adding a New Route to the Gateway

When a new service is added:

1. Add the service port to `constants/ports.ts`
2. Add a new controller method (or extend existing) to proxy to the new service
3. Decide: public route (no guard) or authenticated (JwtAuthGuard)
4. Apply appropriate rate limit
5. Forward correlation ID + auth context headers
6. Test: `curl -H "Authorization: Bearer $TOKEN" http://localhost:9000/new-endpoint`

**Checklist:**
- [ ] Port constant added
- [ ] Route conflicts checked (no ambiguous catch-all overlaps)
- [ ] Auth guard applied (or explicitly left off for public routes)
- [ ] Rate limit configured
- [ ] Correlation ID forwarded
- [ ] Auth context headers forwarded (for authenticated routes)

---

## Error Response Normalization

The gateway should normalize error responses from downstream services:

```typescript
// If downstream returns 503 Service Unavailable
if (proxyError.code === 'ECONNREFUSED') {
  throw new ServiceUnavailableException(`${serviceName} is currently unavailable`);
}

// Preserve 4xx from downstream (client errors)
if (downstreamStatus >= 400 && downstreamStatus < 500) {
  res.status(downstreamStatus).json(downstreamBody);
  return;
}
```

---

## Security Headers (Helmet Config)

```typescript
// In gateway main.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // needed for some UI
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
}));
```

---

## Service URL Constants

```typescript
// gateway/src/constants/services.ts
export const SERVICE_URLS = {
  AUTH:         process.env.AUTH_SERVICE_URL         || 'http://auth-service:8080',
  ORGANIZATION: process.env.ORGANIZATION_SERVICE_URL || 'http://organization-service:8081',
  PROJECT:      process.env.PROJECT_SERVICE_URL      || 'http://project-service:8082',
  PRODUCT:      process.env.PRODUCT_SERVICE_URL      || 'http://product-service:8083',
  FEED:         process.env.FEED_SERVICE_URL         || 'http://feed-service:8085',
  ANALYTICS:    process.env.ANALYTICS_SERVICE_URL    || 'http://analytics-service:8086',
  AEO:          process.env.AEO_SERVICE_URL          || 'http://aeo-service:3003',
  AGENT:        process.env.AGENT_SERVICE_URL        || 'http://agent-commerce-service:3004',
} as const;
```

In Cloud Run: service URLs use Cloud Run internal service names. In local dev: use localhost ports.
