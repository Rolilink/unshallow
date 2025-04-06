import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { executeRtlConversionPrompt } from '../prompts/execute-rtl-conversion-prompt.js';
import { callOpenAIStructured } from '../utils/openai.js';
import path from 'path';
import { z } from 'zod';

// Define the schema using Zod
export const ExecuteRtlConversionOutputSchema = z.object({
  rtl: z.string().describe("The complete RTL test implementation")
});

export type ExecuteRtlConversionOutput = z.infer<typeof ExecuteRtlConversionOutputSchema>;

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

    // Extract the test file path
    const testFilePath = file.path;

    // Get component path for better formatting
    const componentPath = file.context.componentName ?
      `${file.context.componentName}${path.extname(testFilePath)}` :
      'Component.tsx';

    // Format the prompt using the template
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
