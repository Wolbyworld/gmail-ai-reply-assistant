# Backend Connection Specification

Base URL: `https://luzia-backend-e1d9fb64f0d0.herokuapp.com`

Full API documentation: See `API.md` in the backend repo.

---

## Quick Start

### Endpoint

```
POST https://luzia-backend-e1d9fb64f0d0.herokuapp.com/v1/responses
```

### Authentication

Every request **must** include:

```
X-Luzia-Secret: <shared-secret>
```

---

## Request Format

```json
{
  "model": "gpt-4.1-mini",
  "instructions": "You are a helpful assistant that corrects grammar and spelling.",
  "input": "The text to process goes here",
  "max_output_tokens": 4096,
  "temperature": 0.7,
  "reasoning": {
    "effort": "high"
  }
}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `model` | string | No | `gpt-5-mini` | Model to use |
| `input` | string | Yes | - | User input text |
| `instructions` | string | No | `""` | System prompt |
| `max_output_tokens` | integer | No | - | Max response tokens |
| `temperature` | float | No | - | Sampling temperature (0-2) |
| `reasoning.effort` | string | No | - | Reasoning effort level |

---

## Response Format

```json
{
  "id": "resp_abc123",
  "object": "response",
  "model": "gpt-4.1-mini",
  "output_text": "The corrected text appears here",
  "usage": {
    "input_tokens": 150,
    "output_tokens": 45
  }
}
```

The result is in **`output_text`**.

---

## Available Models

### OpenAI Models

| Model | Cost | Description |
|-------|------|-------------|
| `gpt-5-nano` | Cheapest | Fastest |
| `gpt-5-mini` | Low | Good balance (default) |
| `gpt-5` | Medium | Most capable |
| `gpt-4.1-mini` | Medium | Previous generation |
| `gpt-4.1` | Higher | High capability |

### Groq Models (Very Fast)

| Model | Cost | Description |
|-------|------|-------------|
| `openai/gpt-oss-20b` | Very cheap | Fast and capable |
| `openai/gpt-oss-120b` | Cheap | More capable, still fast |

---

## Reasoning Effort

Control how much effort the model puts into reasoning:

```json
{
  "reasoning": {
    "effort": "high"
  }
}
```

### Values by Provider

**OpenAI models:** Supports full OpenAI reasoning config (pass through)

**Groq models (`openai/gpt-oss-*`):**
- `"low"` - Minimal reasoning, fastest
- `"medium"` - Balanced
- `"high"` - Maximum reasoning, most thorough

---

## Example (JavaScript)

```javascript
const response = await fetch('https://luzia-backend-e1d9fb64f0d0.herokuapp.com/v1/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Luzia-Secret': 'your-shared-secret-here'
  },
  body: JSON.stringify({
    model: 'gpt-4.1-mini',
    instructions: 'Fix grammar and spelling errors in the following email. Return only the corrected text.',
    input: emailTextToCorrect,
    max_output_tokens: 4096
  })
});

const data = await response.json();
const correctedText = data.output_text;
```

---

## Error Handling

| Status | Meaning |
|--------|---------|
| `400` | Invalid JSON body |
| `401` | Missing/invalid `X-Luzia-Secret` |
| `429` | Rate limit exceeded (1000 req/hour) |
| `502` | Upstream API error |
| `504` | Timeout (60s limit) |

---

## Integration Checklist

1. Set endpoint URL to `/v1/responses`
2. Add `X-Luzia-Secret` header
3. Send JSON body with at least `input` field
4. Read response from `output_text` field
5. Handle 401/429 errors gracefully
