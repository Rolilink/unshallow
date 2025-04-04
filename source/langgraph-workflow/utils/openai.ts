import { ChatOpenAI } from '@langchain/openai';
import { langfuseCallbackHandler } from '../../langsmith.js';
import { ConfigManager } from '../../config/config-manager.js';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { z } from 'zod';

/**
 * Get the OpenAI API key from config manager or environment
 */
export function getApiKey(): string {
  const configManager = new ConfigManager();
  const apiKey = configManager.getOpenAIKey();

  if (!apiKey) {
    throw new Error('OpenAI API key not found. Please set it using: unshallow config set-api-key YOUR_API_KEY');
  }

  return apiKey;
}

/**
 * Remove ANSI escape codes from text
 * These are color/formatting codes used in terminal output
 */
export function stripAnsiCodes(text: string): string {
  // This regex matches ANSI escape sequences like [36m, [39m, etc.
  return text.replace(/\u001b\[\d+m|\[\d+m/g, '');
}

/**
 * Define the schema for the structured output
 */
export const fixResponseSchema = z.object({
  explanation: z.string().describe("Explanation of what changes were made to fix the issues"),
  testContent: z.string().describe("The fixed test content that addresses all the errors")
});

export type FixResponse = z.infer<typeof fixResponseSchema>;

/**
 * Calls OpenAI with the given prompt and returns structured output
 */
export async function callOpenAIStructured(prompt: string): Promise<FixResponse> {
  try {
    // Create the parser
    const parser = StructuredOutputParser.fromZodSchema(fixResponseSchema);

    // Get the format instructions
    const formatInstructions = parser.getFormatInstructions();

    // Configure the LLM
    const llm = new ChatOpenAI({
      temperature: 0.2,
      modelName: 'gpt-4o-mini',
      openAIApiKey: getApiKey(),
      callbacks: [langfuseCallbackHandler],
    });

    // Create a manual prompt that combines the user prompt and format instructions
    const fullPrompt = `${prompt}\n\n${formatInstructions}`;

    // Use the LLM directly with structured output
    const result = await llm.invoke([
      {
        type: "human",
        content: fullPrompt
      }
    ]);

    // Parse the response manually
    const content = result.content.toString();
    console.log('Received response, parsing structured output...');

    // Parse the response with the parser
    const parsedOutput = await parser.parse(content);
    console.log('Structured response successfully parsed');

    return parsedOutput;
  } catch (error) {
    console.error('Error in OpenAI structured response:', error);
    throw error;
  }
}

/**
 * Calls OpenAI with the given prompt and returns the completion as a raw string
 */
export async function callOpenAI(prompt: string): Promise<string> {
  try {
    // Configure the LLM
    const llm = new ChatOpenAI({
      temperature: 0.2,
      modelName: 'gpt-4o-mini',
      openAIApiKey: getApiKey(),
      callbacks: [langfuseCallbackHandler],
    });

    // Call the LLM directly
    const result = await llm.invoke([
      {
        type: "human",
        content: prompt
      }
    ]);

    console.log('Raw response received from OpenAI');

    // Extract the content
    let content = result.content.toString();

    // Strip code block markers if present
    // This will remove ```tsx and ``` that wrap the code
    content = content.replace(/^```(?:tsx|jsx|ts|js)?(?:\n|\r\n|\r)([\s\S]*?)(?:\n|\r\n|\r)```$/gm, '$1').trim();

    // If code is still wrapped in backticks (for any reason), try a more general approach
    if (content.startsWith('```') && content.endsWith('```')) {
      content = content.replace(/```(?:.*?)?\n([\s\S]*)\n```$/g, '$1').trim();
    }

    console.log('Response processed (removed markdown code blocks)');

    return content;
  } catch (error) {
    console.error('Error in OpenAI raw response:', error);
    throw error;
  }
}
