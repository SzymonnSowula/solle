import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface ModelConfig {
  temperature?: number;
  maxTokens?: number;
  modelName?: string;
}

export function createChatModel(config: ModelConfig = {}): BaseChatModel {
  const useOllama = process.env.USE_OLLAMA === 'true';
  const temperature = config.temperature ?? 0.7;
  const maxTokens = config.maxTokens ?? 2000;

  if (useOllama) {
    const modelName = config.modelName || process.env.OLLAMA_MODEL || 'llama3';
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

    console.log(`[LLM] Using Ollama model: ${modelName} at ${baseUrl}`);

    return new ChatOllama({
      model: modelName,
      baseUrl,
      temperature,
      maxRetries: 2,
    });
  }

  const modelName = config.modelName || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required when USE_OLLAMA is not set to true');
  }

  console.log(`[LLM] Using OpenAI model: ${modelName}`);

  return new ChatOpenAI({
    modelName,
    apiKey,
    temperature,
    maxTokens,
    maxRetries: 2,
  });
}
