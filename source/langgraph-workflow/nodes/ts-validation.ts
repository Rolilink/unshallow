import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Validates the TypeScript in the test file
 */
export const tsValidationNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[ts-validation] Validating TypeScript: ${file.path}`);

  // Skip if configured to skip TS validation
  if (file.skipTs) {
    console.log(`[ts-validation] Skipped (skipTs enabled)`);
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

    console.log(`[ts-validation] Executing: ${tsCheckCmd}`);

    const { stderr } = await execAsync(`${tsCheckCmd} ${tempFile}`);

    // Check for TS errors
    if (stderr && stderr.toLowerCase().includes('error')) {
      const errors = stderr.split('\n').filter(line => line.includes('error'));

      console.log(`[ts-validation] Failed with ${errors.length} errors`);

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

    console.log(`[ts-validation] Passed`);

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
    console.error(`[ts-validation] Error: ${error instanceof Error ? error.message : String(error)}`);

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
