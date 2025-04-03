import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import * as fs from 'fs/promises';

/**
 * Loads the test file from disk
 */
export const loadTestFileNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;
  console.log(`[load-test-file] Processing: ${file.path}`);

  try {
    // Read the test file
    const content = await fs.readFile(file.path, 'utf8');

    return {
      file: {
        ...file,
        content,
        originalTest: content,
        currentStep: WorkflowStep.LOAD_TEST_FILE,
      },
    };
  } catch (error) {
    console.error(`[load-test-file] Error: ${error instanceof Error ? error.message : String(error)}`);
    return {
      file: {
        ...file,
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
        currentStep: WorkflowStep.LOAD_TEST_FILE_FAILED,
      },
    };
  }
};
