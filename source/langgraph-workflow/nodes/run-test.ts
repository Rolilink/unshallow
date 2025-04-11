import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { stripAnsiCodes } from '../utils/openai.js';
import { logger } from '../utils/logging-callback.js';

// Extended exec type that includes code in the response
const execAsync = promisify(exec) as (command: string, options?: any) => Promise<{
  stdout: string;
  stderr: string;
  code?: number;
}>;

/**
 * Runs the RTL test to verify it works
 */
export const runTestNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;
  const NODE_NAME = 'run-test';

  // If we're in the fix loop, use the test-fix counter which is managed by analyze-test-errors
  // Otherwise, use the regular test counter
  const attemptNumber = file.currentError
    ? logger.getAttemptCount('test-fix')
    : logger.incrementAttemptCount('test');

  await logger.logNodeStart(NODE_NAME, `Running test (attempt #${attemptNumber}): ${file.path}`);

  // Skip if configured to skip tests
  if (file.skipTest) {
    await logger.info(NODE_NAME, `Skipped (skipTest enabled)`);
    return {
      file: {
        ...file,
        testResult: {
          success: true,
          output: 'Test execution skipped',
        },
        currentStep: WorkflowStep.RUN_TEST_SKIPPED,
      },
    };
  }

  try {
    // Use the temp file provided by the workflow state
    // If workflow fails later, results will be copied to the attemptPath
    const testFile = file.tempPath || path.join(
      path.dirname(file.path),
      `${path.basename(file.path, path.extname(file.path))}.temp${path.extname(file.path)}`
    );

    // Write the RTL test to the test file
    await fs.writeFile(testFile, file.rtlTest || '');

    // Update the file state with the test file path
    const updatedFile = {
      ...file,
      tempPath: testFile,
    };

    // Run the test command
    const testCmd = file.commands.test || 'yarn test';
    const fullCommand = `${testCmd} ${testFile}`;

    await logger.info(NODE_NAME, `Executing: ${fullCommand}`);

    let exitCode = 0;
    let stdout = '';
    let stderr = '';

    try {
      const result = await execAsync(fullCommand);
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (execError: any) {
      // When a command fails, exec throws an error with the exit code
      stdout = execError.stdout || '';
      stderr = execError.stderr || '';
      exitCode = execError.code || 1;

      await logger.info(NODE_NAME, `Command failed with exit code: ${exitCode}`);
    }

    // Clean up the ANSI codes for better log readability
    stdout = stripAnsiCodes(stdout);
    stderr = stripAnsiCodes(stderr);

    // Log the complete command results
    await logger.logCommand(
      NODE_NAME,
      fullCommand,
      stdout,
      stderr,
      exitCode,
      'test'
    );

    // Determine test result
    const testResult = {
      success: exitCode === 0,
      output: `${stdout}\n${stderr}`.trim(),
      exitCode,
    };

    // Return the updated state with the test result
    if (testResult.success) {
      await logger.success(NODE_NAME, `Test passed successfully (attempt #${attemptNumber})`);
      return {
        file: {
          ...updatedFile,
          testResult,
          currentStep: WorkflowStep.RUN_TEST_PASSED,
          status: 'success',
        },
      };
    } else {
      await logger.error(NODE_NAME, `Test failed (attempt #${attemptNumber})`);
      return {
        file: {
          ...updatedFile,
          testResult,
          currentStep: WorkflowStep.RUN_TEST_FAILED,
        },
      };
    }
  } catch (error) {
    await logger.error(NODE_NAME, 'Error running test', error);

    return {
      file: {
        ...file,
        testResult: {
          success: false,
          output: error instanceof Error ? error.message : String(error),
          error,
        },
        currentStep: WorkflowStep.RUN_TEST_ERROR,
      },
    };
  }
};
