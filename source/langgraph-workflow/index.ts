import {
	EnrichedContext,
	WorkflowOptions,
	WorkflowState,
	WorkflowStep,
} from './interfaces/index.js';
import {loadTestFileNode} from './nodes/load-test-file.js';
import {applyContextNode} from './nodes/apply-context.js';
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
import {
	Annotation,
	END,
	START,
	StateGraph,
} from '@langchain/langgraph';
import {getLangfuseCallbackHandler} from '../langfuse.js';
import {logger} from './utils/logging-callback.js';
import {TestFileSystem} from './utils/test-filesystem.js';
import {ArtifactFileSystem} from './utils/artifact-filesystem.js';

// Initialize filesystem helpers
const testFileSystem = new TestFileSystem();
const artifactFileSystem = new ArtifactFileSystem();

// Configure state
const WorkflowStateAnnotation = Annotation.Root({
	file: Annotation<WorkflowState['file']>(),
});

export const graph = new StateGraph(WorkflowStateAnnotation);

// Add all nodes to the graph
graph
	.addNode('load_test_file', loadTestFileNode)
	.addNode('apply_context', applyContextNode)
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
	.addEdge(START, 'load_test_file')
	.addConditionalEdges(
		'load_test_file',
		state => (state.file.status === 'failed' ? 'end' : 'apply_context'),
		{
			end: END,
			apply_context: 'apply_context',
		},
	)
	// Check if we should skip planning and execution in retry mode
	.addConditionalEdges(
		'apply_context',
		state => {
			// In retry mode with a valid temp file, skip to run_test
			if (state.file.retryMode && state.file.rtlTest && state.file.tempPath) {
				return 'run_test';
			}
			// Otherwise continue with normal planning
			return 'plan_rtl_conversion';
		},
		{
			run_test: 'run_test',
			plan_rtl_conversion: 'plan_rtl_conversion',
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
			logger.info('workflow', 'Unexpected state in analyze_test_errors condition');
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

	// Initial file state
	const initialState: WorkflowState = {
		file: {
			path: testFilePath,
			content: '',
			status: 'pending',
			currentStep: WorkflowStep.INITIALIZE,
			context: {
				componentName: context.componentName,
				componentCode: context.componentCode,
				componentImports: context.componentImports || {},
				imports: context.imports || {},
				examples: context.examples,
				extraContext: context.extraContext,
			}, // Context from ContextEnricher
			retries: {
				rtl: 0,
				test: 0,
				ts: 0,
				lint: 0,
			},
			maxRetries,
			commands: {
				lintCheck: options.lintCheckCmd || 'yarn lint:check',
				lintFix: options.lintFixCmd || 'yarn lint:fix',
				tsCheck: options.tsCheckCmd || 'yarn ts:check',
				test: options.testCmd || 'yarn test',
			},
			originalTest: '',
			skipTs: options?.skipTs || false,
			skipLint: options?.skipLint || false,
			skipTest: options?.skipTest || false,

			// Initialize fix loop state
			trackedErrors: {},
			totalAttempts: 0,
			accessibilityDump: '',

			// Pass reasoning flags to file state for access in nodes
			reasoningPlanning: options?.reasoningPlanning || false,
			reasoningExecution: options?.reasoningExecution || false,
			reasoningReflection: options?.reasoningReflection || false,

			// Set retry mode flag
			retryMode: options?.retry || false,
		},
	};

	/**
	 * Execute the workflow
	 */
	const execute = async (): Promise<WorkflowState> => {
		try {
			// Get the Langfuse callback handler
			const langfuseCallbackHandler = await getLangfuseCallbackHandler();

			// Log initial progress
			logger.progress(testFilePath, 'Starting migration');

			// Execute the graph with the initial state
			const result = await enzymeToRtlConverterGraph.invoke(initialState, {
				callbacks: langfuseCallbackHandler ? [langfuseCallbackHandler] : [],
				recursionLimit: 200,
			});

			// Log final progress
			logger.progress(testFilePath,
				`Migration ${result.file.status === 'success' ? 'succeeded' : 'failed'}`,
				result.file.retries
			);

			return result as WorkflowState;
		} catch (error) {
			logger.error('workflow', 'Error in workflow execution:', error);

			// Log error progress
			logger.progress(testFilePath, 'Migration failed with error');

			return {
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
	const {unshallowDir, testDir, tempPath, attemptPath} = testDirectoryPaths;

	// Initialize the logs file
	const logsPath = await artifactFileSystem.initializeLogsFile(testDir);

	// Configure the logger with the logs file path
	logger.setLogsPath(logsPath);

	// Set logger silent mode if specified
	if (options.silent) {
		logger.setSilent(true);
	}

	logger.info('workflow', `Starting migration for ${testFilePath}`);

	// Create the workflow with the unshallow directory paths
	const workflow = createWorkflow(testFilePath, context, options);

	// Update the initial state with the unshallow paths
	workflow.initialState.file = {
		...workflow.initialState.file,
		unshallowDir,
		testDir,
		logsPath,
		tempPath,
		attemptPath,
	};

	try {
		// Execute the workflow
		const result = await workflow.execute();

		// If the migration was successful, replace the original file and clean up
		if (result.file.status === 'success' && result.file.rtlTest) {
			logger.success('workflow', 'Migration completed successfully');

			// Replace the original file with the RTL test
			await import('fs/promises').then(fs =>
				fs.writeFile(testFilePath, result.file.rtlTest!),
			);

			// Clean up the temporary files and test directory
			await artifactFileSystem.cleanupTempFile(tempPath);
			await testFileSystem.cleanupTestDirectory(testDir);
		} else {
			logger.info(
				'workflow',
				`Migration completed with status: ${result.file.status}`,
			);

			// If the migration failed but we have a partial result, save it to the attempt file
			if (result.file.rtlTest) {
				await artifactFileSystem.saveAttemptFile(
					testDir,
					testFilePath,
					result.file.rtlTest,
				);
			}
		}

		return result;
	} catch (error) {
		logger.error('workflow', 'Migration failed with error', error);

		return {
			file: {
				...workflow.initialState.file,
				status: 'failed',
				error: error instanceof Error ? error : new Error(String(error)),
				currentStep: WorkflowStep.INITIALIZE,
			},
		};
	}
}
