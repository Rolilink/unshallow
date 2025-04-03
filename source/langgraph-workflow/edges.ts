import { WorkflowState } from './interfaces/index.js';

/**
 * Check if a test run has failed
 */
export function hasTestFailed(state: WorkflowState): boolean {
  return state.file.testResult?.success === false;
}

/**
 * Check if a test run has passed
 */
export function hasTestPassed(state: WorkflowState): boolean {
  return state.file.testResult?.success === true;
}

/**
 * Check if TypeScript validation has failed
 */
export function hasTsCheckFailed(state: WorkflowState): boolean {
  return state.file.tsCheck?.success === false;
}

/**
 * Check if TypeScript validation has passed
 */
export function hasTsCheckPassed(state: WorkflowState): boolean {
  return state.file.tsCheck?.success === true;
}

/**
 * Check if lint check has failed
 */
export function hasLintCheckFailed(state: WorkflowState): boolean {
  return state.file.lintCheck?.success === false;
}

/**
 * Check if lint check has passed
 */
export function hasLintCheckPassed(state: WorkflowState): boolean {
  return state.file.lintCheck?.success === true;
}

/**
 * Check if we've exceeded retry limits for any of the steps
 */
export function hasExceededRetries(state: WorkflowState): boolean {
  const { file } = state;
  const { retries, maxRetries } = file;

  // Check if any retry count exceeds the max
  return (
    retries.rtl > maxRetries ||
    retries.test > maxRetries ||
    retries.ts > maxRetries ||
    retries.lint > maxRetries
  );
}
