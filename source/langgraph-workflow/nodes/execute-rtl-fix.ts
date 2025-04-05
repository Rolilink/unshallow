import { WorkflowState, WorkflowStep, FixAttempt } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured, rtlFixExecutorSchema } from '../utils/openai.js';
import { executeRtlFixPrompt } from '../prompts/execute-rtl-fix-prompt.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { migrationGuidelines } from '../prompts/migration-guidelines.js';
import { formatComponentImports } from '../utils/formatting.js';

// Create a PromptTemplate for the RTL fix prompt
export const executeRtlFixTemplate = PromptTemplate.fromTemplate(executeRtlFixPrompt);

/**
 * Executes the fix plan for RTL test failures
 */
export const executeRtlFixNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[execute-rtl-fix] Executing fix plan (retry ${file.retries.rtl + 1}/${file.maxRetries})`);

  if (!file.fixPlan) {
    console.error(`[execute-rtl-fix] No fix plan available, cannot execute fixes`);
    return {
      file: {
        ...file,
        status: 'failed',
        error: new Error('No fix plan available to execute'),
        currentStep: WorkflowStep.CONVERT_TO_RTL_FAILED,
      },
    };
  }

  try {
    const testError = file.testResult?.errors?.join('\n') || file.testResult?.output || 'Unknown test error';

    // Initialize RTL fix history if it doesn't exist
    const rtlFixHistory = file.rtlFixHistory || [];

    // If we have a current test and it's not the first attempt, add it to history
    if (file.rtlTest && file.retries.rtl > 0) {
      // Add the current attempt to history
      const attempt: FixAttempt = {
        attempt: file.retries.rtl,
        timestamp: new Date().toISOString(),
        testContentBefore: file.rtlTest || '',
        testContentAfter: file.rtlTest,
        error: testError,
        explanation: file.fixExplanation,
        plan: file.fixPlan ? {
          explanation: file.fixPlan.explanation,
          plan: file.fixPlan.plan,
          timestamp: file.fixPlan.timestamp
        } : undefined
      };
      rtlFixHistory.push(attempt);

      console.log(`[execute-rtl-fix] Added attempt ${file.retries.rtl} to RTL fix history (${rtlFixHistory.length} total attempts)`);
    }

    // Format the prompt using the template
    const formattedPrompt = await executeRtlFixTemplate.format({
      componentName: file.context.componentName,
      componentSourceCode: file.context.componentCode,
      componentFileImports: formatComponentImports(file.context.imports),
      testFile: file.rtlTest || '',
      plan: file.fixPlan.plan,
      error: testError,
      userInstructions: file.context.extraContext || '',
      migrationGuidelines,
    });

    console.log(`[execute-rtl-fix] Calling OpenAI to execute the fix plan`);

    // Call OpenAI with the prompt and RTL-specific executor schema
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: rtlFixExecutorSchema,
      nodeName: 'execute_rtl_fix'
    });

    // Log the executor response
    console.log(`[execute-rtl-fix] Fix explanation: ${response.explanation}`);

    // Return the updated state with the fixed test
    return {
      file: {
        ...file,
        rtlTest: response.testContent.trim(),
        fixExplanation: response.explanation,
        rtlFixHistory: rtlFixHistory, // Add RTL-specific fix history to state
        retries: {
          ...file.retries,
          rtl: file.retries.rtl + 1,
        },
        currentStep: WorkflowStep.RUN_TEST,
      },
    };
  } catch (error) {
    console.error(`[execute-rtl-fix] Error: ${error instanceof Error ? error.message : String(error)}`);

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
