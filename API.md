# Luzia Backend API Documentation

Base URL: `https://luzia-backend-e1d9fb64f0d0.herokuapp.com`

---

## Authentication

All requests to `/v1/responses` require the `X-Luzia-Secret` header:

```
X-Luzia-Secret: <shared-secret>
```

Requests without a valid secret return `401 Unauthorized`.

---

## Endpoints

### POST /v1/responses

Main proxy endpoint for LLM completions. Accepts OpenAI Responses API format and routes to the appropriate provider.

#### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | Must be `application/json` |
| `X-Luzia-Secret` | Yes | Authentication secret |

#### Request Body

```json
{
  "model": "gpt-4.1-mini",
  "instructions": "System prompt goes here",
  "input": "User input text",
  "max_output_tokens": 4096,
  "temperature": 0.7,
  "reasoning": {
    "effort": "high"
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `model` | string | No | `gpt-5-mini` | Model to use (see Available Models) |
| `input` | string | Yes | - | The user input/prompt text |
| `instructions` | string | No | `""` | System instructions/prompt |
| `max_output_tokens` | integer | No | - | Maximum tokens in response |
| `temperature` | float | No | - | Sampling temperature (0-2) |
| `reasoning` | object | No | - | Reasoning configuration |
| `reasoning.effort` | string | No | - | Reasoning effort level |

#### Response

```json
{
  "id": "resp_abc123",
  "object": "response",
  "model": "gpt-4.1-mini",
  "output_text": "The model's response text",
  "usage": {
    "input_tokens": 150,
    "output_tokens": 45
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique response identifier |
| `object` | string | Always `"response"` |
| `model` | string | Model used for completion |
| `output_text` | string | The generated text response |
| `usage.input_tokens` | integer | Tokens in the input |
| `usage.output_tokens` | integer | Tokens in the output |

---

### GET /health

Health check endpoint (no authentication required).

#### Response

```json
{
  "status": "ok",
  "timestamp": "2026-01-16T12:00:00.000000"
}
```

---

### GET /admin/stats

Analytics endpoint for monitoring usage.

#### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-Admin-Secret` | Yes | Admin authentication secret |

#### Response

```json
{
  "total_requests": 1500,
  "total_cost_usd": 2.5432,
  "total_tokens_in": 150000,
  "total_tokens_out": 45000,
  "avg_latency_ms": 850.5,
  "by_model": [
    {
      "model": "gpt-4.1-mini",
      "requests": 1000,
      "cost_usd": 1.5,
      "total_tokens": 120000
    }
  ]
}
```

---

## Available Models

### OpenAI Models (via OpenAI API)

| Model | Input $/1M | Output $/1M | Description |
|-------|------------|-------------|-------------|
| `gpt-5-nano` | $0.50 | $2.00 | Fastest, cheapest |
| `gpt-5-mini` | $1.00 | $4.00 | Good balance (default) |
| `gpt-5` | $3.00 | $12.00 | Most capable |
| `gpt-4.1-mini` | $5.00 | $15.00 | Previous generation |
| `gpt-4.1` | $10.00 | $30.00 | Previous gen, high capability |

### Groq Models (via Groq API)

| Model | Input $/1M | Output $/1M | Description |
|-------|------------|-------------|-------------|
| `openai/gpt-oss-20b` | $0.075 | $0.30 | Very fast, cheap |
| `openai/gpt-oss-120b` | $0.15 | $0.60 | Fast, more capable |

---

## Reasoning Effort

The `reasoning` parameter controls how much effort the model puts into reasoning through problems.

### OpenAI Models

Supports the full OpenAI reasoning configuration. Pass through as-is:

```json
{
  "model": "gpt-5",
  "reasoning": {
    "effort": "high"
  }
}
```

### Groq Models

Supported values for `openai/gpt-oss-20b` and `openai/gpt-oss-120b`:

| Value | Description |
|-------|-------------|
| `"low"` | Minimal reasoning tokens, fastest response |
| `"medium"` | Moderate reasoning, balanced |
| `"high"` | Maximum reasoning, most thorough |

Example:

```json
{
  "model": "openai/gpt-oss-120b",
  "reasoning": {
    "effort": "high"
  },
  "input": "Solve this complex problem..."
}
```

---

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| `400` | `Invalid JSON body` | Request body is not valid JSON |
| `401` | `Unauthorized` | Missing or invalid `X-Luzia-Secret` |
| `429` | `Rate limit exceeded` | Global rate limit (1000/hour) exceeded |
| `500` | `Server configuration error` | API keys not configured |
| `502` | `API error: ...` | Upstream API request failed |
| `504` | `API timeout` | Upstream API took >60s |

Error response format:

```json
{
  "error": "Error message here"
}
```

---

## Rate Limiting

- **Global limit:** 1000 requests per hour
- Shared across all clients
- Returns `429` when exceeded

---

## Example Requests

### JavaScript (fetch)

```javascript
const response = await fetch('https://luzia-backend-e1d9fb64f0d0.herokuapp.com/v1/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Luzia-Secret': 'your-secret-here'
  },
  body: JSON.stringify({
    model: 'gpt-4.1-mini',
    instructions: 'Fix grammar and spelling errors. Return only the corrected text.',
    input: 'The text to correct goes here',
    max_output_tokens: 4096
  })
});

const data = await response.json();
console.log(data.output_text);
```

### cURL

```bash
curl -X POST https://luzia-backend-e1d9fb64f0d0.herokuapp.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "X-Luzia-Secret: your-secret-here" \
  -d '{
    "model": "openai/gpt-oss-120b",
    "instructions": "You are a helpful assistant.",
    "input": "Hello, how are you?",
    "reasoning": {"effort": "medium"}
  }'
```

### Python (requests)

```python
import requests

response = requests.post(
    'https://luzia-backend-e1d9fb64f0d0.herokuapp.com/v1/responses',
    headers={
        'Content-Type': 'application/json',
        'X-Luzia-Secret': 'your-secret-here'
    },
    json={
        'model': 'gpt-5-mini',
        'instructions': 'Summarize the following text.',
        'input': 'Long text to summarize...',
        'max_output_tokens': 500
    }
)

data = response.json()
print(data['output_text'])
```

---

## Changelog

- **2026-01-16:** Added `reasoning.effort` support for Groq models
- **2026-01-15:** Initial release with OpenAI and Groq support
