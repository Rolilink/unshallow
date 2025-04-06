import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { callOpenAIStructured } from '../utils/openai.js';
import { planRtlConversionPrompt } from '../prompts/plan-rtl-conversion-prompt.js';
import path from 'path';
import { z } from 'zod';

// Define schema for plan RTL conversion output
export const PlanRtlConversionOutputSchema = z.object({
  plan: z.string().describe("A detailed plan for how to convert the test to RTL"),
  explanation: z.string().describe("A concise explanation of the migration approach")
});

export type PlanRtlConversionOutput = z.infer<typeof PlanRtlConversionOutputSchema>;

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

// Create the PromptTemplate for the plan RTL conversion template
export const planRtlConversionTemplate = PromptTemplate.fromTemplate(planRtlConversionPrompt);

/**
 * Plans the conversion from Enzyme to RTL
 * Using a planner-executor pattern for better quality conversion
 */
export const planRtlConversionNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[plan-rtl-conversion] Planning RTL conversion`);

  try {
    // Get file extension and component path for better formatting
    const testFilePath = file.path;
    const componentPath = file.context.componentName ?
      `${file.context.componentName}${path.extname(testFilePath)}` :
      'Component.tsx';

    // Format the prompt using the template with properly formatted code blocks
    const formattedPrompt = await planRtlConversionTemplate.format({
      testFile: formatTestFile(file.content, path.basename(testFilePath)),
      componentName: file.context.componentName,
      componentSourceCode: formatComponentCode(
        file.context.componentCode,
        file.context.componentName,
        componentPath
      ),
      componentFileImports: formatImports(file.context.imports),
      userProvidedContext: file.context.extraContext || '',
      supportingExamples: ''
    });

    console.log(`[plan-rtl-conversion] Calling OpenAI to plan conversion`);

    // Call OpenAI with the prompt and RTL planning schema
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: PlanRtlConversionOutputSchema,
      nodeName: 'plan_rtl_conversion'
    });

    // Log the planner response
    console.log(`[plan-rtl-conversion] Planned conversion with ${response.plan.split('\n').length} steps`);

    // Return the updated state with the conversion plan
    return {
      file: {
        ...file,
        fixPlan: {
          plan: response.plan,
          explanation: response.explanation,
          timestamp: new Date().toISOString()
        },
        currentStep: WorkflowStep.PLAN_RTL_CONVERSION,
      },
    };
  } catch (error) {
    console.error(`[plan-rtl-conversion] Error: ${error instanceof Error ? error.message : String(error)}`);

    // If there's an error, mark the process as failed
    return {
      file: {
        ...file,
        error: error instanceof Error ? error : new Error(String(error)),
        status: 'failed',
        currentStep: WorkflowStep.PLAN_RTL_CONVERSION,
      },
    };
  }
};
