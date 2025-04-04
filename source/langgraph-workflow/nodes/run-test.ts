import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { stripAnsiCodes } from '../utils/openai.js';

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

    console.log(`[run-test] Executing: ${fullCommand}`);

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

      console.log(`[run-test] Command failed with exit code: ${exitCode}`);

      // Log the STDERR content for better debugging
      if (stderr) {
        console.log(`[run-test] STDERR content:`);
        console.log(stderr);
      }

      // Log only a sample of the errors, not the full output
      const errorLines = stderr.split('\n').filter(line => line.includes('error'));
      if (errorLines.length > 0) {
        const errorSample = errorLines.slice(0, 3).join('\n');
        console.log(`[run-test] Error sample:\n${errorSample}${errorLines.length > 3 ? '\n...' : ''}`);
      }
    }

    // Check if the test failed based on exit code
    if (exitCode !== 0) {
      console.log(`[run-test] Test failed with exit code: ${exitCode}`);

      // Just collect the raw output without parsing
      const rawOutput = [
        `Exit code: ${exitCode}`,
        '--- STDOUT ---',
        stdout,
        '--- STDERR ---',
        stderr
      ].join('\n');

      // Clean the output by removing ANSI escape codes
      const cleanedOutput = stripAnsiCodes(rawOutput);

      return {
        file: {
          ...updatedFile,
          testResult: {
            success: false,
            output: cleanedOutput,
            errors: [cleanedOutput], // Pass the cleaned output as a single error item
            exitCode: exitCode
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
          output: stripAnsiCodes(stdout), // Clean ANSI codes from successful output too
          exitCode: 0
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
