---
name: agentic-commerce
description: Agentic commerce skill for Metafy AI Platform. Encodes the checkout agent state machine, tool catalog, MCP server patterns, session lifecycle, payment flow, and the complete architecture of agent-commerce-service (port 3004).
user-invocable: true
---

# Agentic Commerce Skill — Metafy AI Platform

## What Agentic Commerce Is

The `agent-commerce-service` enables AI agents to autonomously browse, select, and purchase products on behalf of users using natural language. A user says "Find me running shoes under $100 and buy the best one" — the agent handles the entire flow.

**Port:** 3004
**Branch:** `feature/agentic-checkout` (active development)
**Model:** `claude-sonnet-4-6` (tool use, multi-step reasoning)

---

## Checkout State Machine

```
IDLE
  ↓ (user starts session)
BROWSING          ← search_products, get_product_details, compare_products
  ↓ (user selects product)
CART              ← add_to_cart, remove_from_cart, update_quantity, view_cart
  ↓ (user confirms cart)
CHECKOUT          ← get_shipping_options, apply_coupon, calculate_total
  ↓ (user confirms checkout)
PAYMENT           ← collect_payment_method, process_payment
  ↓ (payment succeeds)
COMPLETE          ← send_confirmation, emit checkout-completed event
  ↓ (or any time)
ABANDONED         ← session expired or user cancelled
```

**Rules:**
- State transitions are one-directional (cannot go PAYMENT → CART)
- State is persisted in MongoDB (CheckoutSession schema)
- Each state transition emits a Kafka event
- Tools available to the agent depend on current state

---

## Tool Catalog (by State)

### BROWSING state tools
```typescript
const BROWSING_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_products',
    description: `Search the product catalog. Use when user wants to find, browse, or look for products.
Returns: [{id, name, price, images, rating, availability}]`,
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        maxPrice: { type: 'number' },
        minPrice: { type: 'number' },
        category: { type: 'string' },
        sortBy: { type: 'string', enum: ['price_asc', 'price_desc', 'rating', 'relevance'] },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_product_details',
    description: 'Get full details for a specific product by ID. Use after search to get specs, reviews, availability.',
    input_schema: {
      type: 'object',
      properties: { productId: { type: 'string' } },
      required: ['productId'],
    },
  },
  {
    name: 'compare_products',
    description: 'Compare 2-4 products side-by-side. Use when user asks "which is better" or wants to decide between options.',
    input_schema: {
      type: 'object',
      properties: {
        productIds: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
      },
      required: ['productIds'],
    },
  },
];
```

### CART state tools
```typescript
const CART_TOOLS: Anthropic.Tool[] = [
  { name: 'add_to_cart', ... },
  { name: 'remove_from_cart', ... },
  { name: 'update_quantity', ... },
  { name: 'view_cart', ... },
  { name: 'proceed_to_checkout', ... }, // transitions to CHECKOUT state
];
```

### CHECKOUT state tools
```typescript
const CHECKOUT_TOOLS = [
  { name: 'get_shipping_options', ... },
  { name: 'select_shipping', ... },
  { name: 'apply_coupon', ... },
  { name: 'calculate_total', ... },
  { name: 'confirm_checkout', ... }, // transitions to PAYMENT state
];
```

### PAYMENT state tools
```typescript
const PAYMENT_TOOLS = [
  { name: 'get_saved_payment_methods', ... },
  { name: 'process_payment', ... }, // calls billing-service
];
```

---

## Session Schema

```typescript
@Schema({ timestamps: true, collection: 'checkout_sessions' })
export class CheckoutSession extends BaseSchema {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, enum: CheckoutState, default: CheckoutState.IDLE })
  state: CheckoutState;

  @Prop({ type: Array, default: [] })
  cartItems: CartItem[];

  @Prop({ type: Array, default: [] })
  messages: AgentMessage[]; // conversation history

  @Prop({ type: Object, default: {} })
  checkoutData: {
    shippingOption?: ShippingOption;
    couponCode?: string;
    totalAmount?: number;
  };

  @Prop({ default: 0 })
  actionsCount: number; // for per-session limits

  @Prop({ default: 0 })
  tokensUsed: number;   // for cost tracking

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  @Prop({ type: Date })
  expiresAt: Date; // TTL — abandon stale sessions
}

CheckoutSessionSchema.index({ orgId: 1, projectId: 1, userId: 1, state: 1 });
CheckoutSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // auto-cleanup
```

---

## MCP Server Integration

MCP (Model Context Protocol) tools are external capability providers:

```typescript
// src/mcp/mcp-client.service.ts
@Injectable()
export class McpClientService {
  private clients: Map<string, MCPClient> = new Map();

  async getTools(serverName: string): Promise<Anthropic.Tool[]> {
    const client = await this.getOrConnect(serverName);
    const { tools } = await client.listTools();
    return this.convertToAnthropicTools(tools);
  }

  async executeTool(
    serverName: string,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    const client = await this.getOrConnect(serverName);
    const result = await client.callTool({ name: toolName, arguments: input });
    return result.content;
  }
}

// MCP servers registered:
// - product-catalog-mcp: search, filter, get product data
// - shipping-mcp: shipping options and rates
// - payment-mcp: Stripe payment processing
```

---

## Checkout Orchestrator Pattern

```typescript
@Injectable()
export class CheckoutOrchestratorService {
  async processMessage(
    sessionId: string,
    userMessage: string,
    user: User,
  ): Promise<AgentResponse> {
    // 1. Load session
    const session = await this.sessionRepository.findById(sessionId, {
      orgId: user.orgId, projectId: user.projectId,
    });

    // 2. Enforce limits
    if (session.actionsCount >= MAX_ACTIONS_PER_SESSION) {
      throw new BadRequestException('Session limit reached. Please start a new session.');
    }

    // 3. Get tools for current state
    const tools = this.getToolsForState(session.state);

    // 4. Build messages with history
    const messages = this.buildMessages(session.messages, userMessage);

    // 5. Run agent loop
    const result = await this.agentLoop.run(
      userMessage,
      tools,
      this.buildSystemPrompt(session),
      { sessionId, orgId: user.orgId, projectId: user.projectId, userId: user.id },
    );

    // 6. Update session
    await this.sessionRepository.updateById(sessionId, {
      messages: [...session.messages, { role: 'user', content: userMessage }, { role: 'assistant', content: result.text }],
      actionsCount: session.actionsCount + result.toolCalls.length,
      tokensUsed: session.tokensUsed + result.tokensUsed,
    });

    // 7. Emit audit event
    await this.kafkaService.emit('agent-message-processed', {
      sessionId, orgId: user.orgId, projectId: user.projectId,
      toolsUsed: result.toolCalls.map(t => t.name),
      tokensUsed: result.tokensUsed,
      timestamp: new Date().toISOString(),
      triggeredBy: user.id,
    });

    return { message: result.text, state: session.state, cart: session.cartItems };
  }
}
```

---

## Limits & Guards

```typescript
export const AGENT_COMMERCE_LIMITS = {
  MAX_ACTIONS_PER_SESSION: 50,      // total tool calls per checkout session
  MAX_ITERATIONS_PER_MESSAGE: 15,   // agent loop iterations per user message
  MAX_SESSION_AGE_HOURS: 24,        // sessions auto-expire
  MAX_CART_ITEMS: 20,               // max items in cart
  MAX_SPEND_PER_SESSION: 10000_00,  // $10,000 in cents (fraud prevention)
  MAX_TOKENS_PER_SESSION: 500_000,  // context budget per session
} as const;
```

---

## Post-Checkout Flow

```typescript
// On successful payment:
async completeCheckout(session: CheckoutSession, paymentResult: PaymentResult) {
  // 1. Update session state
  await this.updateSessionState(session.id, CheckoutState.COMPLETE);

  // 2. Emit checkout-completed (fans out to billing, audit, analytics)
  await this.kafkaService.emit('checkout-completed', {
    sessionId: session.id,
    orgId: session.orgId,
    projectId: session.projectId,
    userId: session.userId,
    orderId: paymentResult.orderId,
    amount: paymentResult.amountCents,
    items: session.cartItems,
    timestamp: new Date().toISOString(),
    triggeredBy: session.userId,
  });

  // billing-service consumes → creates invoice
  // audit-service consumes → records transaction
  // analytics-service consumes → updates conversion metrics
}
```
