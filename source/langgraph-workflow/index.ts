import {
	WorkflowOptions,
	WorkflowState,
	WorkflowStep,
} from './interfaces/index.js';
import {EnrichedContext} from '../types.js';
import {planRtlConversionNode} from './nodes/plan-rtl-conversion.js';
import {executeRtlConversionNode} from './nodes/execute-rtl-conversion.js';
import {runTestNode} from './nodes/run-test.js';
import {tsValidationNode} from './nodes/ts-validation.js';
import {fixTsErrorNode} from './nodes/fix-ts-error.js';
import {lintCheckNode} from './nodes/lint-check.js';
import {fixLintErrorNode} from './nodes/fix-lint-error.js';
import {analyzeTestErrorsNode} from './nodes/analyze-test-errors.js';
import {analyzeFailureNode} from './nodes/analyze-failure.js';
import {executeRtlFixNode} from './nodes/execute-rtl-fix.js';
import {parallelExtractionNode} from './nodes/parallel-extraction.js';
import {
	hasTsCheckFailed,
	hasTsCheckPassed,
	hasLintCheckFailed,
	hasLintCheckPassed,
	hasExceededRetries,
} from './edges.js';
import {Annotation, END, START, StateGraph} from '@langchain/langgraph';
import {getLangfuseCallbackHandler} from '../langfuse.js';
import {logger} from './utils/logging-callback.js';
import {TestFileSystem} from './utils/test-filesystem.js';
import {ArtifactFileSystem} from './utils/artifact-filesystem.js';
import {v4 as uuidv4} from 'uuid';
import * as fsSync from 'fs';

// Initialize filesystem helpers
const testFileSystem = new TestFileSystem();
const artifactFileSystem = new ArtifactFileSystem();

// Configure state
const WorkflowStateAnnotation = Annotation.Root({
	file: Annotation<WorkflowState['file']>(),
});

export const graph = new StateGraph(WorkflowStateAnnotation);

// Add all nodes to the graph (without load_test_file and apply_context)
graph
	.addNode('plan_rtl_conversion', planRtlConversionNode)
	.addNode('execute_rtl_conversion', executeRtlConversionNode)
	.addNode('run_test', runTestNode)
	.addNode('ts_validation', tsValidationNode)
	.addNode('fix_ts_error', fixTsErrorNode)
	.addNode('lint_check', lintCheckNode)
	.addNode('fix_lint_error', fixLintErrorNode)
	.addNode('parallel_extraction', parallelExtractionNode)
	.addNode('analyze_test_errors', analyzeTestErrorsNode)
	.addNode('analyze_failure', analyzeFailureNode)
	.addNode('execute_rtl_fix', executeRtlFixNode)
	// Start directly with plan_rtl_conversion by default
	.addEdge(START, 'plan_rtl_conversion')
	// Add conditional start edge based on current step
	.addConditionalEdges(
		START,
		state => {
			// Determine the starting node based on the current step in state
			switch (state.file.currentStep) {
				case WorkflowStep.RUN_TEST:
					return 'run_test';
				case WorkflowStep.ANALYZE_TEST_ERRORS:
					return 'analyze_test_errors';
				case WorkflowStep.ANALYZE_FAILURE:
					return 'analyze_failure';
				case WorkflowStep.TS_VALIDATION:
					return 'ts_validation';
				case WorkflowStep.LINT_CHECK:
					return 'lint_check';
				default:
					// Check if we have a valid rtlTest in retry mode
					if (state.file.retryMode && state.file.rtlTest) {
						return 'run_test';
					}
					return 'plan_rtl_conversion';
			}
		},
		{
			plan_rtl_conversion: 'plan_rtl_conversion',
			run_test: 'run_test',
			analyze_test_errors: 'analyze_test_errors',
			analyze_failure: 'analyze_failure',
			ts_validation: 'ts_validation',
			lint_check: 'lint_check',
		},
	)
	.addConditionalEdges(
		'plan_rtl_conversion',
		state =>
			state.file.status === 'failed' ? 'end' : 'execute_rtl_conversion',
		{
			end: END,
			execute_rtl_conversion: 'execute_rtl_conversion',
		},
	)
	.addConditionalEdges(
		'execute_rtl_conversion',
		state => (state.file.status === 'failed' ? 'end' : 'run_test'),
		{
			end: END,
			run_test: 'run_test',
		},
	)
	.addConditionalEdges(
		'run_test',
		state => {
			if (state.file.currentStep === WorkflowStep.RUN_TEST_PASSED) {
				return 'validate_typescript';
			} else if (state.file.currentStep === WorkflowStep.RUN_TEST_FAILED) {
				return 'parallel_extraction';
			} else {
				return 'run_test';
			}
		},
		{
			validate_typescript: 'ts_validation',
			parallel_extraction: 'parallel_extraction',
			run_test: 'run_test',
		},
	)
	.addEdge('parallel_extraction', 'analyze_test_errors')
	.addConditionalEdges(
		'analyze_test_errors',
		state => {
			// The analyze-test-errors node will now handle the retry limit logic
			// This conditional edge uses the step decision from the node

			// If the step is run-test-passed, it means either:
			// 1. All errors are fixed, or
			// 2. We've hit the retry limits and the node marked it as "passed"
			//    to exit the fix loop (but status will be 'failed')
			if (state.file.currentStep === WorkflowStep.RUN_TEST_PASSED) {
				// Check if the status is 'failed' - which means we hit retry limits
				// In this case, we want to exit without running ts or lint
				if (state.file.status === 'failed') {
					return 'end';
				}
				return 'validate_typescript';
			}

			// If we have an error to fix, continue with analyze-failure
			if (state.file.currentError) {
				return 'analyze_failure';
			}

			// Fallback - should not happen
			logger.info(
				'workflow',
				'Unexpected state in analyze_test_errors condition',
			);
			return 'validate_typescript';
		},
		{
			analyze_failure: 'analyze_failure',
			validate_typescript: 'ts_validation',
			end: END,
		},
	)
	.addEdge('analyze_failure', 'execute_rtl_fix')
	.addEdge('execute_rtl_fix', 'run_test')
	.addConditionalEdges(
		'ts_validation',
		state => {
			if (state.file.skipTs) return 'skip_ts';
			if (hasTsCheckPassed(state as WorkflowState)) return 'ts_passed';
			if (
				hasTsCheckFailed(state as WorkflowState) &&
				!hasExceededRetries(state as WorkflowState)
			)
				return 'fix_ts_error';
			return 'end';
		},
		{
			skip_ts: 'lint_check',
			ts_passed: 'lint_check',
			fix_ts_error: 'fix_ts_error',
			end: END,
		},
	)
	.addEdge('fix_ts_error', 'ts_validation')
	.addConditionalEdges(
		'lint_check',
		state => {
			if (state.file.skipLint) return 'skip_lint';
			if (hasLintCheckPassed(state as WorkflowState)) return 'lint_passed';
			if (
				hasLintCheckFailed(state as WorkflowState) &&
				!hasExceededRetries(state as WorkflowState)
			)
				return 'fix_lint_error';
			return 'end';
		},
		{
			skip_lint: END,
			lint_passed: END,
			fix_lint_error: 'fix_lint_error',
			end: END,
		},
	)
	.addEdge('fix_lint_error', 'lint_check');

// Compile the graph
const enzymeToRtlConverterGraph = graph.compile();

/**
 * Creates a workflow graph for migrating a test file using LangGraph.
 */
export function createWorkflow(
	testFilePath: string,
	context: EnrichedContext,
	options: WorkflowOptions = {},
): {initialState: WorkflowState; execute: () => Promise<WorkflowState>} {
	const maxRetries = options.maxRetries || 8;
	const retryMode = options.retry || false;

	/**
	 * Helper function to load test file content synchronously
	 */
	const loadTestFile = (filePath: string): {content: string; error?: Error} => {
		try {
			// Use synchronous file reading since we're initializing the workflow
			const content = fsSync.readFileSync(filePath, 'utf8');
			logger.info(
				'workflow',
				`Loaded test file: ${filePath} (${content.length} characters)`,
			);
			return {content};
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			logger.error('workflow', `Failed to load test file: ${filePath}`, error);
			return {content: '', error};
		}
	};

	// Initialize a TestFileSystem instance for retry mode handling
	const testFs = new TestFileSystem();

	// Load the test file content (either original or attempt file in retry mode)
	let fileContent = '';
	let fileError: Error | undefined;
	let originalTest = '';
	let rtlTest: string | undefined;

	if (retryMode && testFs.attemptFileExists(testFilePath)) {
		// In retry mode, try to load the attempt file from .unshallow directory
		try {
			const attemptContent = fsSync.readFileSync(
				testFs.getAttemptFilePath(
					testFilePath,
					testFs.getTestDirectoryPath(testFilePath),
				),
				'utf8',
			);

			// Load original file to keep the original test content
			const originalContent = fsSync.readFileSync(testFilePath, 'utf8');

			fileContent = originalContent; // Current file content (original)
			originalTest = originalContent; // Original enzyme test
			rtlTest = attemptContent; // Previously attempted RTL test

			logger.info(
				'workflow',
				`Loaded attempt file for retry mode (${attemptContent.length} characters)`,
			);
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			logger.error(
				'workflow',
				`Failed to load attempt file in retry mode`,
				error,
			);

			// Fall back to loading the original file
			const {content, error: loadError} = loadTestFile(testFilePath);
			fileContent = content;
			fileError = loadError;
			originalTest = content;
		}
	} else {
		// Normal mode: just load the original file
		const {content, error: loadError} = loadTestFile(testFilePath);
		fileContent = content;
		fileError = loadError;
		originalTest = content;
	}

	// Determine initial step based on options and retry mode
	let initialStep = WorkflowStep.INITIALIZE;

	if (fileError) {
		initialStep = WorkflowStep.INITIALIZE; // Keep at initialize if there's an error
	} else if (retryMode && rtlTest) {
		// In retry mode with valid RTL test, start with running the test
		initialStep = WorkflowStep.RUN_TEST;
	}

	// Generate a unique ID for this workflow run (not from state)
	const workflowRunId = `workflow-${uuidv4()}`;

	// Initial file state with file already loaded
	const initialState: WorkflowState = {
		id: workflowRunId,
		file: {
			path: testFilePath,
			content: fileContent,
			originalTest: originalTest,
			rtlTest: rtlTest,
			status: fileError ? 'failed' : 'pending',
			currentStep: initialStep,
			context, // Context from EnrichedContext
			retries: {
				rtl: 0,
				test: 0,
				ts: 0,
				lint: 0,
			},
			maxRetries,
			commands: {
				lintCheck: options.lintCheckCmd || 'npm run lint',
				lintFix: options.lintFixCmd || 'npm run lint:fix',
				tsCheck: options.tsCheckCmd || 'npm run ts-check',
				test: options.testCmd || 'npm test',
			},
			skipTs: options.skipTs || false,
			skipLint: options.skipLint || false,
			skipTest: options.skipTest || false,
			reasoningPlanning: options.reasoningPlanning || false,
			reasoningExecution: options.reasoningExecution || false,
			reasoningReflection: options.reasoningReflection || false,
			retryMode: retryMode,
		},
	};

	/**
	 * Execute the workflow
	 */
	const execute = async (): Promise<WorkflowState> => {
		try {
			// Get the Langfuse callback handler (no parameter)
			const langfuseCallbackHandler = await getLangfuseCallbackHandler();

			// Log initial progress
			logger.progress(testFilePath, 'Starting migration');

			// If we failed to load the file, return immediately
			if (fileError) {
				logger.error('workflow', 'Failed to load test file, aborting workflow');
				return initialState;
			}

			// Execute the graph with the initial state
			const result = await enzymeToRtlConverterGraph.invoke(initialState, {
				callbacks: langfuseCallbackHandler ? [langfuseCallbackHandler] : [],
				recursionLimit: 200,
				runId: initialState.id, // Pass unique run ID to LangGraph
			});

			// Log final progress
			logger.progress(
				testFilePath,
				`Migration ${
					result.file.status === 'success' ? 'succeeded' : 'failed'
				}`,
				result.file.retries,
			);

			return result as WorkflowState;
		} catch (error) {
			logger.error('workflow', 'Error in workflow execution:', error);

			// Log error progress
			logger.progress(testFilePath, 'Migration failed with error');

			return {
				id: initialState.id,
				file: {
					...initialState.file,
					status: 'failed',
					error: error instanceof Error ? error : new Error(String(error)),
					currentStep: WorkflowStep.INITIALIZE,
				},
			};
		}
	};

	return {
		initialState,
		execute,
	};
}

/**
 * Process a single test file through the migration workflow
 */
export async function processSingleFile(
	testFilePath: string,
	context: EnrichedContext,
	options: WorkflowOptions = {},
): Promise<WorkflowState> {
	// Set up the .unshallow directory for logging and temporary files
	const testDirectoryPaths = await testFileSystem.setupTestDirectory(
		testFilePath,
	);
	const {unshallowDir, testDir} = testDirectoryPaths;

	// Initialize the logs file
	const logsFilePath = await artifactFileSystem.initializeLogsFile(testDir);

	// Configure the logger with the logs file path
	logger.setLogsPath(logsFilePath);

	// Set logger silent mode if specified
	if (options.silent) {
		logger.setSilent(true);
	}

	logger.info('workflow', `Starting migration for test: ${testFilePath}`);
	logger.info('workflow', `Logs will be written to: ${logsFilePath}`);
	logger.info('workflow', `.unshallow directory: ${unshallowDir}`);
	logger.info('workflow', `Component directory: ${testDir}`);

	// Initialize the workflow with the test file
	const workflow = createWorkflow(testFilePath, context, {
		...options,
	});

	// Start timer to track execution time
	const startTime = Date.now();

	// Execute the workflow
	logger.info('workflow', 'Starting workflow execution');
	const finalState = await workflow.execute();
	logger.info('workflow', 'Workflow execution complete');

	// Calculate execution time
	const executionTimeMs = Date.now() - startTime;
	const executionTimeSec = Math.round(executionTimeMs / 1000);
	logger.info('workflow', `Total execution time: ${executionTimeSec} seconds`);

	// Handle the final state based on the status
	if (finalState.file.status === 'success') {
		logger.success('workflow', `Migration successful for: ${testFilePath}`);

		// Save the result to the original file
		if (finalState.file.rtlTest) {
			// Update original file with the RTL test and finalize (success)
			await artifactFileSystem.finalizeMigration(
				testFilePath,
				finalState.file.rtlTest,
				testDir,
				'success',
			);

			// Clean up the test directory if successful
			await testFileSystem.cleanupTestDirectory(testDir);
		}
	} else if (finalState.file.status === 'failed') {
		logger.error(
			'workflow',
			`Migration failed for: ${testFilePath}`,
			finalState.file.error,
		);

		// Save the attempt for failed migrations
		if (finalState.file.rtlTest) {
			// Update original file with the RTL test but mark as failed
			// This also saves a copy to the .unshallow directory
			await artifactFileSystem.finalizeMigration(
				testFilePath,
				finalState.file.rtlTest,
				testDir,
				'failed',
			);
		}
	}

	return finalState;
}
