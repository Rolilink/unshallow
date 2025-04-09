import { WorkflowState, WorkflowStep, TrackedError } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';

/**
 * Analyzes errors and selects the next one to fix
 */
export const analyzeTestErrorsNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[analyze-test-errors] Analyzing tracked errors to select next one to fix`);

  try {
    // Get the tracked errors or initialize
    const trackedErrors = file.trackedErrors || {};
    const totalAttempts = file.totalAttempts || 0;

    // Check if any errors exist
    if (Object.keys(trackedErrors).length === 0) {
      console.log(`[analyze-test-errors] No tracked errors found, all tests passed`);
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
    // Skip any error with 5 or more attempts

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
      if (error && error.currentAttempts < 5 && error.status) {
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

    // If we found an error to fix, update its attempt count
    if (selectedError) {
      trackedErrors[selectedError.fingerprint] = {
        ...selectedError,
        currentAttempts: selectedError.currentAttempts + 1,
      };

      console.log(`[analyze-test-errors] Selected error: ${selectedError.testName} (${selectedError.status}) - Attempt ${selectedError.currentAttempts + 1}`);
    } else {
      // Check if we exhausted all retry attempts
      const hasUnfixedErrors = Object.values(trackedErrors).some(error => error && error.status !== 'fixed');
      const hasExceededAttempts = Object.values(trackedErrors).every(error => error && error.currentAttempts >= 5);

      if (hasUnfixedErrors && hasExceededAttempts) {
        console.log(`[analyze-test-errors] All errors have exceeded retry limits`);
      } else {
        console.log(`[analyze-test-errors] No errors to fix, all are either fixed or skipped`);
      }
    }

    // Check if we've hit the total attempts limit
    const hasHitTotalAttempts = totalAttempts >= 10;
    if (hasHitTotalAttempts) {
      console.log(`[analyze-test-errors] Hit total attempts limit of 10`);
      selectedError = null;
    }

    // Update the workflow state with the selected error and updated tracked errors
    return {
      file: {
        ...file,
        currentError: selectedError,
        trackedErrors,
        totalAttempts: totalAttempts + 1,
        currentStep: selectedError ? WorkflowStep.RUN_TEST_FAILED : WorkflowStep.RUN_TEST_PASSED,
      },
    };
  } catch (error) {
    console.error(`[analyze-test-errors] Error: ${error instanceof Error ? error.message : String(error)}`);

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
