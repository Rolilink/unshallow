import { NodeResult } from '../interfaces/node.js';
import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { callOpenAI } from '../utils/openai.js';
import { generateConversionPrompt } from '../utils/generate-prompts.js';

/**
 * Converts the Enzyme test to RTL using an LLM
 */
export const convertToRTLNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  try {
    // Generate the prompt for the conversion
    const prompt = generateConversionPrompt(
      file.originalTest,
      file.componentContext || ''
    );

    // Call OpenAI with the prompt
    const response = await callOpenAI(prompt, file.apiKey);

    // Extract the RTL test from the response
    const rtlTest = response.trim();

    return {
      file: {
        ...file,
        rtlTest,
        currentStep: WorkflowStep.CONVERT_TO_RTL,
      },
    };
  } catch (error) {
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
