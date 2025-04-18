import { WorkflowState, WorkflowStep, FixAttempt } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured, tsFixResponseSchema } from '../utils/openai.js';
import { fixTsPrompt } from '../prompts/fix-ts-prompt.js';
import { PromptTemplate } from "@langchain/core/prompts";
import { logger } from '../utils/logging-callback.js';

// Create a PromptTemplate for the TS fix prompt
export const fixTsPromptTemplate = PromptTemplate.fromTemplate(fixTsPrompt);

/**
 * Fixes TypeScript errors in the RTL test
 */
export const fixTsErrorNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;
  const NODE_NAME = 'fix-ts-error';

  await logger.logNodeStart(NODE_NAME, `Fixing TypeScript error for ${file.path}`);

  // Add progress logging
  await logger.progress(file.path, `TS fixing: attempting to fix TypeScript errors`, file.retries);

  try {
    if (!file.tsCheck) {
      throw new Error('TypeScript check result is required but missing');
    }

    if (file.tsCheck.success) {
      await logger.info(NODE_NAME, 'No TypeScript errors detected, skipping fix');
      return {
        file: {
          ...file,
          currentStep: WorkflowStep.TS_VALIDATION_PASSED,
        }
      };
    }

    // Get the TypeScript errors from the check result
    const tsErrors = file.tsCheck.errors?.join('\n') || 'Unknown TypeScript errors';
    await logger.info(NODE_NAME, `TypeScript errors detected: ${tsErrors}`);

    // Add progress logging with error count
    const errorCount = file.tsCheck.errors?.length || 0;
    await logger.progress(file.path, `TS fixing: ${errorCount} TypeScript errors`, file.retries);

    // Initialize the fix history if not present
    const tsFixHistory = file.tsFixHistory || [];

    // Increment the attempt count for TS before adding to history
    const nextTsAttempt = file.retries.ts + 1;
    logger.setAttemptCount('ts-fix', nextTsAttempt);

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

      await logger.info(NODE_NAME, `Added attempt ${file.retries.ts} to TS fix history (${tsFixHistory.length} total attempts)`);
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

    await logger.info(NODE_NAME, 'Calling model to fix TypeScript errors');

    // Call OpenAI with the prompt and TS-specific schema
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: tsFixResponseSchema,
      // Use o4-mini if reasoningExecution is enabled
      model: state.file.reasoningExecution ? 'o4-mini' : 'gpt-4.1',
      nodeName: 'fix_ts_error'
    });

    // Log the fix details
    await logger.logFix(
      NODE_NAME,
      'Fix TypeScript errors',
      response.explanation,
      response.testContent.trim(),
      'ts-fix'
    );

    // Increment the TS retry counter
    const updatedRetries = {
      ...file.retries,
      ts: file.retries.ts + 1
    };

    await logger.success(NODE_NAME, 'Applied TypeScript fixes');

    // Add progress logging for completion
    await logger.progress(file.path, `TS fix applied, ready for validation`, file.retries);

    // Check if we've exceeded max retries
    if (updatedRetries.ts >= file.maxRetries) {
      await logger.error(NODE_NAME, `Max TypeScript fix retries (${file.maxRetries}) exceeded`);
      await logger.progress(file.path, `Failed: Max TypeScript fix retries (${file.maxRetries}) exceeded`, updatedRetries);

      return {
        file: {
          ...file,
          rtlTest: response.testContent.trim(),
          fixExplanation: response.explanation,
          retries: updatedRetries,
          tsFixHistory,
          status: 'failed',
          currentStep: WorkflowStep.TS_VALIDATION_FAILED,
        }
      };
    }

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
    await logger.error(NODE_NAME, 'Error fixing TypeScript errors', err);

    return {
      file: {
        ...file,
        error: err instanceof Error ? err : new Error(String(err)),
        currentStep: WorkflowStep.TS_VALIDATION_ERROR,
      }
    };
  }
};
