/**
 * Interfaces for the LangGraph workflow
 */

/**
 * Configuration options for the workflow
 */
export interface WorkflowOptions {
  maxRetries?: number;
  skipTs?: boolean;
  skipLint?: boolean;
  skipTest?: boolean;
  lintCheckCmd?: string;
  lintFixCmd?: string;
  tsCheckCmd?: string;
  testCmd?: string;
  apiKey?: string;
}

/**
 * Component information from the context enricher
 */
export interface Component {
  name: string;
  filePath: string;
  content: string;
}

/**
 * Simplified context structure derived from the context enricher
 */
export interface EnrichedContext {
  componentName: string;
  componentCode: string;
  imports: Record<string, string>;
  examples?: Record<string, string>;
  extraContext?: string;
}

/**
 * Enum for tracking the current step in the workflow
 */
export enum WorkflowStep {
  INITIALIZE = 'INITIALIZE',
  LOAD_TEST_FILE = 'LOAD_TEST_FILE',
  LOAD_TEST_FILE_FAILED = 'LOAD_TEST_FILE_FAILED',
  APPLY_CONTEXT = 'APPLY_CONTEXT',
  CONVERT_TO_RTL = 'CONVERT_TO_RTL',
  CONVERT_TO_RTL_FAILED = 'CONVERT_TO_RTL_FAILED',
  RUN_TEST = 'RUN_TEST',
  RUN_TEST_SKIPPED = 'RUN_TEST_SKIPPED',
  RUN_TEST_ERROR = 'RUN_TEST_ERROR',
  RUN_TEST_FAILED = 'RUN_TEST_FAILED',
  TS_VALIDATION = 'TS_VALIDATION',
  TS_VALIDATION_PASSED = 'TS_VALIDATION_PASSED',
  TS_VALIDATION_FAILED = 'TS_VALIDATION_FAILED',
  TS_VALIDATION_SKIPPED = 'TS_VALIDATION_SKIPPED',
  TS_VALIDATION_ERROR = 'TS_VALIDATION_ERROR',
  LINT_CHECK = 'LINT_CHECK',
  LINT_CHECK_PASSED = 'LINT_CHECK_PASSED',
  LINT_CHECK_FAILED = 'LINT_CHECK_FAILED',
  LINT_CHECK_SKIPPED = 'LINT_CHECK_SKIPPED',
  LINT_CHECK_ERROR = 'LINT_CHECK_ERROR'
}

/**
 * Interface for test results
 */
export interface TestResult {
  success: boolean;
  output: string;
  errors?: string[];
  error?: any;
}

/**
 * Interface for TypeScript validation results
 */
export interface TsCheckResult {
  success: boolean;
  errors?: string[];
  output?: string;
}

/**
 * Interface for lint check results
 */
export interface LintCheckResult {
  success: boolean;
  errors?: string[];
  output?: string;
}

/**
 * Status of a file being processed
 */
export type FileStatus = 'pending' | 'in-progress' | 'success' | 'failed';

/**
 * State for a file being processed
 */
export interface FileState {
  path: string;
  content: string;
  tempPath?: string;
  outputPath?: string;
  status: FileStatus;
  currentStep: WorkflowStep;
  error?: Error;

  // Enriched context
  context: EnrichedContext;
  componentContext?: string; // Formatted context for LLM prompt

  // Migration outputs
  originalTest: string;
  rtlTest?: string;

  // Validation results
  testResult?: TestResult;
  tsCheck?: TsCheckResult;
  lintCheck?: LintCheckResult;

  // Retry counters
  retries: {
    rtl: number;
    test: number;
    ts: number;
    lint: number;
  };
  maxRetries: number;

  // Custom validation commands
  commands: {
    lintCheck: string;
    lintFix: string;
    tsCheck: string;
    test: string;
  };

  // Skip options
  skipTs: boolean;
  skipLint: boolean;
  skipTest: boolean;
}

/**
 * Main workflow state
 */
export interface WorkflowState {
  file: FileState;
}

/**
 * Node result type for workflow nodes
 */
export type NodeResult = Promise<{
  file: FileState;
}>;
