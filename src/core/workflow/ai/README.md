# AI Module - Unshallow OpenAI Chat Factory

This module provides a factory for creating custom ChatOpenAI models that extend LangChain's functionality with configuration management, Langfuse tracking integration, and structured output support.

## Usage

### Basic Usage

```typescript
import { UnshallowOpenAIChatFactory } from './ai';
import { ConfigurationManager } from '../config';

// Load configuration to get API key
const configManager = new ConfigurationManager();
const envConfig = await configManager.loadEnvironmentConfig();

// Create a mini model (default)
const model = UnshallowOpenAIChatFactory.create({
  apiKey: envConfig.apiKeys.openai
});

// Invoke the model directly
const response = await model.invoke("What is 2+2?");
console.log(response.content);
```

### With Configuration

```typescript
// Create a nano model with custom temperature
const nanoModel = UnshallowOpenAIChatFactory.create({
  apiKey: envConfig.apiKeys.openai,
  tier: 'nano',
  temperature: 0.5,
  maxTokens: 2048
});

// Create a full model with Langfuse tracking
const fullModel = UnshallowOpenAIChatFactory.create({
  apiKey: envConfig.apiKeys.openai,
  tier: 'full',
  langfuseId: 'trace-123',
  temperature: 0.7
});

// Create a model with structured output (JSON response format)
const structuredModel = UnshallowOpenAIChatFactory.create({
  apiKey: envConfig.apiKeys.openai,
  tier: 'mini',
  structuredOutput: true
});
```

### Convenience Methods

```typescript
// Create specific tier models
const nano = UnshallowOpenAIChatFactory.createNano({
  apiKey: envConfig.apiKeys.openai
});
const mini = UnshallowOpenAIChatFactory.createMini({
  apiKey: envConfig.apiKeys.openai
});
const full = UnshallowOpenAIChatFactory.createFull({
  apiKey: envConfig.apiKeys.openai
});

// Create structured output models
const structuredNano = UnshallowOpenAIChatFactory.createNanoStructured({
  apiKey: envConfig.apiKeys.openai
});
const structuredMini = UnshallowOpenAIChatFactory.createMiniStructured({
  apiKey: envConfig.apiKeys.openai
});
const structuredFull = UnshallowOpenAIChatFactory.createFullStructured({
  apiKey: envConfig.apiKeys.openai
});
```

## Model Tiers

- **nano**: `gpt-4o-nano` - Fast, cost-effective for simple tasks (temp: 0.1, tokens: 8192)
- **mini**: `gpt-4o-mini` - Balanced for most workflows (temp: 0.1, tokens: 16384) - DEFAULT
- **full**: `gpt-4o` - Most capable for complex tasks (temp: 0.1, tokens: 32768)

## Features

### Structured Output

Enable structured output (JSON response format) by setting `structuredOutput: true`:

```typescript
const model = UnshallowOpenAIChatFactory.create({
  apiKey: envConfig.apiKeys.openai,
  structuredOutput: true
});

// The model will now return JSON-formatted responses
const response = await model.invoke("List 3 colors in JSON format");
// Response will be guaranteed to be valid JSON
```

### Langfuse Tracking

Add observability with Langfuse tracking:

```typescript
const model = UnshallowOpenAIChatFactory.create({
  apiKey: envConfig.apiKeys.openai,
  langfuseId: 'my-trace-id-123'
});

// All invocations will be tracked with the provided trace ID
```

## Integration with LangChain

The factory returns enhanced `ChatOpenAI` instances with custom `_generate` method interception for Langfuse tracking. All other LangChain features are fully supported through method proxying:

```typescript
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const model = UnshallowOpenAIChatFactory.create({
  apiKey: envConfig.apiKeys.openai
});

// Use with messages
const response = await model.invoke([
  new SystemMessage("You are a helpful assistant"),
  new HumanMessage("Hello!")
]);

// Use in chains
const chain = model.pipe(outputParser);

// Use with streaming
const stream = await model.stream("Tell me a story");
for await (const chunk of stream) {
  console.log(chunk.content);
}
```

## Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `apiKey` | `string` | **Required** - OpenAI API key from configuration |
| `tier` | `'nano' \| 'mini' \| 'full'` | Model tier selection (default: 'mini') |
| `temperature` | `number` | Model temperature (defaults by tier) |
| `maxTokens` | `number` | Maximum tokens (defaults by tier) |
| `baseURL` | `string` | Custom OpenAI API endpoint |
| `langfuseId` | `string` | Langfuse trace ID for observability |
| `structuredOutput` | `boolean` | Enable JSON response format |

## Architecture

The implementation uses a proxy pattern to intercept the `_generate` method (the low-level API call method) while forwarding all other methods to the internal LangChain `ChatOpenAI` instance. This ensures:

- **Full compatibility**: All LangChain features work seamlessly
- **Proper tracking**: Langfuse tracking at the right abstraction level
- **Clean separation**: Custom logic isolated from LangChain internals
- **Performance**: Minimal overhead with efficient proxying

This ensures that all API keys are managed through the configuration system rather than environment variables.