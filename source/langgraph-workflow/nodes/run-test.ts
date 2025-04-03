import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * Runs the test to verify it works
 */
export const runTestNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  // Skip test if requested
  if (file.skipTest) {
    return {
      file: {
        ...file,
        currentStep: WorkflowStep.RUN_TEST_SKIPPED,
        testResult: {
          success: true,
          output: 'Test run skipped as requested',
          errors: [],
        },
      },
    };
  }

  try {
    // Create a temporary file with the RTL test
    if (!file.rtlTest) {
      return {
        file: {
          ...file,
          status: 'failed',
          error: new Error('No RTL test was generated'),
          currentStep: WorkflowStep.RUN_TEST_FAILED,
        },
      };
    }

    // Create a temporary file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `test-${Date.now()}.tsx`);
    await fs.writeFile(tempFile, file.rtlTest, 'utf8');

    // Set the tempPath in the state so we can clean it up later
    const updatedFile = {
      ...file,
      tempPath: tempFile,
    };

    // Run the test command
    try {
      const testCmd = file.commands.test;
      const { stdout } = await execAsync(`${testCmd} ${tempFile}`);

      // If we reach here, test succeeded
      return {
        file: {
          ...updatedFile,
          testResult: {
            success: true,
            output: stdout,
            errors: [],
          },
          currentStep: WorkflowStep.RUN_TEST,
        },
      };
    } catch (error: any) {
      // Test failed
      return {
        file: {
          ...updatedFile,
          testResult: {
            success: false,
            output: error.stderr || error.message,
            errors: [error.stderr || error.message],
          },
          retries: {
            ...file.retries,
            test: file.retries.test + 1,
          },
          currentStep: WorkflowStep.RUN_TEST_ERROR,
        },
      };
    }
  } catch (error) {
    return {
      file: {
        ...file,
        error: error instanceof Error ? error : new Error(String(error)),
        status: 'failed',
        currentStep: WorkflowStep.RUN_TEST_FAILED,
      },
    };
  }
};
