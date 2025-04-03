import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAI } from '../utils/openai.js';

/**
 * Refactors the RTL test when lint checks fail
 */
export const fixLintErrorNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  // Check if we've reached max retries
  if (file.retries.lint >= file.maxRetries) {
    return {
      file: {
        ...file,
        status: 'failed',
        error: new Error(`Maximum retry limit reached (${file.maxRetries}) for lint error refactoring`),
        currentStep: WorkflowStep.LINT_CHECK_FAILED,
      },
    };
  }

  try {
    const lintErrors = file.lintCheck?.errors?.join('\n') || 'Unknown lint errors';

    // Generate the prompt for refactoring
    const prompt = `
# Task: Fix linting errors in React Testing Library test

## Original Component
\`\`\`tsx
${file.context.componentCode}
\`\`\`

## Current RTL Test Code
\`\`\`tsx
${file.rtlTest}
\`\`\`

## Lint Errors
\`\`\`
${lintErrors}
\`\`\`

## Instructions
1. Fix all linting errors in the RTL test.
2. Follow best practices for code style and formatting.
3. Make sure imports are correct and organized properly.
4. Remove any unused variables or imports.
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
          lint: file.retries.lint + 1,
        },
        currentStep: WorkflowStep.LINT_CHECK,
      },
    };
  } catch (error) {
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
