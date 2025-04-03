import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { langfuseCallbackHandler } from '../../langsmith.js';
/**
 * Calls OpenAI with the given prompt and returns the completion
 */
export async function callOpenAI(prompt: string, apiKey?: string): Promise<string> {
  // Configure the LLM
  const llm = new ChatOpenAI({
    temperature: 0.2,
    modelName: 'gpt-4',
    openAIApiKey: apiKey || process.env['OPENAI_API_KEY'],
    callbacks: [langfuseCallbackHandler],
    verbose: true,
  });

  // Create a prompt template
  const promptTemplate = ChatPromptTemplate.fromTemplate(`
    {prompt}
  `);

  // Create a chain with the template and LLM
  const chain = promptTemplate.pipe(llm);

  // Invoke the chain with the prompt
  const response = await chain.invoke({
    prompt,
  });

  console.log('response:', response.content.toString());

  // Extract and return the content
  return response.content.toString();
}
