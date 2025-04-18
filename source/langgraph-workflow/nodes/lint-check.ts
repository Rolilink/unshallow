import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logging-callback.js';
import { stripAnsiCodes } from '../utils/openai.js';

const execAsync = promisify(exec);

// Define a type for the exec error to handle stdout and stderr properties
interface ExecError extends Error {
  stdout?: string;
  stderr?: string;
}

/**
 * Runs ESLint checks on the RTL test
 */
export const lintCheckNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;
  const NODE_NAME = 'lint-check';

  // Use our tracked lint attempts if in the fix loop
  const attemptNumber = file.currentStep === WorkflowStep.LINT_CHECK_FAILED
    ? logger.getAttemptCount('lint-fix')
    : logger.incrementAttemptCount('lint');

  await logger.logNodeStart(NODE_NAME, `Checking linting (attempt #${attemptNumber}): ${file.path}`);

  // Add progress logging
  await logger.progress(file.path, `Linting check`, file.retries);

  // Check if we have already exceeded max retries
  if (file.retries.lint >= file.maxRetries) {
    await logger.error(NODE_NAME, `Max lint fix retries (${file.maxRetries}) exceeded`);
    await logger.progress(file.path, `Failed: Max lint fix retries (${file.maxRetries}) exceeded`, file.retries);

    return {
      file: {
        ...file,
        status: 'failed',
        currentStep: WorkflowStep.LINT_CHECK_FAILED,
      },
    };
  }

  // Skip if configured to skip lint
  if (file.skipLint) {
    await logger.info(NODE_NAME, `Skipped (skipLint enabled)`);
    return {
      file: {
        ...file,
        lintCheck: {
          success: true,
          errors: [],
        },
        currentStep: WorkflowStep.LINT_CHECK_SKIPPED,
      },
    };
  }

  try {
    // Get the path to check
    const fileToCheck = file.tempPath || file.path;

    // First try to auto-fix linting issues
    const lintFixCmd = file.commands.lintFix || 'yarn lint:fix';
    const autoFixCommand = `${lintFixCmd} ${fileToCheck}`;

    await logger.info(NODE_NAME, `Auto-fixing with: ${autoFixCommand}`);

    let fixStdout = '';
    let fixStderr = '';
    let fixExitCode = 0;

    try {
      const result = await execAsync(autoFixCommand);
      fixStdout = result.stdout || '';
      fixStderr = result.stderr || '';
    } catch (fixError) {
      const execError = fixError as ExecError;
      fixStdout = execError.stdout || '';
      fixStderr = execError.stderr || '';
      fixExitCode = 1;
      await logger.info(NODE_NAME, `Auto-fix failed, continuing with check`);
    }

    // Clean up ANSI codes
    fixStdout = stripAnsiCodes(fixStdout);
    fixStderr = stripAnsiCodes(fixStderr);

    // Log the auto-fix command results
    await logger.logCommand(
      NODE_NAME,
      autoFixCommand,
      fixStdout,
      fixStderr,
      fixExitCode,
      'lint-fix-command'
    );

    // Run the lint check command
    const lintCheckCmd = file.commands.lintCheck || 'yarn lint:check';
    const checkCommand = `${lintCheckCmd} ${fileToCheck}`;

    await logger.info(NODE_NAME, `Executing: ${checkCommand}`);

    let checkStdout = '';
    let checkStderr = '';
    let checkExitCode = 0;

    try {
      // Try to run the lint check
      const result = await execAsync(checkCommand);
      checkStdout = result.stdout || '';
      checkStderr = result.stderr || '';

      // Clean up ANSI codes
      checkStdout = stripAnsiCodes(checkStdout);
      checkStderr = stripAnsiCodes(checkStderr);

      // Log the check command results
      await logger.logCommand(
        NODE_NAME,
        checkCommand,
        checkStdout,
        checkStderr,
        checkExitCode,
        file.currentStep === WorkflowStep.LINT_CHECK_FAILED ? 'lint-fix' : 'lint'
      );

      await logger.success(NODE_NAME, `Lint check passed`);

      // Add progress logging for lint success
      await logger.progress(file.path, `Lint check passed`, file.retries);

      // Lint check passed
      return {
        file: {
          ...file,
          lintCheck: {
            success: true,
            errors: [],
          },
          currentStep: WorkflowStep.LINT_CHECK_PASSED,
        },
      };
    } catch (error) {
      // The lint command failed, which means there are lint errors
      const lintError = error as ExecError;

      // Extract error message from the error object
      const errorOutput = lintError.message || '';
      checkStdout = lintError.stdout || '';
      checkStderr = lintError.stderr || '';
      checkExitCode = 1;

      // Clean up ANSI codes
      checkStdout = stripAnsiCodes(checkStdout);
      checkStderr = stripAnsiCodes(checkStderr);

      // Log the check command results
      await logger.logCommand(
        NODE_NAME,
        checkCommand,
        checkStdout,
        checkStderr,
        checkExitCode,
        file.currentStep === WorkflowStep.LINT_CHECK_FAILED ? 'lint-fix' : 'lint'
      );

      // Combine all potential sources of error messages
      const combinedOutput = [errorOutput, checkStdout, checkStderr].filter(Boolean).join('\n');

      // Get the list of errors
      let errors: string[] = [];
      if (combinedOutput) {
        // Split by line and filter to likely error lines
        errors = combinedOutput
          .split('\n')
          .filter(line => line.trim().length > 0)  // non-empty lines
          .filter(line => !line.includes('Command failed'))  // exclude the command failed message
          .filter(line => !line.includes('info Visit')); // exclude yarn info messages
      }

      await logger.error(NODE_NAME, `Lint check failed with ${errors.length} errors`);

      // Log all lint errors
      await logger.logErrors(NODE_NAME, errors, "Lint errors");

      // Add progress logging for lint errors
      await logger.progress(file.path, `Lint check failed with ${errors.length} errors`, file.retries);

      return {
        file: {
          ...file,
          lintCheck: {
            success: false,
            errors: errors,
            output: combinedOutput
          },
          currentStep: WorkflowStep.LINT_CHECK_FAILED,
        },
      };
    }
  } catch (error) {
    await logger.error(NODE_NAME, `Error during lint check`, error);

    return {
      file: {
        ...file,
        lintCheck: {
          success: false,
          errors: [error instanceof Error ? error.message : String(error)],
        },
        status: 'failed',
        currentStep: WorkflowStep.LINT_CHECK_ERROR,
      },
    };
  }
};
