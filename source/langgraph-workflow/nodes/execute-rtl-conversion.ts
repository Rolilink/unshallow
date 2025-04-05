import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured, rtlConversionExecutorSchema } from '../utils/openai.js';
import { executeRtlConversionPrompt } from '../prompts/execute-rtl-conversion-prompt.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { migrationGuidelines } from '../prompts/migration-guidelines.js';

// Create a PromptTemplate for the RTL conversion prompt
export const executeRtlConversionTemplate = PromptTemplate.fromTemplate(executeRtlConversionPrompt);

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
    // Format the prompt using the template
    const formattedPrompt = await executeRtlConversionTemplate.format({
      testFile: file.content,
      componentName: file.context.componentName,
      componentSourceCode: file.context.componentCode,
      componentFileImports: JSON.stringify(file.context.imports),
      userInstructions: file.context.extraContext || '',
      plan: file.fixPlan.plan,
      migrationGuidelines,
    });

    console.log(`[execute-rtl-conversion] Calling OpenAI to execute conversion plan`);

    // Call OpenAI with the prompt and RTL conversion executor schema
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: rtlConversionExecutorSchema
    });

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
