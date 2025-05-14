/**
 * Interfaces for the LangGraph workflow
 */

import {z} from 'zod';
import {EnrichedContext} from '../../types.js';

/**
 * Type definitions for TrackedError to track test errors across fix attempts
 */
export type TrackedError = {
	fingerprint: string;
	testName: string;
	message: string;
	normalized: string;
	currentAttempts: number;
	status: 'new' | 'active' | 'fixed' | 'regressed';
};

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
	useFixLoop?: boolean;

	// Options to control which model is used in different parts of the workflow
	reasoningPlanning?: boolean; // Use o4-mini for planning steps only
	reasoningExecution?: boolean; // Use o4-mini for execution steps only
	reasoningReflection?: boolean; // Use o4-mini for reflection steps only

	// Retry mode
	retry?: boolean; // Retry from existing partial migration

	// Silent mode
	silent?: boolean; // Suppress console output from logger
}

/**
 * Enum for tracking the current step in the workflow
 */
export enum WorkflowStep {
	INITIALIZE = 'INITIALIZE',
	LOAD_TEST_FILE = 'LOAD_TEST_FILE',
	LOAD_TEST_FILE_FAILED = 'LOAD_TEST_FILE_FAILED',
	APPLY_CONTEXT = 'APPLY_CONTEXT',
	PLAN_RTL_CONVERSION = 'PLAN_RTL_CONVERSION',
	EXECUTE_RTL_CONVERSION = 'EXECUTE_RTL_CONVERSION',
	CONVERT_TO_RTL = 'CONVERT_TO_RTL',
	CONVERT_TO_RTL_FAILED = 'CONVERT_TO_RTL_FAILED',
	PLAN_RTL_FIX = 'PLAN_RTL_FIX',
	EXECUTE_RTL_FIX = 'EXECUTE_RTL_FIX',
	RUN_TEST = 'RUN_TEST',
	RUN_TEST_SKIPPED = 'RUN_TEST_SKIPPED',
	RUN_TEST_ERROR = 'RUN_TEST_ERROR',
	RUN_TEST_FAILED = 'RUN_TEST_FAILED',
	RUN_TEST_PASSED = 'RUN_TEST_PASSED',
	TS_VALIDATION = 'TS_VALIDATION',
	TS_VALIDATION_PASSED = 'TS_VALIDATION_PASSED',
	TS_VALIDATION_FAILED = 'TS_VALIDATION_FAILED',
	TS_VALIDATION_SKIPPED = 'TS_VALIDATION_SKIPPED',
	TS_VALIDATION_ERROR = 'TS_VALIDATION_ERROR',
	LINT_CHECK = 'LINT_CHECK',
	LINT_CHECK_PASSED = 'LINT_CHECK_PASSED',
	LINT_CHECK_FAILED = 'LINT_CHECK_FAILED',
	LINT_CHECK_SKIPPED = 'LINT_CHECK_SKIPPED',
	LINT_CHECK_ERROR = 'LINT_CHECK_ERROR',
	REFLECTION = 'REFLECTION',
	SUMMARIZE_ATTEMPTS = 'SUMMARIZE_ATTEMPTS',
	EXTRACT_ACCESSIBILITY_SNAPSHOT = 'EXTRACT_ACCESSIBILITY_SNAPSHOT',
	EXTRACT_JEST_ERRORS = 'EXTRACT_JEST_ERRORS',
	ANALYZE_TEST_ERRORS = 'ANALYZE_TEST_ERRORS',
	ANALYZE_FAILURE = 'ANALYZE_FAILURE',
	EXECUTE_RTL_FIX_NEW = 'EXECUTE_RTL_FIX_NEW',
}

/**
 * Interface for test results
 */
export interface TestResult {
	success: boolean;
	output: string;
	errors?: string[];
	error?: any;
	exitCode?: number;
}

/**
 * Interface for TypeScript validation results
 */
export interface TsCheckResult {
	success: boolean;
	errors: string[];
	output?: string;
}

/**
 * Interface for lint check results
 */
export interface LintCheckResult {
	success: boolean;
	errors: string[];
	output?: string;
	lintFixAttempted?: boolean;
}

/**
 * Status of a file being processed
 */
export type FileStatus = 'pending' | 'in-progress' | 'success' | 'failed';

/**
 * Interface for a single fix attempt
 */
export interface FixAttempt {
	attempt: number;
	timestamp: string;
	testContentBefore: string;
	testContentAfter: string;
	error: string;
	explanation?: string;
	plan?: FixPlan;
	reflection?: string;
}

/**
 * Interface for a fix plan
 */
export interface FixPlan {
	explanation: string;
	plan: string;
	timestamp: string;
}

/**
 * State for a file being processed
 */
export interface FileState {
	path: string;
	content: string;
	originalTest: string;
	rtlTest?: string;
	status: FileStatus;
	currentStep: WorkflowStep;
	error?: Error;
	context: EnrichedContext;
	fixExplanation?: string;
	currentFocus?: string;
	fixPlan?: FixPlan;
	rtlFixHistory?: FixAttempt[];
	tsFixHistory?: FixAttempt[];
	lintFixHistory?: FixAttempt[];
	testResult?: TestResult;
	tsCheck?: TsCheckResult;
	lintCheck?: LintCheckResult;
	retries: {
		rtl: number;
		test: number;
		ts: number;
		lint: number;
	};
	maxRetries: number;
	commands: {
		lintCheck: string;
		lintFix: string;
		tsCheck: string;
		test: string;
	};
	skipTs: boolean;
	skipLint: boolean;
	skipTest: boolean;
	step?: 'migration' | 'fix' | 'ts' | 'lint' | 'complete';
	lastReflection?: string;
	attemptSummary?: string;

	// New properties for the fix loop
	accessibilityDump?: string;
	domTree?: string;
	trackedErrors?: Record<string, TrackedError>;
	currentError?: TrackedError | null;
	totalAttempts?: number;
	fixIntent?: string;

	// Properties for the reasoning model selection
	reasoningPlanning?: boolean;
	reasoningExecution?: boolean;
	reasoningReflection?: boolean;

	// Properties for the unshallow directory
	unshallowDir?: string;
	testDir?: string; // New property for the test-specific directory
	logsPath?: string;
	attemptPath?: string;

	// Retry mode flag
	retryMode?: boolean;

	// Meta report path
	metaReportPath?: string;
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

/**
 * Type definition for FixLoopState to track overall fix loop state
 */
export type FixLoopState = {
	filePath: string;
	trackedErrors: Record<string, TrackedError>;
	currentError: TrackedError | null;
	totalAttempts: number;
	accessibilityDump: string;
	domTree: string;
};

/**
 * Input type for the extract-accessibility-snapshot node
 */
export type ExtractAccessibilitySnapshotInput = {
	jestOutput: string;
};

/**
 * Output schema for the extract-accessibility-snapshot node
 */
export const ExtractAccessibilitySnapshotOutputSchema = z.object({
	accessibilityDump: z.string(),
	domTree: z.string(),
});

export type ExtractAccessibilitySnapshotOutput = z.infer<
	typeof ExtractAccessibilitySnapshotOutputSchema
>;

/**
 * Input type for the extract-jest-errors node
 */
export type ExtractJestErrorsInput = {
	jestOutput: string;
};

/**
 * Schema for extracted errors
 */
export const ExtractedErrorSchema = z.object({
	testName: z.string(),
	message: z.string(),
	normalized: z.string(),
});

export type ExtractedError = z.infer<typeof ExtractedErrorSchema>;

/**
 * Output schema for the extract-jest-errors node
 */
export const ExtractJestErrorsOutputSchema = z.object({
	testErrors: z.array(ExtractedErrorSchema),
});

export type ExtractJestErrorsOutput = z.infer<
	typeof ExtractJestErrorsOutputSchema
>;

/**
 * Input type for the analyze-failure node
 */
export type AnalyzeFailureInput = {
	testFile: string;
	componentName: string;
	componentSourceCode: string;
	componentFileImports: string;
	previousTestCode: string;
	accessibilityDump: string;
	userFeedback?: string;
	testError: {
		testName: string;
		normalized: string;
		rawMessage: string;
	};
};

/**
 * Output schema for the analyze-failure node
 */
export const AnalyzeFailureOutputSchema = z.object({
	fixIntent: z.string(),
	explanation: z.string(),
});

export type AnalyzeFailureOutput = z.infer<typeof AnalyzeFailureOutputSchema>;

/**
 * Input type for the execute-rtl-fix node
 */
export type ExecuteFixInput = {
	testFile: string;
	componentName: string;
	componentSourceCode: string;
	componentFileImports: string;
	testError: {
		testName: string;
		normalized: string;
		rawMessage: string;
	};
	fixIntent: string;
	accessibilityDump: string;
	userFeedback?: string;
	previousTestCode: string;
};

/**
 * Output schema for the execute-rtl-fix node
 */
export const ExecuteRtlFixOutputSchema = z.object({
	updatedTestFile: z.string(),
	fixExplanation: z.string(),
});

export type ExecuteRtlFixOutput = z.infer<typeof ExecuteRtlFixOutputSchema>;
