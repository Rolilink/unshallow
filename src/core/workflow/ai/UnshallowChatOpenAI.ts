import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage } from '@langchain/core/messages';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { ChatResult } from '@langchain/core/outputs';

export type ModelName = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4o-nano';
export type ModelTier = 'nano' | 'mini' | 'full';

export interface OpenAIModelConfig {
  apiKey: string; // Required - must come from configuration
  tier?: ModelTier;
  temperature?: number;
  maxTokens?: number;
  baseURL?: string;
  langfuseId?: string; // Optional Langfuse trace ID
  structuredOutput?: boolean; // Enable structured output mode (JSON response format)
}

/**
 * Custom ChatOpenAI implementation that proxies LangChain's ChatOpenAI
 * and intercepts the _generate method to add configuration and Langfuse tracking
 */
export class UnshallowChatOpenAI {
  private readonly chatOpenAI: ChatOpenAI;
  private readonly config: OpenAIModelConfig;

  constructor(config: OpenAIModelConfig) {
    this.config = config;

    const tier = config.tier || 'mini';
    const model = UnshallowChatOpenAI.MODEL_MAPPING[tier];
    const temperature =
      config.temperature ?? UnshallowChatOpenAI.DEFAULT_TEMPERATURES[tier];
    const maxTokens = config.maxTokens;

    const modelConfig: ConstructorParameters<typeof ChatOpenAI>[0] = {
      model,
      temperature,
      maxTokens,
      openAIApiKey: config.apiKey,
    };

    if (config.baseURL) {
      modelConfig.configuration = {
        baseURL: config.baseURL,
      };
    }

    // Enable structured output (JSON response format) if configured
    if (config.structuredOutput) {
      modelConfig.modelKwargs = {
        response_format: { type: 'json_object' }
      };
    }

    this.chatOpenAI = new ChatOpenAI(modelConfig);

    // Create proxy to forward all methods except _generate
    return new Proxy(this, {
      get(target, prop, receiver) {
        // Handle our custom _generate method for langfuse tracking
        if (prop === '_generate') {
          return target._generate.bind(target);
        }

        // Handle direct property access to our instance
        if (prop in target) {
          return Reflect.get(target, prop, receiver);
        }

        // Forward everything else to the internal ChatOpenAI instance
        const value = Reflect.get(target.chatOpenAI, prop);
        if (typeof value === 'function') {
          return value.bind(target.chatOpenAI);
        }
        return value;
      },
    });
  }

  private static readonly MODEL_MAPPING: Record<ModelTier, ModelName> = {
    nano: 'gpt-4o-nano',
    mini: 'gpt-4o-mini',
    full: 'gpt-4o',
  };

  private static readonly DEFAULT_TEMPERATURES: Record<ModelTier, number> = {
    nano: 0.1,
    mini: 0.1,
    full: 0.1,
  };

  // Custom _generate method with Langfuse tracking
  async _generate(
    messages: BaseMessage[],
    options?: Parameters<ChatOpenAI['_generate']>[1],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    // Add langfuse tracking to run manager if configured
    if (this.config.langfuseId && runManager) {
      // Log langfuse start
      console.log(`[Langfuse] Starting _generate with trace ID: ${this.config.langfuseId}`);
    }

    try {
      const result = await this.chatOpenAI._generate(messages, options || {}, runManager);
      
      if (this.config.langfuseId) {
        console.log(`[Langfuse] Completed _generate with trace ID: ${this.config.langfuseId}`);
      }
      
      return result;
    } catch (error) {
      if (this.config.langfuseId) {
        console.error(`[Langfuse] Error in _generate with trace ID: ${this.config.langfuseId}`, error);
      }
      throw error;
    }
  }
}

