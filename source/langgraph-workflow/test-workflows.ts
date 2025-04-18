import { EnrichedContext, WorkflowOptions, WorkflowState, WorkflowStep } from './interfaces/index.js';
import { lintCheckNode } from './nodes/lint-check.js';
import { fixLintErrorNode } from './nodes/fix-lint-error.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Test the lint check and fix cycle on a file
 * @param filePath Path to the file to test
 * @param options Workflow options
 * @returns The final state after the lint cycle
 */
export async function testLintCycle(
  filePath: string,
  context: EnrichedContext,
  options: WorkflowOptions = {}
): Promise<WorkflowState> {
  // Read the file content
  const content = await fs.readFile(filePath, 'utf8');

  // Create a temp file path
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const dirName = path.dirname(filePath);
  const tempPath = path.join(dirName, `${baseName}.temp${ext}`);

  // Initialize the state
  let state: WorkflowState = {
    file: {
      path: filePath,
      content: content,
      tempPath: tempPath,
      status: 'in-progress',
      currentStep: WorkflowStep.LINT_CHECK,
      context,
      retries: {
        rtl: 0,
        test: 0,
        ts: 0,
        lint: 0,
      },
      maxRetries: options.maxRetries || 8,
      commands: {
        lintCheck: options.lintCheckCmd || 'yarn lint:check',
        lintFix: options.lintFixCmd || 'yarn lint:fix',
        tsCheck: options.tsCheckCmd || 'yarn ts:check',
        test: options.testCmd || 'yarn test',
      },
      originalTest: content,
      rtlTest: content, // Use the current content as RTL test for lint checking
      skipTs: options.skipTs || false,
      skipLint: options.skipLint || false,
      skipTest: options.skipTest || false,
    },
  };

  // Write the content to the temp file
  await fs.writeFile(tempPath, content, 'utf8');

  // Run the lint cycle
  console.log('Starting lint check cycle...');
  let maxCycles = state.file.maxRetries;
  let cycles = 0;

  while (cycles < maxCycles) {
    // Run the lint check
    console.log(`\n=== Lint Cycle ${cycles + 1} ===`);

    // Run the lint check
    const lintResult = await lintCheckNode(state);
    state = lintResult as WorkflowState;

    // If the lint check passed, we're done
    if (state.file.currentStep === WorkflowStep.LINT_CHECK_PASSED) {
      console.log('Lint check passed!');
      break;
    }

    // If the lint check failed, try to fix it
    if (state.file.currentStep === WorkflowStep.LINT_CHECK_FAILED) {
      console.log('Lint check failed, attempting to fix...');

      // Run the lint fix
      const fixResult = await fixLintErrorNode(state);
      state = fixResult as WorkflowState;

      // Update the temp file with the fixed content
      if (state.file.rtlTest) {
        await fs.writeFile(tempPath, state.file.rtlTest, 'utf8');
      }
    }

    cycles++;
  }

  // Clean up the temp file
  try {
    await fs.unlink(tempPath);
  } catch (error) {
    console.warn(`Could not delete temp file: ${tempPath}`);
  }

  // Set the final status
  state.file.status = state.file.currentStep === WorkflowStep.LINT_CHECK_PASSED ? 'success' : 'failed';

  return state;
}
