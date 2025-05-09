import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { executeRtlFixPrompt } from '../prompts/execute-rtl-fix-prompt.js';
import { callOpenAIStructured } from '../utils/openai.js';
import { ExecuteRtlFixOutputSchema } from '../interfaces/index.js';
import { migrationGuidelines } from '../prompts/migration-guidelines.js';
import { logger } from '../utils/logging-callback.js';
import { ArtifactFileSystem } from '../utils/artifact-filesystem.js';

// Create the PromptTemplate for the execute-rtl-fix prompt
export const executeRtlFixTemplate = PromptTemplate.fromTemplate(executeRtlFixPrompt);

// Initialize the artifact file system
const artifactFileSystem = new ArtifactFileSystem();

/**
 * Executes the fix for the selected test failure
 */
export const executeRtlFixNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;
  const NODE_NAME = 'execute-rtl-fix';

  // Use the test-fix counter which is set by analyze-test-errors
  const attemptNumber = logger.getAttemptCount('test-fix');

  // Get error name if available
  const errorName = file.currentError ? file.currentError.testName : 'unknown';
  await logger.logNodeStart(NODE_NAME, `Executing fix (attempt #${attemptNumber} for error ${errorName})`);

  // Add progress logging
  await logger.progress(file.path, `RTL fixing: ${errorName}`, file.retries);

  try {
    // Check if there's a current error to fix
    if (!file.currentError) {
      await logger.info(NODE_NAME, `No current error to fix, skipping`);
      return {
        file,
      };
    }

    // Ensure we have fix intent
    if (!file.fixIntent) {
      await logger.info(NODE_NAME, `No fix intent available, using default`);
      file.fixIntent = 'Fix the failing test';
    }

    // Get the current error
    const currentError = file.currentError;

    // Log the fix intent
    await logger.info(NODE_NAME, `Fix intent: ${file.fixIntent}`);

    // Format component imports into a string with path comments
    const componentImportsWithPaths = file.context.imports
      .map(imp => {
        let comment = `// path relative to test: ${imp.pathRelativeToTest}`;
        if (imp.pathRelativeToComponent) {
          comment += ` | path relative to tested component: ${imp.pathRelativeToComponent}`;
        }
        return `${comment}\n${imp.code}`;
      })
      .join('\n\n');

    // Format the prompt using the template
    const formattedPrompt = await executeRtlFixTemplate.format({
      testFile: file.rtlTest || '',
      componentName: file.context.componentName,
      componentSourceCode: file.context.componentCode,
      componentFileImports: componentImportsWithPaths,
      userProvidedContext: file.context.extraContext || '',
      testName: currentError.testName,
      normalizedError: currentError.normalized,
      rawError: currentError.message,
      accessibilityDump: file.accessibilityDump || '',
      domTree: file.domTree || '',
      previousTestCode: file.rtlTest || '',
      previousExplanation: file.fixExplanation || '',
      migrationGuidelines: migrationGuidelines
    });

    await logger.info(NODE_NAME, `Calling OpenAI to execute fix`);

    // Call OpenAI with the prompt
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: ExecuteRtlFixOutputSchema,
      // Use o4-mini if reasoningExecution is enabled
      model: state.file.reasoningExecution ? 'o4-mini' : 'gpt-4.1',
      nodeName: 'execute_rtl_fix'
    });

    // Log the fix details
    await logger.logFix(
      NODE_NAME,
      file.fixIntent || 'Fix test error',
      response.fixExplanation,
      response.updatedTestFile,
      'test-fix'
    );

    // Write the updated test to the temp file
    await artifactFileSystem.writeToTempFile(file.path, response.updatedTestFile);

    await logger.success(NODE_NAME, `Fix executed, ready to run updated test`);

    // Add progress logging for completion
    await logger.progress(file.path, `RTL fix applied, ready to run test`, file.retries);

    // Return the updated state with the fixed test
    return {
      file: {
        ...file,
        rtlTest: response.updatedTestFile,
        fixExplanation: response.fixExplanation,
        currentStep: WorkflowStep.RUN_TEST, // Go back to running the test
      },
    };
  } catch (error) {
    await logger.error(NODE_NAME, `Error executing RTL fix`, error);

    // If there's an error, continue with the workflow
    return {
      file: {
        ...file,
        error: error instanceof Error ? error : new Error(String(error)),
      },
    };
  }
};
