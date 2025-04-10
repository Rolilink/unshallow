import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { callOpenAIStructured } from '../utils/openai.js';
import { planRtlConversionPrompt } from '../prompts/plan-rtl-conversion-prompt.js';
import { z } from 'zod';
import { formatImports } from '../utils/format-utils.js';

// Define schema for plan RTL conversion output
export const PlanRtlConversionOutputSchema = z.object({
  plan: z.string().describe("A detailed plan for how to convert the test to RTL"),
  explanation: z.string().describe("A concise explanation of the migration approach")
});

export type PlanRtlConversionOutput = z.infer<typeof PlanRtlConversionOutputSchema>;

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
    // Format the prompt using the template without code block formatting
    const formattedPrompt = await planRtlConversionTemplate.format({
      testFile: file.content, // Use content directly
      componentName: file.context.componentName,
      componentSourceCode: file.context.componentCode, // Use component code directly
      componentFileImports: formatImports(file.context.imports),
      userProvidedContext: file.context.extraContext || '',
      supportingExamples: file.context.examples ? JSON.stringify(file.context.examples) : ''
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
