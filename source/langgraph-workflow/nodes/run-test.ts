import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Runs the RTL test to verify it works
 */
export const runTestNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[run-test] Testing: ${file.path}`);

  // Skip if configured to skip tests
  if (file.skipTest) {
    console.log(`[run-test] Skipped (skipTest enabled)`);
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
    // Create temporary file for testing
    const tempDir = path.dirname(file.path);
    const tempFile = file.tempPath || path.join(tempDir, `${path.basename(file.path, path.extname(file.path))}.temp${path.extname(file.path)}`);

    // Write the RTL test to the temp file
    await fs.writeFile(tempFile, file.rtlTest || '');

    // Store the tempPath for future use
    const updatedFile = {
      ...file,
      tempPath: tempFile,
    };

    // Run the test command
    const testCmd = file.commands.test || 'yarn test';
    const fullCommand = `${testCmd} ${tempFile}`;

    console.log(`[run-test] Executing: ${testCmd}`);

    const { stdout, stderr } = await execAsync(fullCommand);

    // Check if the test failed
    if (stderr && (stderr.includes('fail') || stderr.includes('error'))) {
      console.log(`[run-test] Test failed`);

      return {
        file: {
          ...updatedFile,
          testResult: {
            success: false,
            output: stdout,
            errors: stderr.split('\n').filter(line => line.trim().length > 0),
          },
          currentStep: WorkflowStep.RUN_TEST_FAILED,
        },
      };
    }

    console.log(`[run-test] Test passed`);

    // Test succeeded
    return {
      file: {
        ...updatedFile,
        testResult: {
          success: true,
          output: stdout,
        },
        currentStep: WorkflowStep.RUN_TEST,
      },
    };
  } catch (error) {
    console.error(`[run-test] Error: ${error instanceof Error ? error.message : String(error)}`);

    return {
      file: {
        ...file,
        testResult: {
          success: false,
          output: '',
          error: error instanceof Error ? error : new Error(String(error)),
        },
        currentStep: WorkflowStep.RUN_TEST_ERROR,
      },
    };
  }
};
