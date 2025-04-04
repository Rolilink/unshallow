import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

    const { stderr } = await execAsync(`${lintCheckCmd} ${fileToCheck}`);

    // Check if the lint check found issues
    if (stderr && stderr.includes('error')) {
      const errors = stderr.split('\n').filter(line => line.includes('error'));

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
          },
          currentStep: WorkflowStep.LINT_CHECK_FAILED,
        },
      };
    }

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
