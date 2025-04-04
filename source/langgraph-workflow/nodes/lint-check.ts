import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { exec } from 'child_process';
import { promisify } from 'util';

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

  console.log(`[lint-check] Checking: ${file.path}`);

  // Skip if configured to skip lint
  if (file.skipLint) {
    console.log(`[lint-check] Skipped (skipLint enabled)`);
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

    console.log(`[lint-check] Auto-fixing with: ${lintFixCmd}`);

    try {
      await execAsync(`${lintFixCmd} ${fileToCheck}`);
    } catch (fixError) {
      console.warn(`[lint-check] Auto-fix failed, continuing with check`);
    }

    // Run the lint check command
    const lintCheckCmd = file.commands.lintCheck || 'yarn lint:check';

    console.log(`[lint-check] Executing: ${lintCheckCmd}`);

    try {
      // Try to run the lint check
      await execAsync(`${lintCheckCmd} ${fileToCheck}`);

      console.log(`[lint-check] Passed`);

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
      const stdout = lintError.stdout || '';
      const stderr = lintError.stderr || '';

      // Combine all potential sources of error messages
      const combinedOutput = [errorOutput, stdout, stderr].filter(Boolean).join('\n');

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

      console.log(`[lint-check] Failed with ${errors.length} errors`);

      // Show only a few sample errors
      if (errors.length > 0) {
        const sampleErrors = errors.slice(0, 3).join('\n');
        console.log(`[lint-check] Error samples:\n${sampleErrors}${errors.length > 3 ? '\n...' : ''}`);
      }

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
    console.error(`[lint-check] Error: ${error instanceof Error ? error.message : String(error)}`);

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
