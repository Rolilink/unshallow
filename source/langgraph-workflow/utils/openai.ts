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
  plan: z.string().describe("The instructions on how to fix the test for the LLM to refactor, be detailed and specific, and include code blocks to illustrate the changes needed")
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
  plan: z.string().describe("The instructions on how to convert the test for the LLM to refactor, be detailed and specific, and include code blocks to illustrate the changes needed")
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
 * Updated to support different model parameters
 */
export async function callOpenAIStructured<T extends z.ZodType>({
  prompt,
  schema,
  model = 'gpt-4o-mini',
  temperature,
  nodeName
}: {
  prompt: string;
  schema: T;
  model?: string;
  temperature?: number;
  nodeName?: string;
}): Promise<z.infer<T>> {
  try {
    // Create the parser
    const parser = StructuredOutputParser.fromZodSchema(schema);

    // Get the format instructions
    const formatInstructions = parser.getFormatInstructions();

    // Enhanced instructions with stricter JSON requirements
    const enhancedFormatInstructions = `${formatInstructions}

IMPORTANT FORMATTING REQUIREMENTS:
1. Your response MUST be valid JSON that perfectly matches the schema above.
2. Ensure all quotes are properly escaped: use \\" for quotes inside string values.
3. Avoid using ANY control characters or line breaks within string values.
4. For multi-line strings, use \\n to represent line breaks.
5. Do not include any text, explanations, or markdown outside the JSON object.
6. Double-check your response to make sure it is complete and properly closed with all brackets matched.
7. Do not use any characters that would need escaping in JSON without proper escaping.

Return ONLY the JSON object and nothing else.`;

    // Configure the LLM with appropriate options for the model
    const llmOptions: any = {
      modelName: model,
      openAIApiKey: getApiKey(),
      callbacks: [langfuseCallbackHandler],
      response_format: { type: "json_object" },
    };

    // Only add temperature for models that support it
    if (model !== 'o3-mini' && temperature !== undefined) {
      llmOptions.temperature = temperature;
    }

    const llm = new ChatOpenAI(llmOptions);

    // Create a manual prompt that combines the user prompt and enhanced format instructions
    const fullPrompt = `${prompt}\n\n${enhancedFormatInstructions}`;

    // Add tags if nodeName is provided
    const tags = nodeName ? [`node:${nodeName}`] : undefined;

    // Use the LLM directly with structured output
    const result = await llm.invoke([
      {
        type: "human",
        content: fullPrompt
      }
    ], { tags });

    // Parse the response manually
    const content = result.content.toString();
    console.log('Received response, parsing structured output...');

    // Strip markdown code blocks if present
    let cleanContent = content;

    // Check if the content starts with a code block marker
    if (cleanContent.trim().startsWith('```')) {
      // Remove the opening code block marker (```json or just ```)
      cleanContent = cleanContent.replace(/^```(?:json|js|javascript|typescript|ts|gherkin|md|markdown|text)?\s*/m, '');

      // Remove the closing code block marker
      cleanContent = cleanContent.replace(/```\s*$/m, '');

      console.log('Stripped markdown code block from response');
    }

    // Parse the response with the parser
    const parsedOutput = await parser.parse(cleanContent);
    console.log('Structured response successfully parsed');

    // For planner responses, replace escaped newlines with actual newlines in the plan field
    if ('plan' in parsedOutput) {
      // Replace escaped newlines with actual newlines
      parsedOutput.plan = parsedOutput.plan.replace(/\\n/g, '\n');
      console.log('Plan with unescaped newlines:', parsedOutput.plan);
    }

    return parsedOutput;
  } catch (error) {
    console.error('Error in OpenAI structured response:', error);
    throw error;
  }
}

/**
 * Calls OpenAI with the given prompt and returns the completion as a raw string
 */
export async function callOpenAI(prompt: string, nodeName?: string): Promise<string> {
  try {
    // Configure the LLM
    const llm = new ChatOpenAI({
      temperature: 0.2,
      modelName: 'gpt-4o-mini',
      openAIApiKey: getApiKey(),
      callbacks: [langfuseCallbackHandler],
    });

    // Add tags if nodeName is provided
    const tags = nodeName ? [`node:${nodeName}`] : undefined;

    // Call the LLM directly
    const result = await llm.invoke([
      {
        type: "human",
        content: prompt
      }
    ], { tags });

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
