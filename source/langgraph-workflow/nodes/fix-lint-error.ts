import { WorkflowState, WorkflowStep, FixAttempt } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured, lintFixResponseSchema } from '../utils/openai.js';

/**
 * Formats fix history into a string for the prompt
 */
function formatFixHistory(history: FixAttempt[]): string {
  if (!history || history.length === 0) {
    return "No previous fix attempts.";
  }

  return history.map((attempt) => {
    return `
### Fix Attempt ${attempt.attempt}
**Timestamp:** ${attempt.timestamp}

**Code:**
\`\`\`tsx
${attempt.testContent}
\`\`\`

**Resulting Error:**
\`\`\`
${attempt.error}
\`\`\`

**Explanation of Changes:**
${attempt.explanation || "No explanation provided."}
`;
  }).join("\n");
}

/**
 * Fixes ESLint errors in the RTL test
 */
export const fixLintErrorNode = async (state: WorkflowState): Promise<NodeResult> => {
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

    // Initialize Lint fix history if it doesn't exist
    const lintFixHistory = file.lintFixHistory || [];

    // If we have a current test and it's not the first attempt, add it to history
    if (file.rtlTest && file.retries.lint > 0) {
      // Add the current attempt to history
      lintFixHistory.push({
        attempt: file.retries.lint,
        timestamp: new Date().toISOString(),
        testContent: file.rtlTest,
        error: lintErrors,
        explanation: file.fixExplanation
      });

      console.log(`[fix-lint-error] Added attempt ${file.retries.lint} to Lint fix history (${lintFixHistory.length} total attempts)`);
    }

    // Format fix history for the prompt
    const fixHistoryText = formatFixHistory(lintFixHistory);

    // Generate the prompt for fixing lint errors
    const prompt = `
Act as a senior React developer with strong knowledge of ESLint and TypeScript. You are reviewing a test file that contains remaining ESLint errors after an automatic fix attempt.

Your task is to manually fix the remaining ESLint errors **without changing the behavior or intent of the test**.

## Current Test Code
\`\`\`tsx
${file.rtlTest}
\`\`\`

## ESLint Errors
\`\`\`
${lintErrors}
\`\`\`

## Previous Fix Attempts
${fixHistoryText}

## Instructions

1. Fix the ESLint errors in the test file.
2. Do not change the test behavior, logic, or structure in any way.
3. Only make changes required to satisfy the ESLint rules.
4. Do not remove or refactor any test logic beyond what is strictly required for lint compliance.
5. Review previous fix attempts to avoid repeating failed changes.
6. Your explanation should briefly describe what was fixed and why.
7. For the testContent, return ONLY the fixed test code — no backticks, no comments, and no extra explanation.

Important: Do not modify or assume changes to any external files. Fix only what's shown.
`;

    console.log(`[fix-lint-error] Calling OpenAI for fixes with ${lintFixHistory.length} previous attempts as context`);

    // Call OpenAI with the prompt and Lint-specific schema
    const response = await callOpenAIStructured(prompt, lintFixResponseSchema);

    // Log the full explanation
    console.log(`[fix-lint-error] Fix explanation: ${response.explanation}`);

    // Return the updated state with the fixed test
    return {
      file: {
        ...file,
        rtlTest: response.testContent.trim(),
        fixExplanation: response.explanation,
        lintFixHistory: lintFixHistory, // Add Lint-specific fix history to state
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
