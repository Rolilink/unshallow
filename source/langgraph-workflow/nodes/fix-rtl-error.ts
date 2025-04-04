import { WorkflowState, WorkflowStep, FixAttempt } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured } from '../utils/openai.js';

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
 * Fixes the RTL test when the test run fails
 */
export const fixRtlNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[fix-rtl-error] Fixing test (retry ${file.retries.rtl + 1}/${file.maxRetries})`);

  // Check if we've reached max retries
  if (file.retries.rtl >= file.maxRetries) {
    console.log(`[fix-rtl-error] Max retries reached (${file.maxRetries})`);
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

    // Initialize RTL fix history if it doesn't exist
    const rtlFixHistory = file.rtlFixHistory || [];

    // If we have a current test and it's not the first attempt, add it to history
    if (file.rtlTest && file.retries.rtl > 0) {
      // Add the current attempt to history
      rtlFixHistory.push({
        attempt: file.retries.rtl,
        timestamp: new Date().toISOString(),
        testContent: file.rtlTest,
        error: testError,
        explanation: file.fixExplanation
      });

      console.log(`[fix-rtl-error] Added attempt ${file.retries.rtl} to RTL fix history (${rtlFixHistory.length} total attempts)`);
    }

    // Format fix history for the prompt
    const fixHistoryText = formatFixHistory(rtlFixHistory);

    // Generate the prompt for refactoring
    const prompt = `
Act as a senior React developer with deep experience in TypeScript, Enzyme, and React Testing Library. You are an expert in testing user-facing components using accessibility best practices and React Testing Library’s guiding principles.

Your task is to fix the following React Testing Library test so that it passes. The test was originally converted from Enzyme and is currently failing. You must analyze the error output, review previous fix attempts, and produce a stable, working version of the test that follows testing best practices.

Original Component:
\`\`\`tsx
${file.context.componentCode}
\`\`\`

Current RTL Test Code:
\`\`\`tsx
${file.rtlTest}
\`\`\`

Test Error:
Below is the raw CLI output from running the test:
\`\`\`
${testError}
\`\`\`

Previous Fix Attempts:
${fixHistoryText}

Instructions:

1. Fix the RTL test so that it passes.
2. Carefully review and address all errors shown in the raw test output.
3. Make sure all imports are present and correct.
4. Use the screen object for all queries (e.g., screen.getByRole(...)).
5. Use userEvent for user interactions instead of fireEvent.
6. For async operations, use findBy queries or wrap assertions with waitFor.
7. Do not use snapshot testing. Avoid assertions based on CSS classes or styles.
8. Avoid mocking internals unless absolutely necessary. Favor integration-style testing.
9. Follow the query priority guidelines below, but if a test continues to fail after multiple attempts, it is acceptable to use a lower-priority query to ensure the test is stable.
10. Your explanation should include:
    - What was changed and why.
    - How the fix resolves the test failure.
    - Any reasoning behind query or assertion choices.
11. For the testContent, return ONLY the full, updated test code — no backticks, no additional explanation, and no partial diffs.

Query Priority Guidelines:

Always prefer queries that simulate how users interact with your UI. Follow this order as a guideline, with flexibility for retries:

1. Accessible Queries (most preferred)
- getByRole: Use with the name option when applicable (e.g., getByRole('button', { name: /submit/i }))
- getByLabelText: Best for form fields with associated labels.
- getByPlaceholderText: Acceptable if no label is present.
- getByText: For non-interactive visible content.
- getByDisplayValue: For form fields with pre-filled values.

2. Semantic Queries
- getByAltText: For images and elements with alt attributes.
- getByTitle: Least reliable for accessibility, use only when needed.

3. Test IDs (least preferred)
- getByTestId: Use only when other options are not viable (e.g., dynamic or non-semantic content).

Use the order: Accessible Queries > Semantic Queries > Test IDs — but when retrying failed tests, it is acceptable to fallback down the priority list for reliability.

Do not use CSS class selectors or assert on styles. Focus on behavior and user interaction, not implementation details.

Always return the full updated test code — nothing more, nothing less.
`;


    console.log(`[fix-rtl-error] Calling OpenAI for fixes with ${rtlFixHistory.length} previous attempts as context`);

    // Call OpenAI with the prompt
    const response = await callOpenAIStructured(prompt);

    // Log the explanation without showing test content
    console.log(`[fix-rtl-error] Fix explanation summary: ${response.explanation.substring(0, 100)}...`);

    // Return the updated state with the refactored test
    return {
      file: {
        ...file,
        rtlTest: response.testContent.trim(),
        fixExplanation: response.explanation,
        rtlFixHistory: rtlFixHistory, // Add RTL-specific fix history to state
        retries: {
          ...file.retries,
          rtl: file.retries.rtl + 1,
        },
        currentStep: WorkflowStep.CONVERT_TO_RTL,
      },
    };
  } catch (error) {
    console.error(`[fix-rtl-error] Error: ${error instanceof Error ? error.message : String(error)}`);

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
