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

  console.log(`[parallel-extraction] Starting parallel extraction of accessibility snapshot and Jest errors`);

  try {
    // Check if there's a test result available
    if (!file.testResult) {
      console.log(`[parallel-extraction] No test result available, skipping`);
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

    console.log(`[parallel-extraction] Calling OpenAI to extract information in parallel`);

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

    console.log(`[parallel-extraction] Extracted accessibility data of length: ${a11yResponse.accessibilityDump.length}`);
    console.log(`[parallel-extraction] Extracted ${errorsResponse.testErrors.length} test errors`);

    // Process extracted errors
    let updatedTrackedErrors = file.trackedErrors || {};

    if (errorsResponse.testErrors.length > 0) {
      // Get existing tracked errors
      const existingTrackedErrors = file.trackedErrors || {};
      updatedTrackedErrors = { ...existingTrackedErrors };

      // Process extracted errors and update tracked errors
      errorsResponse.testErrors.forEach(error => {
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
            } else {
              newStatus = 'active';
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
          updatedTrackedErrors[fingerprint] = {
            fingerprint,
            testName: error.testName,
            message: error.message,
            normalized: error.normalized,
            currentAttempts: 0,
            status: 'new',
          };
        }
      });

      // Update statuses for errors that might be fixed now
      Object.keys(updatedTrackedErrors).forEach(fingerprint => {
        const trackedError = updatedTrackedErrors[fingerprint];

        if (trackedError &&
          !errorsResponse.testErrors.some(error => createFingerprint(error.testName, error.normalized) === fingerprint) &&
          trackedError.status !== 'fixed'
        ) {
          updatedTrackedErrors[fingerprint] = {
            ...trackedError,
            status: 'fixed',
          };
        }
      });
    } else if (file.testResult.success) {
      // If test was successful, mark all errors as fixed
      updatedTrackedErrors = Object.keys(updatedTrackedErrors).reduce((acc, fingerprint) => {
        const trackedError = updatedTrackedErrors[fingerprint];
        if (trackedError && trackedError.status !== 'fixed') {
          acc[fingerprint] = {
            ...trackedError,
            status: 'fixed',
          };
        } else if (trackedError) {
          // Only add if it's not undefined
          acc[fingerprint] = trackedError;
        }
        return acc;
      }, {} as Record<string, TrackedError>);
    }

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
    console.error(`[parallel-extraction] Error: ${error instanceof Error ? error.message : String(error)}`);

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
