---
name: aeo-prompt
description: AEO (AI Experience Optimization) prompt engineering skill. Encodes the patterns, structures, and evaluation criteria for prompts that analyze and optimize content for AI-powered search surfaces (ChatGPT, Perplexity, Google AI, etc.). Invoke when building AEO analysis, content scoring, or optimization features in aeo-service.
user-invocable: true
---

# AEO Prompt Engineering Skill — Metafy AI Platform

This skill encodes the domain knowledge required to build prompts that analyze and optimize content for AI-powered discovery surfaces.

---

## What AEO Means for Metafy

AEO = getting brands/products **cited and recommended** by LLM-powered search (ChatGPT, Perplexity, Google AI Overview, Claude, etc.).

The `aeo-service` (port 3003) analyzes:
1. **Brand mention probability** — how likely is an LLM to recommend this brand?
2. **Content structure quality** — is the content structured for LLM retrieval?
3. **Schema markup completeness** — structured data for rich AI results
4. **Competitive positioning** — how does this brand rank vs competitors in LLM responses?
5. **Query coverage** — which user queries would surface this brand?

---

## AEO Content Analysis Prompt Template

```typescript
export const AEO_CONTENT_ANALYSIS_PROMPT = `
You are an AI Experience Optimization (AEO) expert. Analyze the provided content and evaluate how well it would perform when cited or recommended by AI assistants like ChatGPT, Perplexity, or Google AI Overview.

Evaluate across these dimensions:

1. FACTUAL CLARITY (0-100)
   - Are key facts stated explicitly and unambiguously?
   - Would an AI be confident citing specific claims from this content?
   - Are numbers, statistics, and dates present and verifiable?

2. ENTITY RECOGNITION (0-100)
   - Is the brand/product name consistently and clearly mentioned?
   - Are people, places, and organizations named explicitly?
   - Would an AI correctly identify the primary subject?

3. QUESTION COVERAGE (0-100)
   - Does the content answer specific user questions?
   - Are common "who/what/when/where/why/how" questions answered?
   - Does it cover the top-of-funnel research questions users ask AI?

4. STRUCTURE & SCANNABILITY (0-100)
   - Is information organized with clear headings?
   - Are key points summarizable in 1-2 sentences?
   - Would an AI be able to extract a concise answer from this?

5. AUTHORITY SIGNALS (0-100)
   - Does content demonstrate expertise (specific details, unique insights)?
   - Are credentials, awards, or third-party validations present?
   - Is there evidence the brand is a recognized authority?

Return ONLY valid JSON in this exact format:
{
  "overallScore": <number 0-100>,
  "dimensions": {
    "factualClarity": { "score": <number>, "reasoning": "<string>", "improvements": ["<string>"] },
    "entityRecognition": { "score": <number>, "reasoning": "<string>", "improvements": ["<string>"] },
    "questionCoverage": { "score": <number>, "reasoning": "<string>", "improvements": ["<string>"] },
    "structureScannability": { "score": <number>, "reasoning": "<string>", "improvements": ["<string>"] },
    "authoritySignals": { "score": <number>, "reasoning": "<string>", "improvements": ["<string>"] }
  },
  "topImprovements": ["<string>", "<string>", "<string>"],
  "aeoSummary": "<2-3 sentence overall assessment>"
}
`;
```

---

## AEO Competitive Analysis Prompt

```typescript
export const AEO_COMPETITIVE_PROMPT = `
You are an AEO competitive intelligence analyst. Given a brand and a list of competitors, assess how each would perform when an AI assistant answers relevant user queries.

Evaluate each brand on:
- Likelihood an AI would recommend them for the query
- Strength of their information signals (detailed, citable content)
- Brand authority and recognition in this space
- Content gaps the analyzed brand could exploit

Return JSON:
{
  "query": "<the analyzed query>",
  "rankings": [
    {
      "brand": "<name>",
      "aeoScore": <0-100>,
      "strengths": ["<string>"],
      "weaknesses": ["<string>"]
    }
  ],
  "opportunityGaps": ["<string>"],
  "recommendedActions": ["<string>"]
}
`;
```

---

## AEO Query Generation Prompt

```typescript
export const AEO_QUERY_GENERATION_PROMPT = `
You are an AEO strategist. Given a brand/product description, generate the user queries where this brand should appear in AI-powered search results.

Generate queries across these intents:
- AWARENESS: "What is the best X for Y?"
- COMPARISON: "X vs Y — which is better?"
- DECISION: "Should I use X for Y?"
- FEATURE: "Does X support Y feature?"
- USE CASE: "How do I use X for Y scenario?"

Return JSON:
{
  "highPriorityQueries": ["<query>"],   // 5 queries most likely to convert
  "mediumPriorityQueries": ["<query>"], // 5 informational queries
  "longTailQueries": ["<query>"]        // 5 specific niche queries
}
`;
```

---

## AEO Score Interpretation

| Score | Grade | Meaning |
|-------|-------|---------|
| 85-100 | A | Highly optimized — AI will confidently cite this |
| 70-84 | B | Good — AI may cite, some gaps to close |
| 55-69 | C | Average — competes with generic content |
| 40-54 | D | Weak — unlikely to be cited over competitors |
| 0-39 | F | Poor — AI will skip or misrepresent this content |

---

## Common AEO Issues to Detect

```typescript
export const AEO_ISSUE_PATTERNS = {
  NO_EXPLICIT_BRAND_MENTION: 'Brand name not mentioned in first 100 words',
  VAGUE_CLAIMS: 'Claims like "best" or "leading" without supporting evidence',
  NO_SPECIFIC_NUMBERS: 'Missing quantifiable data points (pricing, metrics, specs)',
  POOR_STRUCTURE: 'No H2/H3 headings — content not scannable by AI',
  MISSING_FAQ: 'No FAQ section — misses conversational query coverage',
  NO_COMPARISON: 'Never compared to alternatives — misses "vs" queries',
  JARGON_HEAVY: 'Industry jargon without plain-language explanation',
  PASSIVE_VOICE: 'Excessive passive voice reduces direct citeability',
};
```

---

## Implementation Pattern in aeo-service

```typescript
@Injectable()
export class AeoAnalysisService {
  async analyzeContent(
    content: string,
    user: User,
  ): Promise<AeoAnalysisResult> {
    // 1. Call LLM with analysis prompt
    const raw = await this.llmService.complete({
      model: LLM_MODELS.OPENAI_DEFAULT,
      system: AEO_CONTENT_ANALYSIS_PROMPT,
      user: `Analyze this content:\n\n${content}`,
      temperature: 0.1,   // low — we want consistent, analytical output
      max_tokens: 2048,
      response_format: 'json',
    });

    // 2. Parse and validate response
    const result = this.parseAndValidateAeoResult(raw);

    // 3. Persist result
    await this.aeoResultRepository.create({
      ...result,
      orgId: user.orgId,
      projectId: user.projectId,
      createdBy: user.id,
      updatedBy: user.id,
      contentHash: this.hashContent(content),  // for deduplication
    });

    // 4. Emit analytics event
    await this.kafkaService.emit('aeo-analysis-completed', {
      orgId: user.orgId,
      projectId: user.projectId,
      overallScore: result.overallScore,
      timestamp: new Date().toISOString(),
      triggeredBy: user.id,
    });

    return result;
  }
}
```

---

## Checklist for AEO Features
- [ ] Prompt is system-level static (no user content in system prompt)
- [ ] Output is always JSON with validated schema
- [ ] Temperature ≤ 0.2 for analysis tasks (need consistency)
- [ ] Results persisted to MongoDB with tenant scope
- [ ] Analytics event emitted after analysis
- [ ] Score is capped 0-100 and validated before persistence
- [ ] Content hashed to detect duplicate analysis requests
- [ ] LLM response validated before parsing (handle malformed JSON)
