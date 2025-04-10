import { WorkflowState, WorkflowStep, FixAttempt } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured, tsFixResponseSchema } from '../utils/openai.js';
import { fixTsPrompt } from '../prompts/fix-ts-prompt.js';
import { PromptTemplate } from "@langchain/core/prompts";

// Create a PromptTemplate for the TS fix prompt
export const fixTsPromptTemplate = PromptTemplate.fromTemplate(fixTsPrompt);

/**
 * Fixes TypeScript errors in the RTL test
 */
export const fixTsErrorNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[fix-ts-error] Fixing TypeScript error for ${file.path}`);

  try {
    if (!file.tsCheck) {
      throw new Error('TypeScript check result is required but missing');
    }

    if (file.tsCheck.success) {
      console.log(`[fix-ts-error] No TypeScript errors detected, skipping fix`);
      return {
        file: {
          ...file,
          currentStep: WorkflowStep.TS_VALIDATION_PASSED,
        }
      };
    }

    // Get the TypeScript errors from the check result
    const tsErrors = file.tsCheck.errors?.join('\n') || 'Unknown TypeScript errors';
    console.log(`[fix-ts-error] TypeScript errors detected: ${tsErrors}`);

    // Initialize the fix history if not present
    const tsFixHistory = file.tsFixHistory || [];

    // If we have a current test and it's not the first attempt, add it to history
    if (file.rtlTest && file.retries.ts > 0) {
      // Record the attempt data
      const attempt: FixAttempt = {
        attempt: file.retries.ts,
        timestamp: new Date().toISOString(),
        testContentBefore: file.rtlTest || '',
        testContentAfter: file.rtlTest || '',
        error: file.tsCheck?.errors?.join('\n') || 'Unknown TypeScript errors',
        explanation: ''
      };

      // Add the current attempt to history
      tsFixHistory.push(attempt);

      console.log(`[fix-ts-error] Added attempt ${file.retries.ts} to TS fix history (${tsFixHistory.length} total attempts)`);
    }

    // Format previous fix attempts for the prompt
    let fixHistory = '';
    if (tsFixHistory.length > 0) {
      const formatAttempt = (attempt: FixAttempt) =>
        `Attempt ${attempt.attempt} at ${attempt.timestamp}:\n- Error: ${attempt.error}\n- Explanation: ${attempt.explanation || "No explanation provided"}`;

      fixHistory = tsFixHistory.map(formatAttempt).join('\n\n');
    }

    // Format the prompt using the template
    const formattedPrompt = await fixTsPromptTemplate.format({
      componentName: file.context.componentName,
      componentSourceCode: file.context.componentCode,
      componentFileImports: JSON.stringify(file.context.imports),
      testFile: file.rtlTest || '',
      tsErrors,
      fixHistory,
      userInstructions: file.context.extraContext || ''
    });

    console.log(`[fix-ts-error] Calling model to fix TypeScript errors`);

    // Call OpenAI with the prompt and TS-specific schema
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: tsFixResponseSchema,
      // Use o3-mini if reasoningExecution is enabled
      model: state.file.reasoningExecution ? 'o3-mini' : 'gpt-4o-mini',
      nodeName: 'fix_ts_error'
    });

    // Log the full explanation
    console.log(`[fix-ts-error] Explanation: ${response.explanation}`);

    // Increment the TS retry counter
    const updatedRetries = {
      ...file.retries,
      ts: file.retries.ts + 1
    };

    return {
      file: {
        ...file,
        rtlTest: response.testContent.trim(),
        fixExplanation: response.explanation,
        retries: updatedRetries,
        tsFixHistory,
        currentStep: WorkflowStep.TS_VALIDATION,
      }
    };
  } catch (err) {
    console.error(`[fix-ts-error] Error: ${err instanceof Error ? err.message : String(err)}`);

    return {
      file: {
        ...file,
        error: err instanceof Error ? err : new Error(String(err)),
        currentStep: WorkflowStep.TS_VALIDATION_ERROR,
      }
    };
  }
};
