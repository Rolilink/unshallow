import { WorkflowState } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { extractJestErrorsPrompt } from '../prompts/extract-jest-errors-prompt.js';
import { callOpenAIStructured } from '../utils/openai.js';
import { ExtractJestErrorsOutputSchema, TrackedError } from '../interfaces/index.js';
import crypto from 'crypto';

// Create a hash for the error fingerprint
function createFingerprint(testName: string, normalized: string): string {
  const input = `${testName}:${normalized}`;
  return crypto.createHash('md5').update(input).digest('hex');
}

// Create the PromptTemplate for the extract-jest-errors prompt
export const extractJestErrorsTemplate = PromptTemplate.fromTemplate(extractJestErrorsPrompt);

/**
 * Extracts error information from test output
 */
export const extractJestErrorsNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[extract-jest-errors] Extracting errors from test output`);

  try {
    // Check if there's a test result available
    if (!file.testResult) {
      console.log(`[extract-jest-errors] No test result available, skipping`);
      return {
        file: {
          ...file,
          trackedErrors: {},
        },
      };
    }

    // If test was successful, return empty tracked errors
    if (file.testResult.success) {
      console.log(`[extract-jest-errors] Test was successful, no errors to extract`);
      return {
        file: {
          ...file,
          trackedErrors: {},
        },
      };
    }

    // Get the test output
    const jestOutput = file.testResult.output || '';

    // Format the prompt using the template
    const formattedPrompt = await extractJestErrorsTemplate.format({
      jestOutput,
    });

    console.log(`[extract-jest-errors] Calling OpenAI to extract test errors`);

    // Call OpenAI with the prompt
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: ExtractJestErrorsOutputSchema,
      nodeName: 'extract_jest_errors'
    });

    console.log(`[extract-jest-errors] Extracted ${response.testErrors.length} test errors`);

    // Get existing tracked errors or initialize
    const existingTrackedErrors = file.trackedErrors || {};

    // Process extracted errors and update tracked errors
    const updatedTrackedErrors: Record<string, TrackedError> = { ...existingTrackedErrors };

    response.testErrors.forEach(error => {
      // Create a fingerprint for the error
      const fingerprint = createFingerprint(error.testName, error.normalized);

      // Check if the error already exists
      if (fingerprint in updatedTrackedErrors) {
        const existingError = updatedTrackedErrors[fingerprint];

        // Ensure existingError is defined before accessing its properties
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

      // Ensure trackedError is defined before accessing its properties
      if (trackedError &&
        !response.testErrors.some(error => createFingerprint(error.testName, error.normalized) === fingerprint) &&
        trackedError.status !== 'fixed'
      ) {
        updatedTrackedErrors[fingerprint] = {
          ...trackedError,
          status: 'fixed',
        };
      }
    });

    // Return the updated state with extracted errors
    return {
      file: {
        ...file,
        trackedErrors: updatedTrackedErrors,
      },
    };
  } catch (error) {
    console.error(`[extract-jest-errors] Error: ${error instanceof Error ? error.message : String(error)}`);

    // If there's an error, continue with the workflow but with empty tracked errors
    return {
      file: {
        ...file,
        trackedErrors: file.trackedErrors || {},
      },
    };
  }
};
