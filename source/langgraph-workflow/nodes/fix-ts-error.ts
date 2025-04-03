import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAI } from '../utils/openai.js';

/**
 * Fixes TypeScript errors in the RTL test
 */
export const fixTsErrorNode = async (state: WorkflowState, config?: { apiKey?: string }): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[fix-ts-error] Fixing TypeScript (retry ${file.retries.ts + 1}/${file.maxRetries})`);

  // Check if we've reached max retries
  if (file.retries.ts >= file.maxRetries) {
    console.log(`[fix-ts-error] Max retries reached (${file.maxRetries})`);
    return {
      file: {
        ...file,
        status: 'failed',
        error: new Error(`Maximum retry limit reached (${file.maxRetries}) for TypeScript fixes`),
        currentStep: WorkflowStep.TS_VALIDATION_FAILED,
      },
    };
  }

  try {
    const tsErrors = file.tsCheck?.errors?.join('\n') || 'Unknown TypeScript errors';

    // Generate the prompt for fixing TS errors
    const prompt = `
# Task: Fix TypeScript errors in React Testing Library test

## Original Component
\`\`\`tsx
${file.context.componentCode}
\`\`\`

## Current RTL Test Code
\`\`\`tsx
${file.rtlTest}
\`\`\`

## TypeScript Errors
\`\`\`
${tsErrors}
\`\`\`

## Instructions
1. Fix the TypeScript errors in the RTL test.
2. Address all type errors shown in the output.
3. Make sure imports are correct and complete.
4. Add proper type annotations where needed.
5. Return ONLY the fixed test code, with no explanations.
`;

    console.log(`[fix-ts-error] Calling OpenAI for fixes`);

    // Call OpenAI with the prompt, using the API key from config
    const response = await callOpenAI(prompt, config?.apiKey);

    // Return the updated state with the fixed test
    return {
      file: {
        ...file,
        rtlTest: response.trim(),
        retries: {
          ...file.retries,
          ts: file.retries.ts + 1,
        },
        currentStep: WorkflowStep.TS_VALIDATION,
      },
    };
  } catch (error) {
    console.error(`[fix-ts-error] Error: ${error instanceof Error ? error.message : String(error)}`);

    return {
      file: {
        ...file,
        error: error instanceof Error ? error : new Error(String(error)),
        status: 'failed',
        currentStep: WorkflowStep.TS_VALIDATION_ERROR,
      },
    };
  }
};
