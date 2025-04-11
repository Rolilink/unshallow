import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import * as fs from 'fs/promises';
import { logger } from '../utils/logging-callback.js';

/**
 * Loads the test file from disk
 */
export const loadTestFileNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;
  const NODE_NAME = 'load-test-file';

  await logger.logNodeStart(NODE_NAME, `Loading test file: ${file.path}`);

  try {
    // Read the test file
    const content = await fs.readFile(file.path, 'utf8');

    // Log the entire test file content
    await logger.logTestFile(NODE_NAME, file.path, content);

    await logger.success(NODE_NAME, `Test file loaded successfully`);

    return {
      file: {
        ...file,
        content,
        originalTest: content,
        currentStep: WorkflowStep.LOAD_TEST_FILE,
      },
    };
  } catch (error) {
    await logger.error(NODE_NAME, `Failed to load test file: ${error instanceof Error ? error.message : String(error)}`, error);

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
