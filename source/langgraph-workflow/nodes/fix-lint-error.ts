import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAI } from '../utils/openai.js';

/**
 * Fixes ESLint errors in the RTL test
 */
export const fixLintErrorNode = async (state: WorkflowState, config?: { apiKey?: string }): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[fix-lint-error] Fixing lint (retry ${file.retries.lint + 1}/${file.maxRetries})`);

  // Check if we've reached max retries
  if (file.retries.lint >= file.maxRetries) {
    console.log(`[fix-lint-error] Max retries reached (${file.maxRetries})`);
    return {
      file: {
        ...file,
        status: 'failed',
        error: new Error(`Maximum retry limit reached (${file.maxRetries}) for lint fixes`),
        currentStep: WorkflowStep.LINT_CHECK_FAILED,
      },
    };
  }

  try {
    const lintErrors = file.lintCheck?.errors?.join('\n') || 'Unknown lint errors';

    // Generate the prompt for fixing lint errors
    const prompt = `
# Task: Fix ESLint errors in React Testing Library test

## Current RTL Test Code
\`\`\`tsx
${file.rtlTest}
\`\`\`

## ESLint Errors
\`\`\`
${lintErrors}
\`\`\`

## Instructions
1. Fix the ESLint errors in the RTL test.
2. Follow standard ESLint rules and best practices.
3. Ensure code style is consistent.
4. Return ONLY the fixed test code, with no explanations.
`;

    console.log(`[fix-lint-error] Calling OpenAI for fixes`);

    // Call OpenAI with the prompt, using the API key from config
    const response = await callOpenAI(prompt, config?.apiKey);

    // Return the updated state with the fixed test
    return {
      file: {
        ...file,
        rtlTest: response.trim(),
        retries: {
          ...file.retries,
          lint: file.retries.lint + 1,
        },
        currentStep: WorkflowStep.LINT_CHECK,
      },
    };
  } catch (error) {
    console.error(`[fix-lint-error] Error: ${error instanceof Error ? error.message : String(error)}`);

    return {
      file: {
        ...file,
        error: error instanceof Error ? error : new Error(String(error)),
        status: 'failed',
        currentStep: WorkflowStep.LINT_CHECK_ERROR,
      },
    };
  }
};
