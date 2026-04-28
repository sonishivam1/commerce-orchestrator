---
description: Agent commerce rules — auto-loads when editing the agent-commerce-service (agentic checkout with Claude AI, MCP, tool use)
globs:
  - "apps/agent-commerce-service/src/**/*.ts"
  - "apps/agent-commerce-service/**/*.ts"
---

# Agent Commerce Rules (Auto-loaded for agent-commerce-service files)

## Service Overview
The `agent-commerce-service` (port 3004) is the AI-powered checkout agent. It uses:
- **Anthropic Claude** (claude-sonnet-4-6) as the reasoning engine
- **Tool use / function calling** for structured agent actions
- **MCP (Model Context Protocol)** for external tool integrations
- **Checkout orchestration** to manage the multi-step purchase flow

## LLM Model
Default: `claude-sonnet-4-6`
For complex reasoning tasks: `claude-opus-4-6`
Never hardcode model strings — use a config constant.

## Tool Use Pattern
Tools are defined in `agent-tools.service.ts`. Follow this structure:
```typescript
// Tool definition
{
  name: 'search_products',
  description: 'Search for products matching user criteria. Use when user asks to find or browse products.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      filters: { type: 'object', description: 'Optional filters (price, category, etc.)' }
    },
    required: ['query']
  }
}
```

## Agent Loop Pattern
The agent loop in `agent-loop.service.ts`:
1. Receive user message
2. Call Claude with tools available
3. If Claude returns `tool_use` → execute the tool → append result → loop
4. If Claude returns `end_turn` or text → return to user
5. Max iterations limit (prevent infinite loops)

```typescript
// Always set a max iteration guard
const MAX_ITERATIONS = 10;
let iterations = 0;

while (iterations < MAX_ITERATIONS) {
  const response = await this.anthropic.messages.create({ ... });
  iterations++;
  if (response.stop_reason === 'end_turn') break;
  // process tool_use blocks
}
```

## Security Rules for Agent Code
1. **Prompt injection defense** — sanitize user input before including in prompts:
```typescript
// WRONG — direct user input in system prompt
const systemPrompt = `Help user: ${userMessage}`;

// CORRECT — user input only in human turn, system prompt is static
const messages = [{ role: 'human', content: userMessage }];
```

2. **Tool input validation** — validate every tool call input before executing:
```typescript
async executeTool(toolName: string, toolInput: unknown) {
  const validated = this.validateToolInput(toolName, toolInput); // always validate
  return this.tools[toolName](validated);
}
```

3. **Spending limits** — enforce per-session action limits:
```typescript
if (session.actionsCount >= MAX_ACTIONS_PER_SESSION) {
  throw new BadRequestException('Session action limit reached');
}
```

4. **Audit every action** — emit to audit-service for every tool execution:
```typescript
await this.kafkaService.emit('agent-action', {
  sessionId,
  orgId,
  projectId,
  toolName,
  toolInput: sanitizedInput,  // never log sensitive payment data
  timestamp: new Date().toISOString(),
});
```

## Checkout Orchestration
The `checkout-orchestrator.service.ts` manages the state machine:
- States: `BROWSING → CART → CHECKOUT → PAYMENT → COMPLETE`
- Never skip state transitions — validate current state before advancing
- Persist state to MongoDB (CheckoutSession schema)
- Emit Kafka event on each state transition

## MCP Integration
MCP server configs live in `src/mcp/`. When adding a new MCP tool:
1. Define it in the MCP server config
2. Register it in `agent-tools.service.ts`
3. Add input validation
4. Add audit logging
5. Add to the agent's tool list in the orchestrator

## Streaming Responses
Always stream agent responses to the frontend — never wait for full completion:
```typescript
// Use SSE (packages/sse) for streaming
// Stream partial text chunks as they arrive from Claude
// Send tool execution status updates to the frontend
```

## Error Recovery
Agent errors should be recoverable — never crash the session:
```typescript
try {
  result = await this.executeTool(toolName, toolInput);
} catch (error) {
  this.logger.error(`Tool ${toolName} failed`, error);
  // Return error context to Claude so it can retry or inform the user
  result = { error: `Tool execution failed: ${error.message}` };
  // Do NOT re-throw — let Claude handle it
}
```
