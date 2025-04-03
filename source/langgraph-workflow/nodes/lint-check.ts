import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Runs a lint check on the generated test
 */
export const lintCheckNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  // Skip lint check if requested
  if (file.skipLint) {
    return {
      file: {
        ...file,
        currentStep: WorkflowStep.LINT_CHECK_SKIPPED,
        lintCheck: {
          success: true,
          errors: [],
          output: 'Lint check skipped as requested',
        },
      },
    };
  }

  try {
    // Try to run lint fix first
    try {
      const lintFixCmd = file.commands.lintFix;
      await execAsync(`${lintFixCmd} ${file.tempPath || file.path}`);
    } catch (fixError) {
      // Continue even if fix fails
      console.warn('Lint fix failed, continuing with lint check');
    }

    // Run lint check
    try {
      const lintCheckCmd = file.commands.lintCheck;
      const { stderr } = await execAsync(`${lintCheckCmd} ${file.tempPath || file.path}`);

      // Check if there are any errors in output
      if (stderr && stderr.toLowerCase().includes('error')) {
        // Parse errors
        const errors = stderr.split('\n').filter(line => line.includes('error'));

        return {
          file: {
            ...file,
            lintCheck: {
              success: false,
              errors,
              output: stderr,
            },
            retries: {
              ...file.retries,
              lint: file.retries.lint + 1,
            },
            currentStep: WorkflowStep.LINT_CHECK_FAILED,
          },
        };
      }

      // Lint check passed
      return {
        file: {
          ...file,
          lintCheck: {
            success: true,
            errors: [],
            output: 'Lint check passed',
          },
          status: 'success', // If we reach here, the whole migration is successful
          currentStep: WorkflowStep.LINT_CHECK_PASSED,
        },
      };
    } catch (error: any) {
      // Lint check command failed
      return {
        file: {
          ...file,
          lintCheck: {
            success: false,
            errors: [error.stderr || error.message],
            output: error.stderr || error.message,
          },
          retries: {
            ...file.retries,
            lint: file.retries.lint + 1,
          },
          currentStep: WorkflowStep.LINT_CHECK_FAILED,
        },
      };
    }
  } catch (error) {
    return {
      file: {
        ...file,
        error: error instanceof Error ? error : new Error(String(error)),
        status: 'failed',
        currentStep: WorkflowStep.LINT_CHECK_ERROR,
      },
    };
  }
};
