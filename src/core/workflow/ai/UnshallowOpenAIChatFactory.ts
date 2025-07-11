import { ChatOpenAI } from '@langchain/openai';
import { UnshallowChatOpenAI, type OpenAIModelConfig } from './UnshallowChatOpenAI';

export class UnshallowOpenAIChatFactory {
  static create(config: OpenAIModelConfig): ChatOpenAI {
    return new UnshallowChatOpenAI(config) as unknown as ChatOpenAI;
  }

  static createNano(config: Omit<OpenAIModelConfig, 'tier'>): ChatOpenAI {
    return this.create({ ...config, tier: 'nano' });
  }

  static createMini(config: Omit<OpenAIModelConfig, 'tier'>): ChatOpenAI {
    return this.create({ ...config, tier: 'mini' });
  }

  static createFull(config: Omit<OpenAIModelConfig, 'tier'>): ChatOpenAI {
    return this.create({ ...config, tier: 'full' });
  }
}