import { NodeResult } from '../interfaces/node.js';
import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { callOpenAIStructured } from '../utils/openai.js';

/**
 * Converts the Enzyme test to React Testing Library
 */
export const convertToRTLNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[convert-to-rtl] Converting: ${file.path}`);

  try {
    // Generate the prompt for conversion
    const prompt = `
Act as a senior React developer with experience in TypeScript, Enzyme, and React Testing Library. Your task is to convert the following Enzyme test to React Testing Library.

Tested Component:
\`\`\`tsx
${file.context.componentCode}
\`\`\`

Original Enzyme Test:
\`\`\`tsx
${file.content}
\`\`\`

Additional Instructions:
${file.componentContext || 'No additional instructions provided.'}

Instructions:

1. Rewrite the Enzyme test using React Testing Library.
2. Update all imports to match RTL usage.
3. Use queries and assertions that follow accessibility best practices and React Testing Library's guiding principles.
4. Use the \`screen\` object for all queries (e.g., \`screen.getByRole(...)\`).
5. Simulate user interactions using \`userEvent\` instead of \`fireEvent\`.
6. For async elements or effects, use \`findBy\` queries or wrap assertions with \`waitFor\`.
7. Do not test implementation details such as CSS class names, inline styles, or internal component logic.
8. Avoid mocking internal components or logic unless absolutely necessary. Favor integration-style testing.
9. Do not use snapshot testing.
10. Focus on testing the component from the user's perspective, simulating real interactions.
11. Your explanation should include:
    - A summary of what was changed.
    - Which Enzyme patterns were replaced and why.
    - Why specific React Testing Library patterns were chosen.
12. For the \`testContent\`, return ONLY the converted test code. Do not include backticks, file names, or any additional explanation.

Query Priority Guidelines:

Always prefer queries that simulate how users interact with your UI, in the following order:

1. Accessible Queries (most preferred)
- getByRole: Use with the \`name\` option when applicable (e.g., \`getByRole('button', { name: /submit/i })\`).
- getByLabelText: Ideal for form fields with visible labels.
- getByPlaceholderText: Acceptable if no labels exist.
- getByText: Useful for non-interactive content or static text.
- getByDisplayValue: For inputs with pre-filled values.

2. Semantic Queries
- getByAltText: For images or custom elements with alt attributes.
- getByTitle: Use sparingly; limited accessibility support.

3. Test IDs (least preferred)
- getByTestId: Only use when other options are not viable (e.g., content is dynamic or lacks semantic meaning).

Always follow this order: Accessible Queries > Semantic Queries > Test IDs.

Do not use CSS selectors, class names, or style-based queries. Avoid testing implementation details. Write tests that reflect how real users would interact with the component.
`;


    console.log(`[convert-to-rtl] Calling OpenAI for conversion`);

    // Call OpenAI with the prompt
    const response = await callOpenAIStructured(prompt);

    // Log the full explanation
    console.log(`[convert-to-rtl] Conversion explanation: ${response.explanation}`);

    // Return the updated state with the generated test
    return {
      file: {
        ...file,
        rtlTest: response.testContent.trim(),
        fixExplanation: response.explanation,
        currentStep: WorkflowStep.CONVERT_TO_RTL,
      },
    };
  } catch (error) {
    console.error(`[convert-to-rtl] Error: ${error instanceof Error ? error.message : String(error)}`);

    return {
      file: {
        ...file,
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
        currentStep: WorkflowStep.CONVERT_TO_RTL_FAILED,
      },
    };
  }
};
