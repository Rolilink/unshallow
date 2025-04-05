import { WorkflowState, WorkflowStep, FixPlan } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured, rtlFixPlannerSchema } from '../utils/openai.js';
import { planRtlFixPrompt } from '../prompts/plan-rtl-fix-prompt.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { migrationGuidelines } from '../prompts/migration-guidelines.js';

// Create a PromptTemplate for the RTL fix planner
export const planRtlFixTemplate = PromptTemplate.fromTemplate(planRtlFixPrompt);

/**
 * Plans fixes for RTL test failures
 */
export const planRtlFixNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[plan-rtl-fix] Planning fix for ${file.path}`);

  try {
    if (!file.rtlTest) {
      throw new Error('No RTL test available to fix');
    }

    if (!file.testResult) {
      throw new Error('No test result available to analyze');
    }

    // Get the test error from the result
    const testError = file.testResult.errors?.join('\n') || file.testResult.output || 'Unknown test error';

    // Initialize RTL fix history if it doesn't exist
    const rtlFixHistory = file.rtlFixHistory || [];

    // Get the last attempt from history (if any)
    const lastAttempt = rtlFixHistory.length > 0 ? rtlFixHistory[rtlFixHistory.length - 1] : null;

    // Format the prompt using the template
    const formattedPrompt = await planRtlFixTemplate.format({
      testFile: file.originalTest,
      componentName: file.context.componentName,
      componentSourceCode: file.context.componentCode,
      componentFileImports: JSON.stringify(file.context.imports),
      supportingExamples: file.context.examples ? JSON.stringify(file.context.examples) : '',
      userInstructions: file.context.extraContext || '',
      explanation: file.fixExplanation || '',
      previousCode: file.originalTest,
      previousPlan: lastAttempt?.plan?.plan || '',
      previousPlanExplanation: lastAttempt?.plan?.explanation || '',
      previousOutput: file.rtlTest,
      previousError: testError,
      previousReflection: file.lastReflection || '',
      attemptSummary: file.attemptSummary || '',
      migrationGuidelines,
    });

    console.log(`[plan-rtl-fix] Calling OpenAI for fix plan`);

    // Call OpenAI with the prompt and RTL-specific planner schema
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: rtlFixPlannerSchema
    });

    // Log the planner response
    console.log(`[plan-rtl-fix] Fix plan: ${response.explanation}`);

    // Create a fix plan
    const fixPlan: FixPlan = {
      explanation: response.explanation,
      plan: response.plan,
      timestamp: new Date().toISOString()
    };

    return {
      file: {
        ...file,
        fixPlan: fixPlan,
        currentStep: WorkflowStep.PLAN_RTL_FIX,
      },
    };
  } catch (error) {
    console.error(`[plan-rtl-fix] Error: ${error instanceof Error ? error.message : String(error)}`);

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
