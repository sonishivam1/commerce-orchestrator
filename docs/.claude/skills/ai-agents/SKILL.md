---
name: ai-agents
description: AI agent design and implementation skill for Metafy AI Platform. Encodes the agent loop pattern, tool design, multi-step planning, memory/context management, MCP integration, error recovery, evaluation, and the correct way to build reliable agents on top of Claude.
user-invocable: true
---

# AI Agents Skill — Metafy AI Platform

## Agent Architecture Overview

```
User Input
    ↓
[Agent Orchestrator]  ← Manages loop, state, context window
    ↓
[Claude Sonnet 4.6]   ← Reasoning engine
    ↓
[Tool Router]         ← Dispatches tool calls
    ↓  ↓  ↓  ↓
[Tool A] [Tool B] [Tool C] [MCP Server]
    ↓
[Tool Results] → back to Claude → repeat until end_turn
    ↓
Final Response → User
```

---

## Tool Design Principles

### 1. One Tool, One Responsibility
```typescript
// WRONG — too broad, Claude doesn't know when to use it
{ name: 'handle_commerce', description: 'Handle all commerce operations' }

// CORRECT — specific, Claude knows exactly when to use each
{ name: 'search_products', description: 'Search the product catalog by query and filters' }
{ name: 'get_product_details', description: 'Get full details for a specific product ID' }
{ name: 'add_to_cart', description: 'Add a product to the current checkout cart' }
{ name: 'process_payment', description: 'Process payment for the current cart' }
```

### 2. Write Descriptions for the Model, Not Humans
```typescript
{
  name: 'search_products',
  // The description is the model's instruction manual — be explicit about when to use it
  description: `Search the product catalog for items matching user criteria.
Use this when the user asks to find, browse, or look for products.
Do NOT use this for getting details about a specific known product ID — use get_product_details instead.
Returns: array of products with id, name, price, and availability.`,
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query from the user',
      },
      maxPrice: {
        type: 'number',
        description: 'Maximum price in dollars. Only include if user mentioned a price limit.',
      },
      category: {
        type: 'string',
        enum: ['electronics', 'clothing', 'home', 'sports'],
        description: 'Product category filter. Only include if user specified a category.',
      },
    },
    required: ['query'],
  },
}
```

### 3. Validate All Tool Inputs Before Execution
```typescript
async executeTool(toolName: string, rawInput: unknown, context: AgentContext) {
  // Validate against schema first
  const validated = this.validateInput(toolName, rawInput);
  if (!validated.success) {
    return { error: `Invalid tool input: ${validated.error}` };
    // Return error to Claude — let it self-correct, don't throw
  }

  // Apply security guards
  this.assertToolAllowed(toolName, context);

  // Execute
  return this.tools[toolName](validated.data, context);
}
```

---

## Agent Loop Implementation

```typescript
@Injectable()
export class AgentLoopService {
  private readonly MAX_ITERATIONS = 15;
  private readonly MAX_TOKENS_PER_CALL = 4096;

  async run(
    userMessage: string,
    tools: Anthropic.Tool[],
    systemPrompt: string,
    context: AgentContext,
  ): Promise<AgentResult> {
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: userMessage },
    ];

    const toolCalls: ToolCallRecord[] = [];
    let iterationsUsed = 0;

    for (let i = 0; i < this.MAX_ITERATIONS; i++) {
      iterationsUsed++;

      const response = await this.callClaude(messages, tools, systemPrompt);

      // Track token usage
      this.trackUsage(response.usage, context);

      if (response.stop_reason === 'end_turn') {
        const text = this.extractText(response);
        return { text, toolCalls, iterationsUsed, completed: true };
      }

      if (response.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: response.content });

        const toolResults = await this.executeToolCalls(
          response.content.filter(isToolUse),
          context,
        );

        toolCalls.push(...toolResults.map(r => r.record));
        messages.push({ role: 'user', content: toolResults.map(r => r.result) });
        continue;
      }

      // Unexpected stop reason
      this.logger.warn('Unexpected stop_reason', { stop_reason: response.stop_reason });
      break;
    }

    // Hit iteration limit — return partial result
    this.logger.warn('Agent loop hit MAX_ITERATIONS', {
      sessionId: context.sessionId,
      orgId: context.orgId,
      iterationsUsed,
    });

    return {
      text: 'I was unable to complete the task. Please try rephrasing your request.',
      toolCalls,
      iterationsUsed,
      completed: false,
    };
  }
}
```

---

## Context Window Management

```typescript
// Monitor context window usage
const CONTEXT_LIMIT = 180_000; // Claude Sonnet 4.6 limit
const SAFETY_THRESHOLD = 0.85; // warn at 85%

if (totalInputTokens > CONTEXT_LIMIT * SAFETY_THRESHOLD) {
  this.logger.warn('Approaching context window limit', {
    used: totalInputTokens,
    limit: CONTEXT_LIMIT,
    sessionId: context.sessionId,
  });

  // Summarize old messages to free up context
  messages = await this.summarizeHistory(messages);
}
```

---

## Planning Agent Pattern

For complex multi-step tasks, use a planner-executor pattern:

```typescript
// Step 1: Ask Claude to make a plan (no tools yet)
const plan = await this.callClaude(messages, [], PLANNER_SYSTEM_PROMPT);

// Step 2: Execute each plan step with tools
for (const step of parsePlan(plan)) {
  const stepResult = await this.agentLoop.run(step.instruction, tools, EXECUTOR_PROMPT, context);
  results.push(stepResult);

  // Early termination if step failed
  if (!stepResult.completed) break;
}
```

---

## Memory & State

```typescript
// Short-term: conversation messages array (in-memory, per session)
// Medium-term: session state in Redis (survives between requests)
// Long-term: important facts extracted to MongoDB (user preferences, past purchases)

@Injectable()
export class AgentMemoryService {
  async saveSessionState(sessionId: string, state: CheckoutSessionState) {
    await this.cache.set(
      `agent:session:${sessionId}`,
      state,
      3600, // 1 hour TTL
    );
  }

  async extractAndSavePreferences(
    messages: Anthropic.MessageParam[],
    orgId: string,
    userId: string,
  ) {
    // Ask Claude to extract user preferences from conversation
    const preferences = await this.callClaude(
      messages,
      [],
      PREFERENCE_EXTRACTION_PROMPT,
    );
    // Save to MongoDB for future sessions
    await this.preferenceRepository.upsert({ orgId, userId, preferences });
  }
}
```

---

## Agent Evaluation (Testing Quality)

```typescript
// Eval dataset — expected behavior for given inputs
const AGENT_EVALS = [
  {
    input: 'Find me red running shoes under $100',
    expectedToolsCalled: ['search_products'],
    expectedToolArgs: { query: 'red running shoes', maxPrice: 100 },
    mustNotCallTools: ['process_payment'],
  },
  {
    input: 'Complete my purchase',
    cartMustHaveItems: true,
    expectedToolsCalled: ['process_payment'],
  },
];

// Run evals in CI
describe('Agent behavior evals', () => {
  it.each(AGENT_EVALS)('handles "$input" correctly', async (eval) => {
    const result = await agentService.run(eval.input, testContext);
    expect(result.toolCalls.map(t => t.name)).toContain(...eval.expectedToolsCalled);
  });
});
```

---

## Security Checklist for Agents

- [ ] System prompt is static — user input never modifies system prompt
- [ ] All tool inputs validated against schema before execution
- [ ] Sensitive tools (payment, delete) require additional confirmation step
- [ ] Per-session spending limit enforced
- [ ] Per-session action limit enforced (MAX_ITERATIONS)
- [ ] All tool executions logged to audit-service
- [ ] Agent cannot access other orgs' data (tenant scoping in all tools)
- [ ] LLM output parsed and validated before acting on it
