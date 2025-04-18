import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logging-callback.js';
import { stripAnsiCodes } from '../utils/openai.js';

const execAsync = promisify(exec);

/**
 * Validates the TypeScript in the test file
 */
export const tsValidationNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;
  const NODE_NAME = 'ts-validation';

  // Use our tracked TS attempts if in the fix loop
  const attemptNumber = file.currentStep === WorkflowStep.TS_VALIDATION_FAILED
    ? logger.getAttemptCount('ts-fix')
    : logger.incrementAttemptCount('ts');

  await logger.logNodeStart(NODE_NAME, `Validating TypeScript (attempt #${attemptNumber}): ${file.path}`);

  // Add progress logging
  await logger.progress(file.path, `TypeScript validation`, file.retries);

  // Skip if configured to skip TS validation
  if (file.skipTs) {
    await logger.info(NODE_NAME, `Skipped (skipTs enabled)`);
    return {
      file: {
        ...file,
        tsCheck: {
          success: true,
          errors: [],
        },
        currentStep: WorkflowStep.TS_VALIDATION_SKIPPED,
      },
    };
  }

  try {
    // Create or use temporary file for validation
    const tempDir = path.dirname(file.path);
    const tempFile = file.tempPath || path.join(tempDir, `${path.basename(file.path, path.extname(file.path))}.temp${path.extname(file.path)}`);

    // Run TypeScript validation with custom command if provided
    const tsCheckCmd = file.commands.tsCheck || 'yarn ts:check';
    const fullCommand = `${tsCheckCmd} ${tempFile}`;

    await logger.info(NODE_NAME, `Executing: ${fullCommand}`);

    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      const result = await execAsync(fullCommand);
      stdout = result.stdout || '';
      stderr = result.stderr || '';
    } catch (execError: any) {
      // When a command fails, exec throws an error with the exit code
      stdout = execError.stdout || '';
      stderr = execError.stderr || '';
      exitCode = execError.code || 1;
    }

    // Clean up ANSI codes
    stdout = stripAnsiCodes(stdout);
    stderr = stripAnsiCodes(stderr);

    // Log the complete command output
    await logger.logCommand(
      NODE_NAME,
      fullCommand,
      stdout,
      stderr,
      exitCode,
      file.currentStep === WorkflowStep.TS_VALIDATION_FAILED ? 'ts-fix' : 'ts'
    );

    // Check for TS errors
    if (stderr && stderr.toLowerCase().includes('error')) {
      const errors = stderr.split('\n').filter(line => line.includes('error'));

      await logger.error(NODE_NAME, `TypeScript validation failed with ${errors.length} errors`);

      // Log all errors
      await logger.logErrors(NODE_NAME, errors, "TypeScript errors");

      // Add progress logging for TS errors
      await logger.progress(file.path, `TypeScript validation failed with ${errors.length} errors`, file.retries);

      return {
        file: {
          ...file,
          tsCheck: {
            success: false,
            errors: errors,
          },
          currentStep: WorkflowStep.TS_VALIDATION_FAILED,
        },
      };
    }

    await logger.success(NODE_NAME, `TypeScript validation passed`);

    // Add progress logging for TS success
    await logger.progress(file.path, `TypeScript validation passed`, file.retries);

    // TS validation succeeded
    return {
      file: {
        ...file,
        tsCheck: {
          success: true,
          errors: [],
        },
        currentStep: WorkflowStep.TS_VALIDATION_PASSED,
      },
    };
  } catch (error) {
    await logger.error(NODE_NAME, `Error during TypeScript validation`, error);

    return {
      file: {
        ...file,
        tsCheck: {
          success: false,
          errors: [error instanceof Error ? error.message : String(error)],
        },
        status: 'failed',
        currentStep: WorkflowStep.TS_VALIDATION_ERROR,
      },
    };
  }
};
