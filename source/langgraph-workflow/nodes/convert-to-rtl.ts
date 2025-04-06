import { NodeResult } from '../interfaces/node.js';
import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { callOpenAIStructured, rtlConversionExecutorSchema } from '../utils/openai.js';
import { PromptTemplate } from "@langchain/core/prompts";
import { executeRtlConversionPrompt } from '../prompts/execute-rtl-conversion-prompt.js';
import path from 'path';
import { z } from 'zod';

// Define schema for convertToRtl output
export const ConvertToRtlOutputSchema = z.object({
  rtl: z.string().describe("The complete RTL test implementation")
});

export type ConvertToRtlOutput = z.infer<typeof ConvertToRtlOutputSchema>;

// Helper functions to format code with appropriate syntax highlighting
function formatTestFile(content: string, filename: string): string {
  const extension = path.extname(filename).slice(1);
  return `\`\`\`${extension}\n// ${filename}\n${content}\n\`\`\``;
}

function formatComponentCode(content: string, componentName: string, componentPath: string): string {
  const extension = path.extname(componentPath).slice(1);
  return `\`\`\`${extension}\n// ${componentPath} (${componentName})\n${content}\n\`\`\``;
}

function formatImports(imports: Record<string, string> | undefined): string {
  if (!imports || Object.keys(imports).length === 0) return '{}';

  let result = '';
  for (const [importPath, content] of Object.entries(imports)) {
    const extension = path.extname(importPath).slice(1);
    result += `\`\`\`${extension}\n// Imported by the component: ${importPath}\n${content}\n\`\`\`\n\n`;
  }
  return result;
}

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
    // Get file extension and component path for better formatting
    const testFilePath = file.path;
    const componentPath = file.context.componentName ?
      `${file.context.componentName}${path.extname(testFilePath)}` :
      'Component.tsx';

    // Format the prompt using the template with properly formatted code blocks
    const formattedPrompt = await executeRtlConversionTemplate.format({
      testFile: formatTestFile(file.content, path.basename(testFilePath)),
      componentName: file.context.componentName,
      componentSourceCode: formatComponentCode(
        file.context.componentCode,
        file.context.componentName,
        componentPath
      ),
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
    // Extract the test file path
    const testFilePath = file.path;

    // Get component path for better formatting
    const componentPath = file.context.componentName ?
      `${file.context.componentName}${path.extname(testFilePath)}` :
      'Component.tsx';

    // Format the prompt using the template
    const formattedPrompt = await convertToRtlTemplate.format({
      testFile: formatTestFile(file.content, path.basename(testFilePath)),
      componentName: file.context.componentName,
      componentSourceCode: formatComponentCode(
        file.context.componentCode,
        file.context.componentName,
        componentPath
      ),
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
