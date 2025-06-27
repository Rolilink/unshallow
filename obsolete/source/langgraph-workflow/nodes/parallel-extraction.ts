import { WorkflowState } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { extractAccessibilitySnapshotPrompt } from '../prompts/extract-accessibility-snapshot-prompt.js';
import { extractJestErrorsPrompt } from '../prompts/extract-jest-errors-prompt.js';
import { callOpenAIStructured } from '../utils/openai.js';
import {
  ExtractAccessibilitySnapshotOutputSchema,
  ExtractJestErrorsOutputSchema,
  TrackedError
} from '../interfaces/index.js';
import crypto from 'crypto';
import { logger } from '../utils/logging-callback.js';

// Create a hash for the error fingerprint
function createFingerprint(testName: string, normalized: string): string {
  const input = `${testName}:${normalized}`;
  return crypto.createHash('md5').update(input).digest('hex');
}

// Create the PromptTemplates
export const extractAccessibilitySnapshotTemplate = PromptTemplate.fromTemplate(extractAccessibilitySnapshotPrompt);
export const extractJestErrorsTemplate = PromptTemplate.fromTemplate(extractJestErrorsPrompt);

/**
 * Extracts both accessibility information and error information from test output in parallel
 */
export const parallelExtractionNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;
  const NODE_NAME = 'parallel-extraction';

  await logger.logNodeStart(NODE_NAME, `Extracting accessibility data and errors from test output`);

  try {
    // Check if there's a test result available
    if (!file.testResult) {
      await logger.info(NODE_NAME, `No test result available, skipping`);
      return {
        file: {
          ...file,
          accessibilityDump: file.accessibilityDump || '',
          domTree: file.domTree || '',
          trackedErrors: file.trackedErrors || {},
        },
      };
    }

    // Get the test output
    const jestOutput = file.testResult.output || '';

    // Format the prompts concurrently
    const [a11yPrompt, errorsPrompt] = await Promise.all([
      extractAccessibilitySnapshotTemplate.format({ jestOutput }),
      extractJestErrorsTemplate.format({ jestOutput })
    ]);

    await logger.info(NODE_NAME, `Calling OpenAI to extract information in parallel`);

    // Prepare API calls
    const a11yCall = callOpenAIStructured({
      prompt: a11yPrompt,
      schema: ExtractAccessibilitySnapshotOutputSchema,
      nodeName: 'extract_accessibility_snapshot'
    });

    // Make both API calls in parallel
    const errorsCall = callOpenAIStructured({
      prompt: errorsPrompt,
      schema: ExtractJestErrorsOutputSchema,
      nodeName: 'extract_jest_errors'
    });

    // Execute both API calls in parallel
    const [a11yResponse, errorsResponse] = await Promise.all([a11yCall, errorsCall]);

    // Log the extracted data
    if (a11yResponse.accessibilityDump || a11yResponse.domTree) {
      await logger.logAccessibilityData(
        NODE_NAME,
        a11yResponse.accessibilityDump || '',
        a11yResponse.domTree || ''
      );
      await logger.info(NODE_NAME, `Extracted accessibility data of length: ${a11yResponse.accessibilityDump.length}`);
    }

    // Log extracted test errors
    if (errorsResponse.testErrors.length > 0) {
      await logger.logErrors(NODE_NAME, errorsResponse.testErrors, "Extracted test errors");
      await logger.info(NODE_NAME, `Extracted ${errorsResponse.testErrors.length} test errors`);
    } else {
      await logger.info(NODE_NAME, `No test errors found`);
    }

    // Process extracted errors
    let updatedTrackedErrors = file.trackedErrors || {};

    if (errorsResponse.testErrors.length > 0) {
      // Get existing tracked errors
      const existingTrackedErrors = file.trackedErrors || {};
      updatedTrackedErrors = { ...existingTrackedErrors };

      // Process extracted errors and update tracked errors
      for (const error of errorsResponse.testErrors) {
        // Create a fingerprint for the error
        const fingerprint = createFingerprint(error.testName, error.normalized);

        // Check if the error already exists
        if (fingerprint in updatedTrackedErrors) {
          const existingError = updatedTrackedErrors[fingerprint];

          if (existingError) {
            // Update the status based on previous status
            let newStatus: 'new' | 'active' | 'fixed' | 'regressed';

            if (existingError.status === 'fixed') {
              newStatus = 'regressed';
              await logger.info(NODE_NAME, `Error '${error.testName}' has regressed`);
            } else {
              newStatus = 'active';
              await logger.info(NODE_NAME, `Error '${error.testName}' is still active`);
            }

            // Update the tracked error
            updatedTrackedErrors[fingerprint] = {
              ...existingError,
              message: error.message,
              normalized: error.normalized,
              status: newStatus,
            };
          }
        } else {
          // This is a new error
          await logger.info(NODE_NAME, `New error detected: '${error.testName}'`);
          updatedTrackedErrors[fingerprint] = {
            fingerprint,
            testName: error.testName,
            message: error.message,
            normalized: error.normalized,
            currentAttempts: 0,
            status: 'new',
          };
        }
      }

      // Update statuses for errors that might be fixed now
      for (const fingerprint of Object.keys(updatedTrackedErrors)) {
        const trackedError = updatedTrackedErrors[fingerprint];

        if (trackedError &&
          !errorsResponse.testErrors.some(error => createFingerprint(error.testName, error.normalized) === fingerprint) &&
          trackedError.status !== 'fixed'
        ) {
          await logger.info(NODE_NAME, `Error '${trackedError.testName}' has been fixed`);
          updatedTrackedErrors[fingerprint] = {
            ...trackedError,
            status: 'fixed',
          };
        }
      }
    } else if (file.testResult.success) {
      // If test was successful, mark all errors as fixed
      await logger.info(NODE_NAME, `Test passed, marking all errors as fixed`);

      const fixedErrors: Record<string, TrackedError> = {};

      for (const fingerprint of Object.keys(updatedTrackedErrors)) {
        const trackedError = updatedTrackedErrors[fingerprint];
        if (trackedError && trackedError.status !== 'fixed') {
          await logger.info(NODE_NAME, `Marking error '${trackedError.testName}' as fixed`);
          fixedErrors[fingerprint] = {
            ...trackedError,
            status: 'fixed',
          };
        } else if (trackedError) {
          // Only add if it's not undefined
          fixedErrors[fingerprint] = trackedError;
        }
      }

      updatedTrackedErrors = fixedErrors;
    }

    await logger.success(NODE_NAME, `Extraction complete`);

    // Return the updated state with all extracted information
    return {
      file: {
        ...file,
        // Use accessibility data if available, otherwise preserve existing
        accessibilityDump: a11yResponse.accessibilityDump || file.accessibilityDump || '',
        domTree: a11yResponse.domTree || file.domTree || '',
        // Update tracked errors
        trackedErrors: updatedTrackedErrors,
      },
    };
  } catch (error) {
    await logger.error(NODE_NAME, `Error during parallel extraction`, error);

    // If there's an error, preserve existing values
    return {
      file: {
        ...file,
        // Preserve existing values
        accessibilityDump: file.accessibilityDump || '',
        domTree: file.domTree || '',
        trackedErrors: file.trackedErrors || {},
      },
    };
  }
};
