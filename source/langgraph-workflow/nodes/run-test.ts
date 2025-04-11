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

  logger.info(NODE_NAME, `Testing: ${file.path}`);

  // Skip if configured to skip tests
  if (file.skipTest) {
    logger.info(NODE_NAME, `Skipped (skipTest enabled)`);
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
    // Use the attempt file in the .unshallow directory if available
    const testFile = file.attemptPath || file.tempPath || path.join(
      path.dirname(file.path),
      `${path.basename(file.path, path.extname(file.path))}.temp${path.extname(file.path)}`
    );

    // Write the RTL test to the test file if attemptPath wasn't already set
    if (!file.attemptPath) {
      await fs.writeFile(testFile, file.rtlTest || '');
    } else {
      // Otherwise update the attempt file with the current RTL test
      await fs.writeFile(file.attemptPath, file.rtlTest || '');
    }

    // Update the file state with the test file path
    const updatedFile = {
      ...file,
      tempPath: testFile,
    };

    // Run the test command
    const testCmd = file.commands.test || 'yarn test';
    const fullCommand = `${testCmd} ${testFile}`;

    logger.info(NODE_NAME, `Executing: ${fullCommand}`);

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

      logger.info(NODE_NAME, `Command failed with exit code: ${exitCode}`);

      // Log a sample of the errors for better debugging
      if (stderr) {
        logger.error(NODE_NAME, 'Test execution failed, error output:');
        const errorLines = stderr.split('\n').filter(line => line.includes('error'));
        if (errorLines.length > 0) {
          const errorSample = errorLines.slice(0, 3).join('\n');
          logger.error(NODE_NAME, `Error sample:\n${errorSample}${errorLines.length > 3 ? '\n...' : ''}`);
        }
      }
    }

    // Clean up the ANSI codes for better log readability
    stdout = stripAnsiCodes(stdout);
    stderr = stripAnsiCodes(stderr);

    // Log the output for diagnosis
    const summaryLines = 10;
    if (stdout) {
      const stdoutSummary = stdout.split('\n').slice(0, summaryLines).join('\n');
      logger.info(NODE_NAME, `STDOUT summary (${stdout.length} chars):\n${stdoutSummary}${stdout.split('\n').length > summaryLines ? '\n...' : ''}`);
    }

    // Determine test result
    const testResult = {
      success: exitCode === 0,
      output: `${stdout}\n${stderr}`.trim(),
      exitCode,
    };

    // Return the updated state with the test result
    if (testResult.success) {
      logger.success(NODE_NAME, 'Test passed successfully');
      return {
        file: {
          ...updatedFile,
          testResult,
          currentStep: WorkflowStep.RUN_TEST_PASSED,
          status: 'success',
        },
      };
    } else {
      logger.error(NODE_NAME, 'Test failed');
      return {
        file: {
          ...updatedFile,
          testResult,
          currentStep: WorkflowStep.RUN_TEST_FAILED,
        },
      };
    }
  } catch (error) {
    logger.error(NODE_NAME, 'Error running test', error);

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
