import { WorkflowState, WorkflowStep, FixAttempt } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured, lintFixResponseSchema } from '../utils/openai.js';
import { fixLintPrompt } from '../prompts/fix-lint-prompt.js';
import { PromptTemplate } from "@langchain/core/prompts";
import { logger } from '../utils/logging-callback.js';
import { ArtifactFileSystem } from '../utils/artifact-filesystem.js';

// Create a PromptTemplate for the lint fix prompt
export const fixLintPromptTemplate = PromptTemplate.fromTemplate(fixLintPrompt);

// Initialize the artifact file system
const artifactFileSystem = new ArtifactFileSystem();

/**
 * Fixes ESLint errors in the RTL test
 */
export const fixLintErrorNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;
  const NODE_NAME = 'fix-lint-error';

  // Increment retry counter and set in logger
  const nextLintAttempt = file.retries.lint + 1;

  // Check for max retries before applying fix
  if (nextLintAttempt > file.maxRetries) {
    await logger.error(NODE_NAME, `Max lint fix retries (${file.maxRetries}) exceeded`);
    await logger.progress(file.path, `Failed: Max lint fix retries (${file.maxRetries}) exceeded`, {
      ...file.retries,
      lint: nextLintAttempt
    });

    return {
      file: {
        ...file,
        status: 'failed',
        currentStep: WorkflowStep.LINT_CHECK_FAILED,
      }
    };
  }

  // Set the attempt counter in the logger
  logger.setAttemptCount('lint-fix', nextLintAttempt);

  await logger.logNodeStart(NODE_NAME, `Fixing lint errors (attempt #${nextLintAttempt}): ${file.path}`);

  // Add progress logging
  await logger.progress(file.path, `Lint fixing: attempting to fix ESLint errors`, file.retries);

  try {
    if (!file.lintCheck) {
      throw new Error('Lint check result is required but missing');
    }

    if (file.lintCheck.success) {
      await logger.info(NODE_NAME, `No lint errors detected, skipping fix`);
      return {
        file: {
          ...file,
          currentStep: WorkflowStep.LINT_CHECK_PASSED,
        }
      };
    }

    // Get the lint errors from the check result
    const lintErrors = file.lintCheck.output || file.lintCheck.errors?.join('\n') || 'Unknown lint errors';
    await logger.info(NODE_NAME, `Lint errors detected`);

    // Add progress logging with error count
    const errorCount = file.lintCheck.errors?.length || 0;
    await logger.progress(file.path, `Lint fixing: ${errorCount} ESLint errors`, file.retries);

    // Log all errors being fixed
    await logger.logErrors(NODE_NAME, lintErrors, "Lint errors being fixed");

    // Initialize the fix history if not present
    const lintFixHistory = file.lintFixHistory || [];

    // If we have a current test and it's not the first attempt, add it to history
    if (file.rtlTest && file.retries.lint > 0) {
      // Add the current attempt to history
      const attempt: FixAttempt = {
        attempt: file.retries.lint,
        timestamp: new Date().toISOString(),
        testContentBefore: file.rtlTest || '',
        testContentAfter: file.rtlTest || '',
        error: lintErrors,
        explanation: file.fixExplanation
      };
      lintFixHistory.push(attempt);

      await logger.info(NODE_NAME, `Added attempt ${file.retries.lint} to Lint fix history (${lintFixHistory.length} total attempts)`);
    }

    // Format previous fix attempts for the prompt
    let fixHistory = '';
    if (lintFixHistory.length > 0) {
      const formatAttempt = (attempt: FixAttempt) =>
        `Attempt ${attempt.attempt} at ${attempt.timestamp}:\n- Error: ${attempt.error}\n- Explanation: ${attempt.explanation || "No explanation provided"}`;

      fixHistory = lintFixHistory.map(formatAttempt).join('\n\n');
    }

    // Format the prompt using the template
    const formattedPrompt = await fixLintPromptTemplate.format({
      componentName: file.context.componentName,
      testFile: file.rtlTest || '',
      lintErrors,
      fixHistory,
      userInstructions: file.context.extraContext || ''
    });

    await logger.info(NODE_NAME, `Calling model to fix lint errors`);

    // Call OpenAI with the prompt and lint-specific schema
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: lintFixResponseSchema,
      // Use o4-mini if reasoningExecution is enabled
      model: state.file.reasoningExecution ? 'o4-mini' : 'gpt-4.1',
      nodeName: 'fix_lint_error'
    });

    // Log the fix details
    await logger.logFix(
      NODE_NAME,
      'Fix lint errors',
      response.explanation,
      response.testContent.trim(),
      'lint-fix'
    );

    // Mark that we've attempted to fix lint errors
    const updatedLintCheck = {
      ...file.lintCheck,
      lintFixAttempted: true
    };

    // Increment the lint retry counter
    const updatedRetries = {
      ...file.retries,
      lint: nextLintAttempt
    };

    await logger.success(NODE_NAME, `Applied lint fixes (attempt #${nextLintAttempt})`);

    // Add progress logging for completion
    await logger.progress(file.path, `Lint fix applied, ready for validation`, updatedRetries);

    // Write the updated test to the temp file
    await artifactFileSystem.writeToTempFile(file.path, response.testContent.trim());

    return {
      file: {
        ...file,
        rtlTest: response.testContent.trim(),
        fixExplanation: response.explanation,
        lintCheck: updatedLintCheck,
        retries: updatedRetries,
        lintFixHistory,
        currentStep: WorkflowStep.LINT_CHECK,
      }
    };
  } catch (err) {
    await logger.error(NODE_NAME, `Error fixing lint errors`, err);

    return {
      file: {
        ...file,
        error: err instanceof Error ? err : new Error(String(err)),
        currentStep: WorkflowStep.LINT_CHECK_ERROR,
      }
    };
  }
};
