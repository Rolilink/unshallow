import { WorkflowState, WorkflowStep, FixAttempt, FixPlan } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured, rtlFixPlannerSchema, stripAnsiCodes } from '../utils/openai.js';

/**
 * Formats previous plans into a string for the prompt
 */
function formatPreviousPlans(history: FixAttempt[]): string {
  if (!history || history.length === 0) {
    return "No previous fix plans.";
  }

  return history.map((attempt, index) => {
    if (!attempt.plan) {
      return `### Fix Plan ${index + 1} (Attempt ${attempt.attempt})
No plan data available for this attempt.
`;
    }

    return `
### Fix Plan ${index + 1} (Attempt ${attempt.attempt})
**Timestamp:** ${attempt.timestamp}

**Error Analysis:**
${attempt.plan.explanation}

**Fix Strategy:**
${attempt.plan.plan}

**Mocking Strategy:**
${attempt.plan.mockingNeeded ? attempt.plan.mockStrategy : "No mocking was required."}

**Resulting Error (after implementation):**
\`\`\`
${attempt.error}
\`\`\`
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

    // Format previous plans for the prompt (not full fix history)
    const previousPlansText = formatPreviousPlans(rtlFixHistory);

    // Format examples section if available
    let examplesSection = '';
    if (file.context.examples && Object.keys(file.context.examples).length > 0) {
      examplesSection = `
## Example RTL Tests
These are examples of successful RTL tests in the codebase:

${Object.entries(file.context.examples).map(([filename, content]) => `
### ${filename}
\`\`\`tsx
${content}
\`\`\`
`).join('\n')}
`;
    }

    // Format extra context if available
    let extraContextSection = '';
    if (file.context.extraContext) {
      extraContextSection = `
## Additional Context
${file.context.extraContext}
`;
    }

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
${examplesSection}${extraContextSection}
## Previous Fix Plans
${previousPlansText}

## Task

1. Analyze the test error output to identify all the issues.
2. Carefully review the previous fix plans to understand what strategies have already been tried and why they failed.
3. Summarize the reasons why these tests are failing - be concise but complete.
4. Create a bullet-point plan for fixing all the issues, explicitly avoiding approaches that were already tried and failed. Be specific about:
   - What aspects of the tests need to change
   - Which queries should be used
   - How event handling should be modified
   - What assertions need to be updated
   - Any other required changes

5. Determine if mocking is needed. If so, describe:
   - What needs to be mocked
   - How the mocks should be implemented
   - If any providers are needed

DO NOT provide any code in your response. Focus on analysis and planning only.

## Additional Guidelines

- DO NOT repeat strategies that have already been tried and failed in previous attempts
- If you see patterns of failure in previous plans, use that knowledge to inform a new approach
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
        rtlFixHistory,
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
