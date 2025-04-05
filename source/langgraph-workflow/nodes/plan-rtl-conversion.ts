import { WorkflowState, WorkflowStep, FixPlan } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured, rtlConversionPlannerSchema } from '../utils/openai.js';
import { planRtlConversionPrompt } from '../prompts/plan-rtl-conversion-prompt.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { migrationGuidelines } from '../prompts/migration-guidelines.js';
import { formatComponentImports, formatExamples } from '../utils/formatting.js';

// Create a PromptTemplate for the RTL conversion planner
export const planRtlConversionTemplate = PromptTemplate.fromTemplate(planRtlConversionPrompt);

/**
 * Plans the conversion from Enzyme to RTL tests
 */
export const planRtlConversionNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[plan-rtl-conversion] Planning conversion for ${file.path}`);

  try {
    // Format the prompt using the template
    const formattedPrompt = await planRtlConversionTemplate.format({
      testFile: file.content,
      componentName: file.context.componentName,
      componentSourceCode: file.context.componentCode,
      componentFileImports: formatComponentImports(file.context.imports),
      supportingExamples: formatExamples(file.context.examples),
      userInstructions: file.context.extraContext || '',
      migrationGuidelines,
    });

    console.log(`[plan-rtl-conversion] Calling OpenAI for conversion plan`);

    // Call OpenAI with the prompt and RTL conversion planner schema
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: rtlConversionPlannerSchema,
      nodeName: 'plan_rtl_conversion'
    });

    // Log the planner response
    console.log(`[plan-rtl-conversion] Plan: ${response.explanation}`);

    // Create a conversion plan
    const fixPlan: FixPlan = {
      explanation: response.explanation,
      plan: response.plan,
      timestamp: new Date().toISOString()
    };

    return {
      file: {
        ...file,
        fixPlan: fixPlan,
        currentStep: WorkflowStep.PLAN_RTL_CONVERSION,
      },
    };
  } catch (error) {
    console.error(`[plan-rtl-conversion] Error: ${error instanceof Error ? error.message : String(error)}`);

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
