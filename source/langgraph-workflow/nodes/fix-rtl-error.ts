import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAI } from '../utils/openai.js';

/**
 * Fixes the RTL test when the test run fails
 */
export const fixRtlNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  // Check if we've reached max retries
  if (file.retries.rtl >= file.maxRetries) {
    return {
      file: {
        ...file,
        status: 'failed',
        error: new Error(`Maximum retry limit reached (${file.maxRetries}) for RTL fixes`),
        currentStep: WorkflowStep.CONVERT_TO_RTL_FAILED,
      },
    };
  }

  try {
    const testError = file.testResult?.errors?.join('\n') || file.testResult?.output || 'Unknown test error';

    // Generate the prompt for refactoring
    const prompt = `
# Task: Fix failing React Testing Library test

## Original Component
\`\`\`tsx
${file.context.componentCode}
\`\`\`

## Current RTL Test Code
\`\`\`tsx
${file.rtlTest}
\`\`\`

## Test Error
\`\`\`
${testError}
\`\`\`

## Instructions
1. Fix the RTL test to make it pass.
2. Address all errors shown in the test output.
3. Make sure imports are correct and complete.
4. Return ONLY the fixed test code, with no explanations.
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
          rtl: file.retries.rtl + 1,
        },
        currentStep: WorkflowStep.CONVERT_TO_RTL,
      },
    };
  } catch (error) {
    return {
      file: {
        ...file,
        error: error instanceof Error ? error : new Error(String(error)),
        status: 'failed',
        currentStep: WorkflowStep.CONVERT_TO_RTL_FAILED,
      },
    };
  }
};
