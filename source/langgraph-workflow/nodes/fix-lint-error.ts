import { WorkflowState, WorkflowStep, FixAttempt } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured, lintFixResponseSchema } from '../utils/openai.js';
import { fixLintPrompt } from '../prompts/fix-lint-prompt.js';
import { PromptTemplate } from "@langchain/core/prompts";

// Create a PromptTemplate for the lint fix prompt
export const fixLintPromptTemplate = PromptTemplate.fromTemplate(fixLintPrompt);

/**
 * Fixes ESLint errors in the RTL test
 */
export const fixLintErrorNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[fix-lint-error] Fixing ESLint error for ${file.path}`);

  try {
    if (!file.lintCheck) {
      throw new Error('Lint check result is required but missing');
    }

    if (file.lintCheck.success) {
      console.log(`[fix-lint-error] No lint errors detected, skipping fix`);
      return {
        file: {
          ...file,
          currentStep: WorkflowStep.LINT_CHECK_PASSED,
        }
      };
    }

    // Get the lint errors from the check result
    const lintErrors = file.lintCheck.output || file.lintCheck.errors?.join('\n') || 'Unknown lint errors';
    console.log(`[fix-lint-error] Lint errors detected: ${lintErrors}`);

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

      console.log(`[fix-lint-error] Added attempt ${file.retries.lint} to Lint fix history (${lintFixHistory.length} total attempts)`);
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

    console.log(`[fix-lint-error] Calling model to fix lint errors`);

    // Call OpenAI with the prompt and lint-specific schema
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: lintFixResponseSchema,
      nodeName: 'fix_lint_error'
    });

    // Log the full explanation
    console.log(`[fix-lint-error] Explanation: ${response.explanation}`);

    // Mark that we've attempted to fix lint errors
    const updatedLintCheck = {
      ...file.lintCheck,
      lintFixAttempted: true
    };

    // Increment the lint retry counter
    const updatedRetries = {
      ...file.retries,
      lint: file.retries.lint + 1
    };

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
    console.error(`[fix-lint-error] Error: ${err instanceof Error ? err.message : String(err)}`);

    return {
      file: {
        ...file,
        error: err instanceof Error ? err : new Error(String(err)),
        currentStep: WorkflowStep.LINT_CHECK_ERROR,
      }
    };
  }
};
