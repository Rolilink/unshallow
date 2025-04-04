import { WorkflowState, WorkflowStep, FixPlan } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured, rtlConversionPlannerSchema } from '../utils/openai.js';

/**
 * Plans the conversion from Enzyme to RTL tests
 */
export const planRtlConversionNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[plan-rtl-conversion] Planning conversion from Enzyme to RTL`);

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

    // Generate the prompt for analysis and planning
    const plannerPrompt = `
Act as a senior React developer with deep expertise in TypeScript, Jest, Enzyme, and React Testing Library. I need your help to plan the conversion of an Enzyme test to React Testing Library. Don't provide any code in your response - just analyze the test and plan the conversion.

## Component Under Test
\`\`\`tsx
${file.context.componentCode}
\`\`\`

## Original Enzyme Test
\`\`\`tsx
${file.content}
\`\`\`
${importsSection}${examplesSection}${extraContextSection}

## Task

1. Analyze the Enzyme test to identify its structure, mocks, and test cases.
2. Create a comprehensive plan to convert it to React Testing Library, covering:
   - Required imports for RTL
   - Setup and cleanup (if needed)
   - Converting shallow/mount rendering to RTL's render
   - Replacing Enzyme selectors with RTL queries (following query priority best practices)
   - Updating event simulations to use RTL/user-event
   - Modifying assertions to match RTL patterns
   - Handling any mocks or providers needed
   - Addressing any async behavior

3. Determine if mocking is needed. If so, describe:
   - What needs to be mocked
   - How the mocks should be implemented
   - If any providers are needed

DO NOT provide any code in your response. Focus on analysis and planning only.

## Guidelines

- React Testing Library is centered on testing components as users would interact with them
- Prefer RTL queries in this order: getByRole, getByLabelText, getByPlaceholderText, getByText, getByDisplayValue, getByAltText, getByTitle, getByTestId
- Use userEvent for interactions over fireEvent when possible
- Remember that RTL does not have shallow rendering - always test with the fully rendered component
- For async operations, use findBy queries or wrap assertions with waitFor
- Only mock what's absolutely necessary (external APIs, complex behavior unrelated to the test)
- Consider that Enzyme's verbose access to component internals is not available or encouraged in RTL
`;

    console.log(`[plan-rtl-conversion] Calling OpenAI to plan conversion`);

    // Call OpenAI with the prompt and RTL conversion planner schema
    const response = await callOpenAIStructured(plannerPrompt, rtlConversionPlannerSchema);

    // Log the planner response
    console.log(`[plan-rtl-conversion] Conversion analysis: ${response.explanation}`);
    console.log(`[plan-rtl-conversion] Conversion plan: ${response.plan}`);
    console.log(`[plan-rtl-conversion] Mocking needed: ${response.mockingNeeded ? 'Yes' : 'No'}`);
    if (response.mockingNeeded) {
      console.log(`[plan-rtl-conversion] Mock strategy: ${response.mockStrategy}`);
    }

    // Create a conversion plan
    const conversionPlan: FixPlan = {
      explanation: response.explanation,
      plan: response.plan,
      mockingNeeded: response.mockingNeeded,
      mockStrategy: response.mockStrategy,
      timestamp: new Date().toISOString()
    };

    // Return the updated state with the conversion plan
    return {
      file: {
        ...file,
        fixPlan: conversionPlan, // Reuse the fixPlan field
        currentStep: WorkflowStep.PLAN_RTL_CONVERSION,
      },
    };
  } catch (error) {
    console.error(`[plan-rtl-conversion] Error: ${error instanceof Error ? error.message : String(error)}`);

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
