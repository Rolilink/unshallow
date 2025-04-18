import { WorkflowState, WorkflowStep, TrackedError } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { logger } from '../utils/logging-callback.js';

// Fixed max attempts per error before we give up
const MAX_ERROR_ATTEMPTS = 5;

/**
 * Analyzes errors and selects the next one to fix
 */
export const analyzeTestErrorsNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;
  const NODE_NAME = 'analyze-test-errors';

  // Get max retries (fallback to 8 if not set)
  const maxRetries = file.maxRetries || 8;

  await logger.logNodeStart(NODE_NAME, "Analyzing test errors");

  try {
    // Get the tracked errors or initialize
    const trackedErrors = file.trackedErrors || {};
    const totalAttempts = file.totalAttempts || 0;

    // Check if we've hit the maximum total attempts
    if (totalAttempts >= maxRetries) {
      await logger.info(NODE_NAME, `Hit maximum total attempts limit (${maxRetries}). Stopping fix loop.`);

      return {
        file: {
          ...file,
          currentError: null,
          trackedErrors,
          totalAttempts,
          currentStep: WorkflowStep.RUN_TEST_PASSED, // Mark as passed to exit the fix loop
          status: 'failed', // But still mark the overall status as failed
        },
      };
    }

    // Log all tracked errors
    await logger.logErrors(NODE_NAME, trackedErrors, "All tracked errors");

    // Check if any errors exist
    if (Object.keys(trackedErrors).length === 0) {
      await logger.info(NODE_NAME, `No tracked errors found, all tests passed`);
      return {
        file: {
          ...file,
          currentError: null,
          totalAttempts,
          currentStep: WorkflowStep.RUN_TEST_PASSED,
        },
      };
    }

    // Select the next error to fix based on priority:
    // 1. Regressed errors (previously fixed but broken again)
    // 2. New errors (never seen before)
    // 3. Active errors (existing errors we're still working on)
    // Skip any error with MAX_ERROR_ATTEMPTS or more attempts

    const errorPriorityOrder: ['regressed', 'new', 'active'] = ['regressed', 'new', 'active'];

    // Group errors by status
    const errorsByStatus: Record<string, TrackedError[]> = {
      regressed: [],
      new: [],
      active: [],
      fixed: [],
    };

    // Safely add errors to the appropriate status group
    Object.values(trackedErrors).forEach(error => {
      if (error && error.currentAttempts < MAX_ERROR_ATTEMPTS && error.status) {
        const status = error.status as keyof typeof errorsByStatus;
        if (errorsByStatus[status]) {
          errorsByStatus[status].push(error);
        }
      }
    });

    // Find the first error by priority
    let selectedError: TrackedError | null = null;

    for (const status of errorPriorityOrder) {
      const errorsForStatus = errorsByStatus[status];
      if (errorsForStatus && errorsForStatus.length > 0) {
        // Make sure we're checking for a defined error before assigning
        const firstError = errorsForStatus[0];
        if (firstError) {
          selectedError = firstError;
          break;
        }
      }
    }

    // Check if all errors have either been fixed or exceeded the attempt limit
    const unfixedErrors = Object.values(trackedErrors).filter(
      error => error && error.status !== 'fixed'
    );

    const fixableErrors = unfixedErrors.filter(
      error => error && error.currentAttempts < MAX_ERROR_ATTEMPTS
    );

    // If we found an error to fix, update its attempt count
    if (selectedError && fixableErrors.length > 0) {
      // We increment the attempt counter here, not in the test or fix nodes
      const nextAttemptNumber = selectedError.currentAttempts + 1;

      trackedErrors[selectedError.fingerprint] = {
        ...selectedError,
        currentAttempts: nextAttemptNumber,
      };

      // Reset the logger's internal counter to match our tracked count
      // This ensures the logger and our state stay in sync
      logger.setAttemptCount('test-fix', nextAttemptNumber);

      await logger.info(NODE_NAME, `Selected error for fixing: ${selectedError.testName} (${selectedError.status}) - Attempt ${nextAttemptNumber} of ${MAX_ERROR_ATTEMPTS}`);
      await logger.info(NODE_NAME, `Total fix attempts: ${totalAttempts + 1} of ${maxRetries}`);

      // Log the full details of the selected error
      await logger.logErrors(NODE_NAME, selectedError, "Selected error (full details)");
    } else {
      // No more errors to fix
      if (unfixedErrors.length > 0) {
        await logger.info(NODE_NAME, `All unfixed errors (${unfixedErrors.length}) have exceeded retry limits`);
      } else {
        await logger.info(NODE_NAME, `No errors to fix, all are either fixed or skipped`);
      }

      selectedError = null;
    }

    // Log completion status
    const completionStatus = selectedError ? "Selected error for fixing" : "No errors to fix";
    await logger.logNodeComplete(NODE_NAME, completionStatus, `Total attempts: ${totalAttempts + 1} of ${maxRetries}`);

    // Determine the next step and the final status
    const nextStep = selectedError ? WorkflowStep.RUN_TEST_FAILED : WorkflowStep.RUN_TEST_PASSED;

    // If we have no selected error but there are unfixed errors, mark as failed
    const finalStatus =
      (!selectedError && unfixedErrors.length > 0) ? 'failed' : file.status;

    // Update the workflow state with the selected error and updated tracked errors
    return {
      file: {
        ...file,
        currentError: selectedError,
        trackedErrors,
        totalAttempts: totalAttempts + 1,
        currentStep: nextStep,
        status: finalStatus,
      },
    };
  } catch (error) {
    await logger.error(NODE_NAME, `Error analyzing test errors`, error);

    // If there's an error, continue with the workflow
    return {
      file: {
        ...file,
        currentError: null,
        trackedErrors: file.trackedErrors || {},
        totalAttempts: file.totalAttempts || 0,
      },
    };
  }
};
