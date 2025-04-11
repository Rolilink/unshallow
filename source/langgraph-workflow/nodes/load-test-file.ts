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

  logger.info(NODE_NAME, `Processing: ${file.path}`);

  try {
    // Read the test file
    const content = await fs.readFile(file.path, 'utf8');

    // If we have an attempt path, write the content there
    if (file.attemptPath) {
      await fs.writeFile(file.attemptPath, content, 'utf8');
      logger.info(NODE_NAME, `Wrote initial content to attempt file: ${file.attemptPath}`);
    }

    // Log without showing the full content
    logger.info(NODE_NAME, `File loaded successfully (${content.length} characters)`);

    return {
      file: {
        ...file,
        content,
        originalTest: content,
        currentStep: WorkflowStep.LOAD_TEST_FILE,
      },
    };
  } catch (error) {
    logger.error(NODE_NAME, `Error loading file: ${file.path}`, error);

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
