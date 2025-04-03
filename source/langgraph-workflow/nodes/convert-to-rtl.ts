import { NodeResult } from '../interfaces/node.js';
import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { callOpenAI } from '../utils/openai.js';

/**
 * Converts the Enzyme test to React Testing Library
 */
export const convertToRTLNode = async (state: WorkflowState, config?: { apiKey?: string }): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[convert-to-rtl] Converting: ${file.path}`);

  try {
    // Generate the prompt for conversion
    const prompt = `
# Task: Convert Enzyme Test to React Testing Library

## Original Component
\`\`\`tsx
${file.context.componentCode}
\`\`\`

## Original Enzyme Test
\`\`\`tsx
${file.content}
\`\`\`

## Context
${file.componentContext || 'No additional context provided.'}

## Instructions
1. Rewrite the Enzyme test using React Testing Library.
2. Ensure imports are correctly updated.
3. Use proper RTL queries and assertions.
4. Return ONLY the converted test code, with no explanations.
5. Don't return the code in \`\`\`tsx\`\`\` tags, just return the raw code with a comment at the top saying // unshallowed by AI.
`;

    console.log(`[convert-to-rtl] Calling OpenAI for conversion`);

    // Call OpenAI with the prompt, using the API key from config
    const response = await callOpenAI(prompt, config?.apiKey);

    // Return the updated state with the generated test
    return {
      file: {
        ...file,
        rtlTest: response.trim(),
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
