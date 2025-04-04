import { WorkflowState, WorkflowStep, FixAttempt } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured, rtlFixExecutorSchema } from '../utils/openai.js';

/**
 * Formats previous code attempts for the prompt
 */
function formatPreviousCodeAttempts(history: FixAttempt[]): string {
  if (!history || history.length === 0) {
    return "No previous fix attempts.";
  }

  return history.map((attempt) => {
    return `
### Code Attempt ${attempt.attempt}
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
 * Executes the fix plan for RTL test failures
 */
export const executeRtlFixNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[execute-rtl-fix] Executing fix plan (retry ${file.retries.rtl + 1}/${file.maxRetries})`);

  if (!file.fixPlan) {
    console.error(`[execute-rtl-fix] No fix plan available, cannot execute fixes`);
    return {
      file: {
        ...file,
        status: 'failed',
        error: new Error('No fix plan available to execute'),
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
        explanation: file.fixExplanation,
        plan: file.fixPlan ? {
          explanation: file.fixPlan.explanation,
          plan: file.fixPlan.plan,
          mockingNeeded: file.fixPlan.mockingNeeded,
          mockStrategy: file.fixPlan.mockStrategy
        } : undefined
      });

      console.log(`[execute-rtl-fix] Added attempt ${file.retries.rtl} to RTL fix history (${rtlFixHistory.length} total attempts)`);
    }

    // Format previous code attempts for the prompt (not plans)
    const previousCodeAttemptsText = formatPreviousCodeAttempts(rtlFixHistory);

    // Convert the fix plan to JSON string for the prompt
    const fixPlanJSON = JSON.stringify({
      explanation: file.fixPlan.explanation,
      plan: file.fixPlan.plan,
      mockingNeeded: file.fixPlan.mockingNeeded,
      mockStrategy: file.fixPlan.mockStrategy
    }, null, 2);

    // Format examples section if available
    let examplesSection = '';
    if (file.context.examples && Object.keys(file.context.examples).length > 0) {
      examplesSection = `
## Example RTL Tests
These are examples of successful RTL tests in the codebase that you can reference:

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

    // Generate the prompt for executing fixes
    const executorPrompt = `
Act as a senior React developer with deep expertise in TypeScript, Jest, and React Testing Library. Your task is to implement fixes for all failing tests in the test file based on the provided plan. Modify only the parts of the test file necessary to address the issues described in the plan, ensuring that all changes remain within the file.

## Original Component
\`\`\`tsx
${file.context.componentCode}
\`\`\`

## Current RTL Test Code
\`\`\`tsx
${file.rtlTest}
\`\`\`

## Fix Plan
This JSON contains the planner's instructions:
\`\`\`json
${fixPlanJSON}
\`\`\`
${examplesSection}${extraContextSection}
## Previous Code Implementations
${previousCodeAttemptsText}

## Learning from Previous Attempts
Study the previous code implementations carefully. Previous approaches have failed to resolve the issues. Your implementation MUST:
- Avoid repeating the same coding patterns that have already been tried and failed
- Apply the current fix plan with a fresh implementation approach
- Take a different coding approach when previous similar implementations have failed
- Focus on the specific issues highlighted in the current plan

## Mocking & Provider Guidelines

- **Component Under Test:** Do not mock or alter the component under test; it must be rendered and tested as-is.
- **Mocking Dependencies:** You may mock external or internal dependencies such as hooks, utility functions, or API clients—but only if they are not React components.
- **Mocking Level:** Always mock dependencies at the first level. For example, if a hook is used by the component, mock the hook directly rather than its internal implementations.
- **Conditional Use of \`jest.requireActual\`:** Use \`jest.requireActual\` sparingly, and only to preserve parts of a module while overriding a specific export. Do not use it to import an entire library or for React components.
- **Provider Wrapping:** If the component relies on any context provider (for routing, forms, state management, internationalization, etc.), wrap the component using the appropriate testing provider. Handle any provider generically—do not assume a fixed list of libraries.
- **Examples of Safe Patterns:**
  - *Mocking a Hook:*
    \`\`\`tsx
    jest.mock('some-library', () => ({
      useSomeHook: jest.fn(() => [jest.fn(), {}]),
    }));
    \`\`\`
  - *Wrapping with a Provider (General):*
    \`\`\`tsx
    import { SomeProvider } from 'some-library';
    render(
      <SomeProvider value={/* test-specific value */}>
        <YourComponent />
      </SomeProvider>
    );
    \`\`\`
- Do not mock styling modules, UI libraries, or unrelated helpers unless they are directly causing runtime failures.

## Query Priority Guidelines

Always prefer queries that simulate real user interactions. Follow this order:

1. **Accessible Queries:**
   - \`getByRole\` (with the \`name\` option, e.g., \`screen.getByRole('button', { name: /submit/i })\`)
   - \`getByLabelText\`
   - \`getByPlaceholderText\`
   - \`getByText\`
   - \`getByDisplayValue\`
2. **Semantic Queries:**
   - \`getByAltText\`
   - \`getByTitle\`
3. **Test IDs (Least Preferred):**
   - \`getByTestId\`

Fallback to lower-priority queries only if needed for test stability.

## Instructions

1. Implement the fix plan while explicitly avoiding approaches that have already been tried and failed in previous attempts.
2. Modify only the test file and fix all the failing tests as described in the plan. Do not alter other tests or parts of the file.
3. Do not modify component code, project configuration, or dependencies.
4. Apply any mocks or provider wrappers exactly as described in the fix plan.
5. Ensure that all test file imports are correct and complete.
6. Use the \`screen\` object for queries.
7. Use \`userEvent\` for simulating user interactions.
8. For asynchronous operations, use \`findBy\` queries or wrap assertions with \`waitFor\`.
9. Do not use snapshot testing or assertions based solely on CSS classes or styles.
10. Follow the query priority guidelines provided above.

## Output

Return only the full, updated test file with all the failing tests fixed as per the plan. Do not include any explanations, comments, or partial code.
`;

    console.log(`[execute-rtl-fix] Calling OpenAI (model: gpt-4o-mini) to execute the fix plan`);

    // Call OpenAI with the prompt and RTL-specific executor schema
    const response = await callOpenAIStructured(executorPrompt, rtlFixExecutorSchema);

    // Log the executor response
    console.log(`[execute-rtl-fix] Fix explanation: ${response.explanation}`);

    // Return the updated state with the fixed test
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
        currentStep: WorkflowStep.RUN_TEST,
      },
    };
  } catch (error) {
    console.error(`[execute-rtl-fix] Error: ${error instanceof Error ? error.message : String(error)}`);

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
