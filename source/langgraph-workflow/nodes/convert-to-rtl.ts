import { NodeResult } from '../interfaces/node.js';
import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { callOpenAIStructured, rtlConversionExecutorSchema } from '../utils/openai.js';
import { PromptTemplate } from "@langchain/core/prompts";
import { executeRtlConversionPrompt } from '../prompts/execute-rtl-conversion-prompt.js';
import { migrationGuidelines } from '../prompts/migration-guidelines.js';

// Create a PromptTemplate for the RTL conversion prompt
export const executeRtlConversionTemplate = PromptTemplate.fromTemplate(executeRtlConversionPrompt);

/**
 * Converts the Enzyme test to React Testing Library
 */
export const convertToRTLNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[convert-to-rtl] Converting: ${file.path}`);

  try {
    // Format the prompt using the template
    const formattedPrompt = await executeRtlConversionTemplate.format({
      testFile: file.content,
      componentName: file.context.componentName,
      componentSourceCode: file.context.componentCode,
      componentFileImports: JSON.stringify(file.context.imports),
      userInstructions: file.componentContext || 'No additional instructions provided.',
      plan: '', // No plan for direct conversion
      migrationGuidelines,
    });

    console.log(`[convert-to-rtl] Calling OpenAI for conversion`);

    // Call OpenAI with the prompt
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: rtlConversionExecutorSchema
    });

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
