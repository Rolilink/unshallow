import {ChatOpenAI} from '@langchain/openai';
import {getLangfuseCallbackHandler} from '../../langfuse.js';
import {ConfigManager} from '../../config/config-manager.js';
import {StructuredOutputParser} from 'langchain/output_parsers';
import {z} from 'zod';
import {logger} from './logging-callback.js';

/**
 * Get the OpenAI API key from config manager or environment
 */
async function getApiKey(): Promise<string> {
	try {
  const configManager = new ConfigManager();
		const apiKey = await configManager.getOpenAIKey();

  if (!apiKey) {
			throw new Error(
				"OpenAI API key is not set. Use 'unshallow config:set-api-key' to set it.",
			);
  }

  return apiKey;
	} catch (error) {
		logger.error('openai', 'Error getting OpenAI API key:', error);
		throw error;
	}
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
	explanation: z
		.string()
		.describe('Explanation of what changes were made to fix the issues'),
	testContent: z
		.string()
		.describe('The fixed test content that addresses the errors'),
	focusedTest: z
		.string()
		.describe('The name of the specific test that was fixed in this attempt'),
});

/**
 * Define the schema for the RTL fix planner response
 */
export const rtlFixPlannerSchema = z.object({
	explanation: z
		.string()
		.describe('A concise explanation of why the tests are failing'),
	plan: z
		.string()
		.describe(
			'The instructions on how to fix the test for the LLM to refactor, be detailed and specific, and include code blocks to illustrate the changes needed',
		),
});

/**
 * Define the schema for the RTL fix executor response
 */
export const rtlFixExecutorSchema = z.object({
	testContent: z
		.string()
		.describe('The fixed test content that addresses the errors'),
	explanation: z
		.string()
		.describe('Explanation of changes made to implement the plan'),
});

/**
 * Define the schema for the TypeScript fix response
 */
export const tsFixResponseSchema = z.object({
	explanation: z
		.string()
		.describe(
			'Explanation of what changes were made to fix the TypeScript issues',
		),
	testContent: z
		.string()
		.describe('The fixed test content that addresses the TypeScript errors'),
});

/**
 * Define the schema for the lint fix response
 */
export const lintFixResponseSchema = z.object({
	explanation: z
		.string()
		.describe('Explanation of what changes were made to fix the lint issues'),
	testContent: z
		.string()
		.describe('The fixed test content that addresses the lint errors'),
});

/**
 * Define the schema for the RTL conversion planner response
 */
export const rtlConversionPlannerSchema = z.object({
	explanation: z
		.string()
		.describe(
			"A concise explanation of the Enzyme test's structure and what needs to be converted",
		),
	plan: z
		.string()
		.describe(
			'The instructions on how to convert the test for the LLM to refactor, be detailed and specific, and include code blocks to illustrate the changes needed',
		),
});

/**
 * Define the schema for the RTL conversion executor response
 */
export const rtlConversionExecutorSchema = z.object({
	testContent: z.string().describe('The complete, converted RTL test content'),
	explanation: z
		.string()
		.describe(
			'Explanation of the conversion process and implementation details',
		),
});

// For backward compatibility
export const fixResponseSchema = rtlFixResponseSchema;

export type RtlFixResponse = z.infer<typeof rtlFixResponseSchema>;
export type RtlFixPlannerResponse = z.infer<typeof rtlFixPlannerSchema>;
export type RtlFixExecutorResponse = z.infer<typeof rtlFixExecutorSchema>;
export type RtlConversionPlannerResponse = z.infer<
	typeof rtlConversionPlannerSchema
>;
export type RtlConversionExecutorResponse = z.infer<
	typeof rtlConversionExecutorSchema
>;
export type TsFixResponse = z.infer<typeof tsFixResponseSchema>;
export type LintFixResponse = z.infer<typeof lintFixResponseSchema>;
export type FixResponse =
	| RtlFixResponse
	| TsFixResponse
	| LintFixResponse
	| RtlFixPlannerResponse
	| RtlFixExecutorResponse
	| RtlConversionPlannerResponse
	| RtlConversionExecutorResponse;

/**
 * Cleans markdown code blocks from a string
 */
function cleanMarkdownCodeBlocks(content: string): string {
  let cleanContent = content.trim();

  // Check if the content starts with a code block marker
  if (cleanContent.startsWith('```')) {
    // Remove the opening code block marker (```json or just ```)
		cleanContent = cleanContent.replace(
			/^```(?:json|js|javascript|typescript|ts|gherkin|md|markdown|text)?\s*/m,
			'',
		);

    // Remove the closing code block marker
    cleanContent = cleanContent.replace(/```\s*$/m, '');

    logger.info('openai', 'Stripped markdown code block from response');
  }

  return cleanContent;
}

/**
 * Preprocesses JSON content to fix common issues before parsing
 * Especially targets code-related fields which often contain problematic characters
 */
function preprocessJsonContent(content: string): string {
  try {
    // First check if it's already valid JSON
    JSON.parse(content);
    return content; // If no error, return as is
  } catch (error) {
    logger.info('openai', 'JSON parsing failed, attempting to preprocess content...');
		logger.info(
			'openai',
			'Error: ' + (error instanceof Error ? error.message : String(error))
		);

    // Regex-based preprocessing for common issues

    // Identify and fix single quotes in known code fields (rtl, plan, test, etc.)
    // This targets fields that likely contain code snippets or test descriptions
    let processed = content;

    // Handle the specific case that's causing issues - single quotes in test names and strings
    // This needs to happen BEFORE the general replacement
		processed = processed.replace(
			/(it\()(['"])(.*?['"].*?)(\2)/g,
			(_match, prefix, quote, content, endQuote) => {
      // Replace any unescaped single quotes within the content with escaped ones
      const escaped = content.replace(/(?<!\\)'/g, "\\'");
      return `${prefix}${quote}${escaped}${endQuote}`;
			},
		);

    // Replace unescaped single quotes within string values in JSON fields
		processed = processed.replace(
			/"((?:rtl|plan|test|code|updatedTestFile|explanation)[^"]*)":\s*"(.*?)"/gs,
			(_match, fieldName, fieldValue) => {
      // Escape any unescaped single quotes in the field value
      const escapedValue = fieldValue.replace(/(?<!\\)'/g, "\\'");

      // Further special handling for test and RTL code which often contains these patterns
      let enhancedValue = escapedValue;
      // Handle test descriptions and assertions with single quotes
				enhancedValue = enhancedValue.replace(
					/(it\(|test\(|expect\(|describe\()(['"])(.*?)(\2)/g,
					(_match, func, quote, content, endQuote) => {
        const cleanContent = content.replace(/(?<!\\)'/g, "\\'");
        return `${func}${quote}${cleanContent}${endQuote}`;
					},
				);

      // Handle specific attribute matches like { name: /Pattern/i } or { name: 'string' }
				enhancedValue = enhancedValue.replace(
					/(\{\s*name:\s*)(['"])(.*?)(\2)/g,
					(_match, prefix, quote, content, endQuote) => {
        const cleanContent = content.replace(/(?<!\\)'/g, "\\'");
        return `${prefix}${quote}${cleanContent}${endQuote}`;
					},
				);

      return `"${fieldName}":"${enhancedValue}"`;
			},
		);

    // Fix invalid control characters
		processed = processed.replace(/[\u0000-\u001F]+/g, '');

    // Fix unescaped backslashes before quotes
		processed = processed.replace(/([^\\])\\(?!")/g, '$1\\\\');

    // Additional handling for specific JSON syntax issues that commonly occur
    // Handle specific cases where a single quote is used within a string that's
    // already within a JSON string (double nested quoting)
		processed = processed.replace(
			/\\['"]([^'"]*?)['"](['"])/g,
			(_match, content, endQuote) => {
      // Make sure any internal quotes are properly escaped
				const cleanContent = content
					.replace(/(?<!\\)'/g, "\\'")
					.replace(/(?<!\\)"/g, '\\"');
      return `\\"${cleanContent}\\"${endQuote}`;
			},
		);

    // Fix unbalanced quotes by checking for obvious issues
    // This is a simple fix, not comprehensive
    const openQuotes = (processed.match(/"/g) || []).length;
    if (openQuotes % 2 !== 0) {
      logger.info('openai', 'Detected unbalanced quotes, attempting basic fix');
      // Find object boundaries to fix
      processed = processed.replace(/\{([^{}]*)\}/g, (_match, content) => {
        const fixedContent = content.replace(/(?<!\\)"/g, (q, index, str) => {
          // Count quotes before this one to determine if it should be escaped
					const quotesBefore = (
						str.substring(0, index).match(/(?<!\\)"/g) || []
					).length;
          return quotesBefore % 2 === 0 ? q : '\\"';
        });
        return `{${fixedContent}}`;
      });
    }

    logger.info('openai', 'Preprocessing complete, attempting to parse JSON again');

    // Verify if preprocessing fixed the issue
    try {
      JSON.parse(processed);
      logger.info('openai', 'Preprocessing successfully fixed JSON issues');
      return processed;
    } catch (secondError) {
			logger.error(
				'openai',
				'Preprocessing could not fully fix JSON issues:',
				secondError
			);

      // Last resort: Try to handle the case with regex pattern that specifically targets the position referenced in the error
      if (secondError instanceof SyntaxError) {
        const errorMessage = secondError.message;
        const positionMatch = errorMessage.match(/position (\d+)/);
        if (positionMatch && positionMatch[1]) {
          const position = parseInt(positionMatch[1], 10);
					logger.info(
						'openai',
						`Attempting to fix JSON at specific position ${position}`
					);

          // Create a buffer around the error position
          const start = Math.max(0, position - 20);
          const end = Math.min(processed.length, position + 20);
          const snippet = processed.substring(start, end);
          logger.info('openai', `Issue near: "${snippet}"`);

          // Apply targeted fix for single quotes in test names which is a common issue
					processed =
						processed.substring(0, position) +
						processed.substring(position).replace(/'/g, "\\'");

          // Try parsing one more time
          try {
            JSON.parse(processed);
            logger.info('openai', 'Last-resort position-specific fix worked!');
            return processed;
          } catch (finalError) {
            logger.error('openai', 'All preprocessing attempts failed');
          }
        }
      }
      return content; // Return original if preprocessing didn't help
    }
  }
}

/**
 * Post-processes the parsed output to handle special fields
 */
function postProcessParsedOutput<T>(parsedOutput: T): T {
  // For planner responses, replace escaped newlines with actual newlines in the plan field
	if (
		parsedOutput &&
		typeof parsedOutput === 'object' &&
		'plan' in parsedOutput
	) {
    const output = parsedOutput as any;
    // Replace escaped newlines with actual newlines
    output.plan = output.plan.replace(/\\n/g, '\n');
    logger.info('openai', 'Plan with unescaped newlines: ' + output.plan);
  }

  return parsedOutput;
}

/**
 * Sleep function for exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calls OpenAI with the given prompt and returns structured output
 * Uses retry mechanism with exponential backoff for resilience
 */
export async function callOpenAIStructured<T extends z.ZodType>({
  prompt,
  schema,
  model = 'gpt-4.1',
  temperature,
	nodeName,
}: {
  prompt: string;
  schema: T;
  model?: string;
  temperature?: number;
  nodeName?: string;
}): Promise<z.infer<T>> {
  // Define retry parameters
  const MAX_RETRIES = 5;
  const BASE_DELAY_MS = 1000; // 1 second initial delay

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
8. Inside the it and describe block, do not use single quotes. example: incorrect: it('adds \'Milk\' to the list') correct: it(\"adds 'todo' to the list\")
Return ONLY the JSON object and nothing else.`;

  // Get the Langfuse callback handler
  const langfuseCallbackHandler = await getLangfuseCallbackHandler();

  // Retry loop
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
			logger.info(
				'openai',
				`Attempt ${attempt}/${MAX_RETRIES} to call OpenAI structured API`
			);

      // Configure the LLM with appropriate options for the model
      const llmOptions: any = {
        modelName: model,
				openAIApiKey: await getApiKey(),
        callbacks: langfuseCallbackHandler ? [langfuseCallbackHandler] : [],
				response_format: {type: 'json_object'},
      };

      // Only add temperature for models that support it
      if (model !== 'o4-mini' && temperature !== undefined) {
        llmOptions.temperature = temperature;
      } else if (model !== 'o4-mini') {
        // Use a lower default temperature for more predictable JSON outputs
        llmOptions.temperature = 0.0;
      }

      const llm = new ChatOpenAI(llmOptions);

      // Create a manual prompt that combines the user prompt and enhanced format instructions
      const fullPrompt = `${prompt}\n\n${enhancedFormatInstructions}`;

      // Add tags if nodeName is provided
      const tags = nodeName ? [`node:${nodeName}`] : undefined;

      // Use the LLM directly with structured output
			const result = await llm.invoke(
				[
        {
						type: 'human',
						content: fullPrompt,
					},
				],
				{tags},
			);

      // Parse the response manually
      const content = result.content.toString();
      logger.info('openai', 'Received response, parsing structured output...');

      // Clean markdown code blocks
      const cleanContent = cleanMarkdownCodeBlocks(content);

      // Preprocess the content to fix common JSON issues
      const preprocessedContent = preprocessJsonContent(cleanContent);

      // Parse the response with the parser
      try {
        const parsedOutput = await parser.parse(preprocessedContent);
        logger.info('openai', 'Structured response successfully parsed');

        // Post-process the output
        return postProcessParsedOutput(parsedOutput);
      } catch (parseError) {
        // If JSON parsing still fails, log and throw to trigger retry
				logger.error(
					'openai',
					'JSON parsing failed after preprocessing:',
					parseError
				);
        throw parseError;
      }
    } catch (error) {
      // If this is the last attempt, throw the error
      if (attempt === MAX_RETRIES) {
        logger.error('openai', `All ${MAX_RETRIES} attempts failed:`, error);
        throw error;
      }

      // Log the error for this attempt
			logger.error(
				'openai',
				`Attempt ${attempt} failed:`,
				error
			);

      // Calculate exponential backoff delay
      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      logger.info('openai', `Retrying in ${delayMs}ms...`);

      // Wait before the next attempt with exponential backoff
      await sleep(delayMs);
    }
  }

  // This should never be reached due to the throw in the last attempt
	throw new Error('Unexpected: Retry loop completed without success or error');
}

/**
 * Calls OpenAI with the given prompt and returns the completion as a raw string
 */
export async function callOpenAI(
	prompt: string,
	nodeName?: string,
): Promise<string> {
  try {
    // Get the Langfuse callback handler
    const langfuseCallbackHandler = await getLangfuseCallbackHandler();

    // Configure the LLM
    const llm = new ChatOpenAI({
      temperature: 0.2,
      modelName: 'gpt-4o-mini',
			openAIApiKey: await getApiKey(),
      callbacks: langfuseCallbackHandler ? [langfuseCallbackHandler] : [],
    });

    // Add tags if nodeName is provided
    const tags = nodeName ? [`node:${nodeName}`] : undefined;

    // Call the LLM directly
		const result = await llm.invoke(
			[
      {
					type: 'human',
					content: prompt,
				},
			],
			{tags},
		);

    logger.info('openai', 'Raw response received from OpenAI');

    // Extract the content
    let content = result.content.toString();

    // Strip code block markers if present
    // This will remove ```tsx and ``` that wrap the code
		content = content
			.replace(
				/^```(?:tsx|jsx|ts|js)?(?:\n|\r\n|\r)([\s\S]*?)(?:\n|\r\n|\r)```$/gm,
				'$1',
			)
			.trim();

    // If code is still wrapped in backticks (for any reason), try a more general approach
    if (content.startsWith('```') && content.endsWith('```')) {
      content = content.replace(/```(?:.*?)?\n([\s\S]*)\n```$/g, '$1').trim();
    }

    logger.info('openai', 'Response processed (removed markdown code blocks)');

    return content;
  } catch (error) {
    logger.error('openai', 'Error in OpenAI raw response:', error);
    throw error;
  }
}
