---
name: llm-integration
description: LLM integration skill for Metafy AI Platform. Encodes the correct patterns for calling OpenAI, Anthropic Claude, Google Gemini, Perplexity, and Grok across the AEO and agent-commerce services. Covers model selection, prompt structure, tool use, streaming, error handling, and cost control. Invoke when adding any AI/LLM feature.
user-invocable: true
---

# LLM Integration Skill — Metafy AI Platform

This skill encodes the correct patterns for integrating LLMs across AEO, agent-commerce, and any service that calls an AI provider.

---

## Provider & Model Selection

| Use Case | Provider | Model | Why |
|----------|----------|-------|-----|
| Complex reasoning, agent loops | Anthropic | `claude-sonnet-4-6` | Best tool use, reasoning |
| Fast classification, tagging | Anthropic | `claude-haiku-4-5-20251001` | Speed + cost |
| AEO content analysis | OpenAI | `gpt-4o` | Strong content understanding |
| Perplexity-style web search | Perplexity | `llama-3.1-sonar-large` | Real-time web grounding |
| Multimodal (images) | Google | `gemini-2.0-flash` | Vision + speed |
| General generation fallback | Grok | `grok-2` | X/Twitter data grounding |

**Default for new features:** `claude-sonnet-4-6`
Never hardcode model strings — always use config constants.

```typescript
// config/llm.constants.ts
export const LLM_MODELS = {
  DEFAULT: 'claude-sonnet-4-6',
  FAST: 'claude-haiku-4-5-20251001',
  POWERFUL: 'claude-opus-4-6',
  OPENAI_DEFAULT: 'gpt-4o',
  OPENAI_FAST: 'gpt-4o-mini',
} as const;
```

---

## Anthropic Claude — Tool Use Pattern

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { LLM_MODELS } from '../config/llm.constants';

@Injectable()
export class AgentService {
  private readonly anthropic: Anthropic;
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly configService: ConfigService) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.get('ANTHROPIC_API_KEY'),
    });
  }

  async runAgentLoop(
    userMessage: string,
    tools: Anthropic.Tool[],
    context: { orgId: string; projectId: string; sessionId: string },
  ): Promise<string> {
    const MAX_ITERATIONS = 10;
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: userMessage },
    ];

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await this.anthropic.messages.create({
        model: LLM_MODELS.DEFAULT,
        max_tokens: 4096,
        system: this.buildSystemPrompt(context),
        tools,
        messages,
      });

      // Handle tool use
      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolCall of toolUseBlocks) {
          const result = await this.executeTool(toolCall, context);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }

        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // End turn — extract final text
      const textBlock = response.content.find(b => b.type === 'text');
      return textBlock?.text ?? '';
    }

    this.logger.warn(`Agent loop hit MAX_ITERATIONS for session ${context.sessionId}`);
    return 'I was unable to complete the task within the allowed steps.';
  }

  private buildSystemPrompt(context: Record<string, string>): string {
    // System prompt is STATIC — user input never goes here
    return `You are a helpful shopping assistant for Metafy.
Your goal is to help users find and purchase products.
Session ID: ${context.sessionId}`;
  }
}
```

---

## Streaming Pattern (Server-Sent Events)

```typescript
// For streaming responses to the frontend via SSE
async streamResponse(userMessage: string, res: Response): Promise<void> {
  const stream = await this.anthropic.messages.stream({
    model: LLM_MODELS.DEFAULT,
    max_tokens: 2048,
    messages: [{ role: 'user', content: userMessage }],
  });

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
    }
  }

  res.write('data: [DONE]\n\n');
  res.end();
}
```

---

## OpenAI Pattern

```typescript
import OpenAI from 'openai';

@Injectable()
export class AeoAnalysisService {
  private readonly openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get('OPENAI_API_KEY'),
    });
  }

  async analyzeContent(content: string): Promise<AeoAnalysisResult> {
    const response = await this.openai.chat.completions.create({
      model: LLM_MODELS.OPENAI_DEFAULT,
      messages: [
        {
          role: 'system',
          content: 'You are an AEO content analysis expert. Analyze the provided content and return structured JSON.',
        },
        {
          role: 'user',
          // User content goes in the human turn — never the system prompt
          content: `Analyze this content for AEO optimization:\n\n${content}`,
        },
      ],
      response_format: { type: 'json_object' }, // structured output
      temperature: 0.2,  // low temperature for analysis tasks
      max_tokens: 1024,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty LLM response');

    return JSON.parse(raw) as AeoAnalysisResult;
  }
}
```

---

## Prompt Engineering Rules

### 1. System prompt is STATIC — user content goes in the human turn
```typescript
// CORRECT
messages: [
  { role: 'system', content: 'You are a shopping assistant.' },
  { role: 'user', content: userInput },  // user input isolated here
]

// WRONG — prompt injection risk
messages: [
  { role: 'system', content: `You are a shopping assistant. User says: ${userInput}` },
]
```

### 2. Be explicit about output format
```typescript
// Tell the model exactly what you want
system: `You must respond with valid JSON in this exact format:
{
  "score": number (0-100),
  "issues": string[],
  "recommendations": string[]
}
Do not include any text outside the JSON object.`
```

### 3. Temperature guide
```
0.0 - 0.2   → Classification, extraction, structured output, analysis
0.3 - 0.6   → Balanced — rewriting, summarization
0.7 - 1.0   → Creative — marketing copy, brainstorming
```

### 4. Keep prompts versioned
```typescript
// prompts/aeo-analysis.prompt.ts
export const AEO_ANALYSIS_PROMPT_V2 = `...`;
// Versioned so you can A/B test prompt changes
```

---

## Error Handling

```typescript
async callLLM(prompt: string): Promise<string> {
  try {
    const response = await this.anthropic.messages.create({ ... });
    return response.content[0]?.text ?? '';
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        // Rate limited — implement exponential backoff via BullMQ retry
        throw new ServiceUnavailableException('AI service temporarily unavailable');
      }
      if (error.status === 400) {
        // Bad request — likely prompt issue
        this.logger.error('LLM bad request', error.message);
        throw new InternalServerErrorException('AI processing failed');
      }
    }
    this.logger.error('LLM call failed', error);
    throw new InternalServerErrorException('AI service error');
  }
}
```

---

## Cost Control

```typescript
// Always set max_tokens — never leave it unlimited
max_tokens: 1024,     // short responses (classification, tags)
max_tokens: 2048,     // medium responses (analysis, summaries)
max_tokens: 4096,     // long responses (full content generation)

// Use the cheapest model that meets quality requirements
// Haiku for: classification, tagging, short extraction
// Sonnet for: reasoning, tool use, multi-step tasks
// Opus for: complex analysis only when Sonnet isn't sufficient

// Log token usage for cost tracking
this.logger.debug(`LLM usage: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`);
```

---

## Checklist for Any New LLM Feature
- [ ] Model selected from `LLM_MODELS` constants (not hardcoded string)
- [ ] API key from `ConfigService` (not `process.env` directly)
- [ ] User input in human turn (never system prompt)
- [ ] `max_tokens` set appropriately
- [ ] `temperature` appropriate for task type
- [ ] Error handling covers 429 (rate limit) and 400 (bad request)
- [ ] Token usage logged for cost visibility
- [ ] Streaming used for responses > 2 seconds latency
- [ ] Agent loops have `MAX_ITERATIONS` guard
- [ ] Tool inputs validated before execution
- [ ] Prompt injection protection in place
