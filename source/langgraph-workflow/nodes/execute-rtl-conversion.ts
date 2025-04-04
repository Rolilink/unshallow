import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured, rtlConversionExecutorSchema } from '../utils/openai.js';

/**
 * Executes the conversion plan from Enzyme to RTL tests
 */
export const executeRtlConversionNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[execute-rtl-conversion] Executing conversion plan from Enzyme to RTL`);

  if (!file.fixPlan) {
    console.error(`[execute-rtl-conversion] No conversion plan available, cannot execute conversion`);
    return {
      file: {
        ...file,
        status: 'failed',
        error: new Error('No conversion plan available to execute'),
        currentStep: WorkflowStep.CONVERT_TO_RTL_FAILED,
      },
    };
  }

  try {
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

    // Format imports section if available
    let importsSection = '';
    if (file.context.imports && Object.keys(file.context.imports).length > 0) {
      importsSection = `
## Related Imports & Dependencies
These are the imports and dependencies related to the component being tested:

${Object.entries(file.context.imports).map(([filename, content]) => `
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

    // Convert the conversion plan to JSON for the prompt
    const conversionPlanJSON = JSON.stringify({
      explanation: file.fixPlan.explanation,
      plan: file.fixPlan.plan,
      mockingNeeded: file.fixPlan.mockingNeeded,
      mockStrategy: file.fixPlan.mockStrategy
    }, null, 2);

    // Generate the prompt for executing the conversion
    const executorPrompt = `
Act as a senior React developer with deep expertise in TypeScript, Jest, Enzyme, and React Testing Library. Your task is to implement a conversion from Enzyme to React Testing Library based on the provided plan. Create a complete, well-structured React Testing Library test file.

## Component Under Test
\`\`\`tsx
${file.context.componentCode}
\`\`\`

## Original Enzyme Test
\`\`\`tsx
${file.content}
\`\`\`

## Conversion Plan
This JSON contains the planner's instructions:
\`\`\`json
${conversionPlanJSON}
\`\`\`
${importsSection}${examplesSection}${extraContextSection}

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

## Conversion Instructions

1. Follow the conversion plan provided above.
2. Create a complete RTL test file with all the necessary imports.
3. Replace all Enzyme patterns with equivalent RTL patterns:
   - Replace shallow/mount with RTL's render
   - Replace Enzyme selectors with appropriate RTL queries
   - Replace Enzyme's simulate with userEvent or fireEvent
   - Update assertions to match RTL patterns
4. Implement any necessary mocks as described in the plan.
5. Add setup and cleanup code if needed.
6. Convert all test cases while preserving the original test coverage and intent.
7. Use async/await or waitFor for async operations.
8. Ensure all imports are correct and complete.

## Important RTL-Specific Reminders

- Import \`render\`, \`screen\`, and other utilities from '@testing-library/react'
- Import \`userEvent\` from '@testing-library/user-event'
- Use \`screen\` object for queries (e.g., \`screen.getByText()\`)
- Use \`userEvent\` for user interactions where possible
- For cleanup, either rely on RTL's auto-cleanup or explicitly call \`cleanup()\`
- For async tests, prefer \`findBy\` queries or wrap assertions in \`waitFor\`

## Output

Return the complete, converted RTL test file. Make sure it's ready to run without any additional modifications needed.
`;

    console.log(`[execute-rtl-conversion] Calling OpenAI to execute conversion plan`);

    // Call OpenAI with the prompt and RTL conversion executor schema
    const response = await callOpenAIStructured(executorPrompt, rtlConversionExecutorSchema);

    // Log the executor response
    console.log(`[execute-rtl-conversion] Conversion explanation: ${response.explanation}`);

    // Return the updated state with the converted test
    return {
      file: {
        ...file,
        rtlTest: response.testContent.trim(),
        fixExplanation: response.explanation,
        fixPlan: undefined, // Clear the fix plan as it's been executed
        originalTest: file.content, // Store the original test for reference
        currentStep: WorkflowStep.RUN_TEST,
      },
    };
  } catch (error) {
    console.error(`[execute-rtl-conversion] Error: ${error instanceof Error ? error.message : String(error)}`);

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
