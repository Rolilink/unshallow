import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { executeRtlConversionPrompt } from '../prompts/execute-rtl-conversion-prompt.js';
import { callOpenAIStructured } from '../utils/openai.js';
import { z } from 'zod';
import { formatImports } from '../utils/format-utils.js';

// Define the schema using Zod
export const ExecuteRtlConversionOutputSchema = z.object({
  rtl: z.string().describe("The complete RTL test implementation")
});

export type ExecuteRtlConversionOutput = z.infer<typeof ExecuteRtlConversionOutputSchema>;

// Create the PromptTemplate for the convert RTL template
export const executeRtlConversionTemplate = PromptTemplate.fromTemplate(executeRtlConversionPrompt);

/**
 * Executes the conversion from Enzyme to RTL
 * Uses the plan from the previous step to guide the implementation
 */
export const executeRtlConversionNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[execute-rtl-conversion] Executing RTL conversion`);

  try {
    // Skip if the status is failed or no plan is available
    if (file.status === 'failed' || !file.fixPlan?.plan) {
      console.log(`[execute-rtl-conversion] Skipping, status=${file.status}, plan=${!!file.fixPlan?.plan}`);
      return {
        file: {
          ...file,
          status: file.status || 'failed',
          error: file.error || new Error('Missing plan for conversion'),
          currentStep: WorkflowStep.INITIALIZE,
        },
      };
    }

    // Format the prompt using the template
    const formattedPrompt = await executeRtlConversionTemplate.format({
      testFile: file.content,
      componentName: file.context.componentName,
      componentSourceCode: file.context.componentCode,
      componentFileImports: formatImports(file.context.componentImports || {}),
      userProvidedContext: file.context.extraContext || '',
      gherkinPlan: file.fixPlan.plan,
      migrationGuidelines: '',
      supportingExamples: '' // Add the missing parameter
    });

    console.log(`[execute-rtl-conversion] Calling OpenAI to execute conversion`);

    // Call OpenAI with the prompt
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: ExecuteRtlConversionOutputSchema,
      nodeName: 'execute_rtl_conversion'
    });

    console.log(`[execute-rtl-conversion] Conversion complete`);

    // Return the updated state with the generated RTL test
    return {
      file: {
        ...file,
        rtlTest: response.rtl,
        status: file.status, // Keep existing status instead of hardcoding to 'processing'
        currentStep: WorkflowStep.EXECUTE_RTL_CONVERSION,
      },
    };
  } catch (error) {
    console.error(`[execute-rtl-conversion] Error: ${error instanceof Error ? error.message : String(error)}`);

    // If there's an error, mark the process as failed
    return {
      file: {
        ...file,
        error: error instanceof Error ? error : new Error(String(error)),
        status: 'failed',
        currentStep: WorkflowStep.INITIALIZE,
      },
    };
  }
};
