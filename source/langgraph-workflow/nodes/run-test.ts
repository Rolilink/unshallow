import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { stripAnsiCodes } from '../utils/openai.js';
import { logger } from '../utils/logging-callback.js';
import { ArtifactFileSystem } from '../utils/artifact-filesystem.js';

// Extended exec type that includes code in the response
const execAsync = promisify(exec) as (command: string, options?: any) => Promise<{
  stdout: string;
  stderr: string;
  code?: number;
}>;

// Initialize the artifact file system
const artifactFileSystem = new ArtifactFileSystem();

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

  // Add progress logging
  await logger.progress(file.path, `Running test`, file.retries);

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
    // Get temp file path and write the current test content to it
    const tempPath = artifactFileSystem.createTempFilePath(file.path);
    await artifactFileSystem.writeToTempFile(file.path, file.rtlTest || '');

    // Run the test command
    const testCmd = file.commands.test || 'yarn test';
    const fullCommand = `${testCmd} ${tempPath}`;

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
      // Add progress logging for test success
      await logger.progress(file.path, `Test passed successfully`, file.retries);
      return {
        file: {
          ...file,
          testResult,
          currentStep: WorkflowStep.RUN_TEST_PASSED,
          status: 'success',
        },
      };
    } else {
      await logger.error(NODE_NAME, `Test failed (attempt #${attemptNumber})`);
      // Add progress logging for test failure
      await logger.progress(file.path, `Test failed - needs fixing`, file.retries);
      return {
        file: {
          ...file,
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
