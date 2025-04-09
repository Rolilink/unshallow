import { NodeResult } from '../interfaces/node.js';
import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { callOpenAIStructured, rtlConversionExecutorSchema } from '../utils/openai.js';
import { PromptTemplate } from "@langchain/core/prompts";
import { executeRtlConversionPrompt } from '../prompts/execute-rtl-conversion-prompt.js';
import { z } from 'zod';
import { formatImports } from '../utils/format-utils.js';

// Define schema for convertToRtl output
export const ConvertToRtlOutputSchema = z.object({
  rtl: z.string().describe("The complete RTL test implementation")
});

export type ConvertToRtlOutput = z.infer<typeof ConvertToRtlOutputSchema>;

// Create a PromptTemplate for the RTL conversion prompt
export const executeRtlConversionTemplate = PromptTemplate.fromTemplate(executeRtlConversionPrompt);

// Create the PromptTemplate for the convert to RTL template
export const convertToRtlTemplate = PromptTemplate.fromTemplate(executeRtlConversionPrompt);

/**
 * Converts the Enzyme test to React Testing Library
 */
export const convertToRTLNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[convert-to-rtl] Converting: ${file.path}`);

  try {
    // Format the prompt using the template with properly formatted code blocks
    const formattedPrompt = await executeRtlConversionTemplate.format({
      testFile: file.content,
      componentName: file.context.componentName,
      componentSourceCode: file.context.componentCode,
      componentFileImports: formatImports(file.context.imports),
      userProvidedContext: file.context.extraContext || '',
      gherkinPlan: '', // No plan for direct conversion
      migrationGuidelines: '',
      supportingExamples: ''
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

/**
 * Directly converts an Enzyme test to RTL without planning
 */
export const convertToRtlNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[convert-to-rtl] Converting Enzyme test to RTL directly`);

  try {
    // Format the prompt using the template
    const formattedPrompt = await convertToRtlTemplate.format({
      testFile: file.content,
      componentName: file.context.componentName,
      componentSourceCode: file.context.componentCode,
      componentFileImports: formatImports(file.context.imports),
      userProvidedContext: file.context.extraContext || '',
      gherkinPlan: '', // No plan for direct conversion
      migrationGuidelines: '',
      supportingExamples: ''
    });

    console.log(`[convert-to-rtl] Calling OpenAI to convert test`);

    // Call OpenAI with the prompt
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: ConvertToRtlOutputSchema,
      nodeName: 'convert_to_rtl'
    });

    console.log(`[convert-to-rtl] Conversion complete`);

    // Return the updated state with the generated RTL test
    return {
      file: {
        ...file,
        rtlTest: response.rtl,
        originalTest: file.content, // Store the original test for reference
        currentStep: WorkflowStep.RUN_TEST,
      },
    };
  } catch (error) {
    console.error(`[convert-to-rtl] Error: ${error instanceof Error ? error.message : String(error)}`);

    // If there's an error, mark the process as failed
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
