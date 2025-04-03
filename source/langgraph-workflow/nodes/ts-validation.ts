import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Validates the TypeScript types in the generated test
 */
export const tsValidationNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  // Skip TypeScript validation if requested
  if (file.skipTs) {
    return {
      file: {
        ...file,
        currentStep: WorkflowStep.TS_VALIDATION_SKIPPED,
        tsCheck: {
          success: true,
          errors: [],
          output: 'TypeScript validation skipped as requested',
        },
      },
    };
  }

  try {
    // Run TypeScript check with the configured command
    try {
      const tsCheckCmd = file.commands.tsCheck;
      const { stderr } = await execAsync(`${tsCheckCmd} ${file.tempPath || file.path}`);

      // Check if there are any errors in output
      if (stderr && stderr.toLowerCase().includes('error')) {
        // Parse errors
        const errors = stderr.split('\n').filter(line => line.includes('error'));

        return {
          file: {
            ...file,
            tsCheck: {
              success: false,
              errors,
              output: stderr,
            },
            retries: {
              ...file.retries,
              ts: file.retries.ts + 1,
            },
            currentStep: WorkflowStep.TS_VALIDATION_FAILED,
          },
        };
      }

      // TS check passed
      return {
        file: {
          ...file,
          tsCheck: {
            success: true,
            errors: [],
            output: stderr || 'TypeScript validation passed',
          },
          currentStep: WorkflowStep.TS_VALIDATION_PASSED,
        },
      };
    } catch (error: any) {
      // TS check command failed
      return {
        file: {
          ...file,
          tsCheck: {
            success: false,
            errors: [error.stderr || error.message],
            output: error.stderr || error.message,
          },
          retries: {
            ...file.retries,
            ts: file.retries.ts + 1,
          },
          currentStep: WorkflowStep.TS_VALIDATION_FAILED,
        },
      };
    }
  } catch (error) {
    return {
      file: {
        ...file,
        error: error instanceof Error ? error : new Error(String(error)),
        status: 'failed',
        currentStep: WorkflowStep.TS_VALIDATION_ERROR,
      },
    };
  }
};
