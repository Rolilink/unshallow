import { WorkflowState, WorkflowStep, FixAttempt, FixPlan } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured, rtlFixPlannerSchema, stripAnsiCodes } from '../utils/openai.js';

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
 * Plans fixes for RTL test failures
 */
export const planRtlFixNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[plan-rtl-fix] Planning fix for RTL test failures (retry ${file.retries.rtl + 1}/${file.maxRetries})`);

  // Check if we've exceeded the max retries
  if (file.retries.rtl >= file.maxRetries) {
    console.error(`[plan-rtl-fix] Exceeded maximum retries (${file.maxRetries})`);
    return {
      file: {
        ...file,
        status: 'failed',
        error: new Error(`Exceeded maximum retries (${file.maxRetries})`),
        currentStep: WorkflowStep.CONVERT_TO_RTL_FAILED,
      },
    };
  }

  try {
    // Get the test error output
    const testError = stripAnsiCodes(file.testResult?.errors?.join('\n') || file.testResult?.output || 'Unknown test error');

    // Initialize RTL fix history if it doesn't exist
    const rtlFixHistory = file.rtlFixHistory || [];

    // Format fix history for the prompt
    const fixHistoryText = formatFixHistory(rtlFixHistory);

    // Generate the prompt for analysis and planning
    const plannerPrompt = `
Act as a senior React developer with deep expertise in TypeScript, Jest, and React Testing Library. I need your help to analyze an RTL test failure and plan a comprehensive fix. Don't provide any code in your response - just explain the issues and outline a plan.

## Original Component
\`\`\`tsx
${file.context.componentCode}
\`\`\`

## Current RTL Test Code
\`\`\`tsx
${file.rtlTest}
\`\`\`

## Test Error Output
\`\`\`
${testError}
\`\`\`

## Previous Fix Attempts
${fixHistoryText}

## Task

1. Analyze the test error output to identify all the issues.
2. Summarize the reasons why these tests are failing - be concise but complete.
3. Create a bullet-point plan for fixing all the issues. Be specific about:
   - What aspects of the tests need to change
   - Which queries should be used
   - How event handling should be modified
   - What assertions need to be updated
   - Any other required changes

4. Determine if mocking is needed. If so, describe:
   - What needs to be mocked
   - How the mocks should be implemented
   - If any providers are needed

DO NOT provide any code in your response. Focus on analysis and planning only.

## Guidelines

- React Testing Library is centered on testing components as users would interact with them
- Prefer queries that reflect user behavior: getByRole, getByLabelText, getByText
- Use userEvent for interactions over fireEvent when possible
- Understand that await/async might be needed for state updates or async operations
- Remember that Enzyme's shallow rendering concept doesn't exist in RTL - always test with the fully rendered component
`;

    console.log(`[plan-rtl-fix] Calling OpenAI (model: gpt-4o-mini) to plan RTL test fixes`);

    // Call OpenAI with the prompt and RTL-specific planner schema
    const response = await callOpenAIStructured(plannerPrompt, rtlFixPlannerSchema);

    // Log the planner response
    console.log(`[plan-rtl-fix] Fix explanation: ${response.explanation}`);
    console.log(`[plan-rtl-fix] Fix plan: ${response.plan}`);
    console.log(`[plan-rtl-fix] Mocking needed: ${response.mockingNeeded ? 'Yes' : 'No'}`);
    if (response.mockingNeeded) {
      console.log(`[plan-rtl-fix] Mock strategy: ${response.mockStrategy}`);
    }

    // Create a fix plan
    const fixPlan: FixPlan = {
      explanation: response.explanation,
      plan: response.plan,
      mockingNeeded: response.mockingNeeded,
      mockStrategy: response.mockStrategy,
      timestamp: new Date().toISOString()
    };

    // Return the updated state with the fix plan
    return {
      file: {
        ...file,
        fixPlan,
        currentStep: WorkflowStep.PLAN_RTL_FIX,
      },
    };
  } catch (error) {
    console.error(`[plan-rtl-fix] Error: ${error instanceof Error ? error.message : String(error)}`);

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
