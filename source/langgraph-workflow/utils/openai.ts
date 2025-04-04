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
 * Define the schema for the RTL fix response
 */
export const rtlFixResponseSchema = z.object({
  explanation: z.string().describe("Explanation of what changes were made to fix the issues"),
  testContent: z.string().describe("The fixed test content that addresses the errors"),
  focusedTest: z.string().describe("The name of the specific test that was fixed in this attempt")
});

/**
 * Define the schema for the RTL fix planner response
 */
export const rtlFixPlannerSchema = z.object({
  explanation: z.string().describe("A concise explanation of why the tests are failing"),
  plan: z.string().describe("A bullet-pointed string describing the fix steps"),
  mockingNeeded: z.boolean().describe("Whether mocking is needed"),
  mockStrategy: z.string().describe("Description of what should be mocked or how providers should be wrapped")
});

/**
 * Define the schema for the RTL fix executor response
 */
export const rtlFixExecutorSchema = z.object({
  testContent: z.string().describe("The fixed test content that addresses the errors"),
  explanation: z.string().describe("Explanation of changes made to implement the plan")
});

/**
 * Define the schema for the TypeScript fix response
 */
export const tsFixResponseSchema = z.object({
  explanation: z.string().describe("Explanation of what changes were made to fix the TypeScript issues"),
  testContent: z.string().describe("The fixed test content that addresses the TypeScript errors")
});

/**
 * Define the schema for the lint fix response
 */
export const lintFixResponseSchema = z.object({
  explanation: z.string().describe("Explanation of what changes were made to fix the lint issues"),
  testContent: z.string().describe("The fixed test content that addresses the lint errors")
});

/**
 * Define the schema for the RTL conversion planner response
 */
export const rtlConversionPlannerSchema = z.object({
  explanation: z.string().describe("A concise explanation of the Enzyme test's structure and what needs to be converted"),
  plan: z.string().describe("A bullet-pointed string describing the conversion steps"),
  mockingNeeded: z.boolean().describe("Whether mocking is needed"),
  mockStrategy: z.string().describe("Description of what should be mocked or how providers should be wrapped")
});

/**
 * Define the schema for the RTL conversion executor response
 */
export const rtlConversionExecutorSchema = z.object({
  testContent: z.string().describe("The complete, converted RTL test content"),
  explanation: z.string().describe("Explanation of the conversion process and implementation details")
});

// For backward compatibility
export const fixResponseSchema = rtlFixResponseSchema;

export type RtlFixResponse = z.infer<typeof rtlFixResponseSchema>;
export type RtlFixPlannerResponse = z.infer<typeof rtlFixPlannerSchema>;
export type RtlFixExecutorResponse = z.infer<typeof rtlFixExecutorSchema>;
export type RtlConversionPlannerResponse = z.infer<typeof rtlConversionPlannerSchema>;
export type RtlConversionExecutorResponse = z.infer<typeof rtlConversionExecutorSchema>;
export type TsFixResponse = z.infer<typeof tsFixResponseSchema>;
export type LintFixResponse = z.infer<typeof lintFixResponseSchema>;
export type FixResponse = RtlFixResponse | TsFixResponse | LintFixResponse | RtlFixPlannerResponse | RtlFixExecutorResponse | RtlConversionPlannerResponse | RtlConversionExecutorResponse;

/**
 * Calls OpenAI with the given prompt and returns structured output
 */
export async function callOpenAIStructured<T extends z.ZodType>(
  prompt: string,
  schema: T = rtlFixResponseSchema as any
): Promise<z.infer<T>> {
  try {
    // Create the parser
    const parser = StructuredOutputParser.fromZodSchema(schema);

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
