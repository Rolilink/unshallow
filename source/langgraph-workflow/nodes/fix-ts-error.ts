import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAI } from '../utils/openai.js';

/**
 * Refactors the RTL test when TypeScript validation fails
 */
export const fixTsErrorNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  // Check if we've reached max retries
  if (file.retries.ts >= file.maxRetries) {
    return {
      file: {
        ...file,
        status: 'failed',
        error: new Error(`Maximum retry limit reached (${file.maxRetries}) for TypeScript refactoring`),
        currentStep: WorkflowStep.TS_VALIDATION_FAILED,
      },
    };
  }

  try {
    const tsErrors = file.tsCheck?.errors?.join('\n') || 'Unknown TypeScript errors';

    // Generate the prompt for refactoring
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

    // Call OpenAI with the prompt
    const response = await callOpenAI(prompt, file.apiKey);

    // Return the updated state with the refactored test
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
