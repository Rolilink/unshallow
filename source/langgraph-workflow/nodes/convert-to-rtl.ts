import { NodeResult } from '../interfaces/node.js';
import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { callOpenAIStructured, rtlConversionExecutorSchema } from '../utils/openai.js';
import { PromptTemplate } from "@langchain/core/prompts";
import { executeRtlConversionPrompt } from '../prompts/execute-rtl-conversion-prompt.js';
import { z } from 'zod';
import { formatImports } from '../utils/format-utils.js';
import { logger } from '../utils/logging-callback.js';

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
  const NODE_NAME = 'convert-to-rtl';

  await logger.logNodeStart(NODE_NAME, `Converting: ${file.path}`);

  try {
    // Format the prompt using the template with properly formatted code blocks
    const formattedPrompt = await executeRtlConversionTemplate.format({
      testFile: file.content,
      componentName: file.context.componentName,
      componentSourceCode: file.context.componentCode,
      // Filter out the component's own file from imports
      componentFileImports: formatImports(file.context.componentImports || {}),
      userProvidedContext: file.context.extraContext || '',
      gherkinPlan: '', // No plan for direct conversion
      migrationGuidelines: '',
      supportingExamples: ''
    });

    await logger.info(NODE_NAME, `Calling OpenAI for conversion`);

    // Call OpenAI with the prompt
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: rtlConversionExecutorSchema
    });

    // Log the RTL test and explanation
    await logger.logRtlTest(NODE_NAME, response.testContent.trim(), response.explanation);
    await logger.success(NODE_NAME, `Conversion completed`);

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
    await logger.error(NODE_NAME, `Error converting to RTL`, error);

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
  const NODE_NAME = 'convert-to-rtl';

  await logger.logNodeStart(NODE_NAME, `Converting Enzyme test to RTL directly`);

  try {
    // Format the prompt using the template
    const formattedPrompt = await convertToRtlTemplate.format({
      testFile: file.content,
      componentName: file.context.componentName,
      componentSourceCode: file.context.componentCode,
      // Filter out the component's own file from imports
      componentFileImports: formatImports(file.context.componentImports || {}),
      userProvidedContext: file.context.extraContext || '',
      gherkinPlan: '', // No plan for direct conversion
      migrationGuidelines: '',
      supportingExamples: ''
    });

    await logger.info(NODE_NAME, `Calling OpenAI to convert test`);

    // Call OpenAI with the prompt
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: ConvertToRtlOutputSchema,
      // Use o4-mini if reasoningExecution is enabled
      model: state.file.reasoningExecution ? 'o4-mini' : 'gpt-4.1',
      nodeName: 'convert_to_rtl'
    });

    // Log the generated RTL test
    await logger.logRtlTest(NODE_NAME, response.rtl);
    await logger.success(NODE_NAME, `Conversion complete`);

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
    await logger.error(NODE_NAME, `Error during direct RTL conversion`, error);

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
