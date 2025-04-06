import { EnrichedContext, WorkflowOptions, WorkflowState, WorkflowStep } from './interfaces/index.js';
import { loadTestFileNode } from './nodes/load-test-file.js';
import { applyContextNode } from './nodes/apply-context.js';
import { planRtlConversionNode } from './nodes/plan-rtl-conversion.js';
import { executeRtlConversionNode } from './nodes/execute-rtl-conversion.js';
import { runTestNode } from './nodes/run-test.js';
import { tsValidationNode } from './nodes/ts-validation.js';
import { fixTsErrorNode } from './nodes/fix-ts-error.js';
import { lintCheckNode } from './nodes/lint-check.js';
import { fixLintErrorNode } from './nodes/fix-lint-error.js';
import { extractAccessibilitySnapshotNode } from './nodes/extract-accessibility-snapshot.js';
import { extractJestErrorsNode } from './nodes/extract-jest-errors.js';
import { analyzeTestErrorsNode } from './nodes/analyze-test-errors.js';
import { analyzeFailureNode } from './nodes/analyze-failure.js';
import { executeRtlFixNode } from './nodes/execute-rtl-fix.js';
import {
  hasTsCheckFailed,
  hasTsCheckPassed,
  hasLintCheckFailed,
  hasLintCheckPassed,
  hasExceededRetries
} from './edges.js';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { langfuseCallbackHandler } from '../langsmith.js';
import { fileLoggingCallbackHandler } from './utils/logging-callback.js';

// Configure state
const WorkflowStateAnnotation = Annotation.Root({
	file: Annotation<WorkflowState['file']>(),
})

export const graph = new StateGraph(
	WorkflowStateAnnotation,
);

// Add all nodes to the graph
graph.addNode("load_test_file", loadTestFileNode)
	.addNode("apply_context", applyContextNode)
	.addNode("plan_rtl_conversion", planRtlConversionNode)
	.addNode("execute_rtl_conversion", executeRtlConversionNode)
	.addNode("run_test", runTestNode)
	.addNode("ts_validation", tsValidationNode)
	.addNode("fix_ts_error", fixTsErrorNode)
	.addNode("lint_check", lintCheckNode)
	.addNode("fix_lint_error", fixLintErrorNode)
	.addNode("extract_accessibility_snapshot", extractAccessibilitySnapshotNode)
	.addNode("extract_jest_errors", extractJestErrorsNode)
	.addNode("analyze_test_errors", analyzeTestErrorsNode)
	.addNode("analyze_failure", analyzeFailureNode)
	.addNode("execute_rtl_fix", executeRtlFixNode)
	.addEdge(START, "load_test_file")
	.addConditionalEdges(
		"load_test_file",
		(state) => state.file.status === "failed" ? "end" : "apply_context",
		{
			end: END,
			apply_context: "apply_context"
		}
	)
	.addEdge("apply_context", "plan_rtl_conversion")
	.addConditionalEdges(
		"plan_rtl_conversion",
		(state) => state.file.status === "failed" ? "end" : "execute_rtl_conversion",
		{
			end: END,
			execute_rtl_conversion: "execute_rtl_conversion"
		}
	)
	.addConditionalEdges(
		"execute_rtl_conversion",
		(state) => state.file.status === "failed" ? "end" : "run_test",
		{
			end: END,
			run_test: "run_test"
		}
	)
	.addConditionalEdges(
		"run_test",
		(state) => {
			if (state.file.currentStep === WorkflowStep.RUN_TEST_PASSED) {
				return "validate_typescript";
			} else if (state.file.currentStep === WorkflowStep.RUN_TEST_FAILED) {
				return "extract_accessibility_snapshot";
			} else {
				return "run_test";
			}
		},
		{
			validate_typescript: "ts_validation",
			extract_accessibility_snapshot: "extract_accessibility_snapshot",
			run_test: "run_test"
		}
	)
	.addEdge("extract_accessibility_snapshot", "extract_jest_errors")
	.addEdge("extract_jest_errors", "analyze_test_errors")
	.addConditionalEdges(
		"analyze_test_errors",
		(state) => {
			if (state.file.currentError) {
				return "analyze_failure";
			} else {
				return "validate_typescript";
			}
		},
		{
			analyze_failure: "analyze_failure",
			validate_typescript: "ts_validation"
		}
	)
	.addEdge("analyze_failure", "execute_rtl_fix")
	.addEdge("execute_rtl_fix", "run_test")
	.addConditionalEdges(
		"ts_validation",
		(state) => {
			if (state.file.skipTs) return "skip_ts";
			if (hasTsCheckPassed(state as WorkflowState)) return "ts_passed";
			if (hasTsCheckFailed(state as WorkflowState) && !hasExceededRetries(state as WorkflowState)) return "fix_ts_error";
			return "end";
		},
		{
			skip_ts: "lint_check",
			ts_passed: "lint_check",
			fix_ts_error: "fix_ts_error",
			end: END
		}
	)
	.addEdge("fix_ts_error", "ts_validation")
	.addConditionalEdges(
		"lint_check",
		(state) => {
			if (state.file.skipLint) return "skip_lint";
			if (hasLintCheckPassed(state as WorkflowState)) return "lint_passed";
			if (hasLintCheckFailed(state as WorkflowState) && !hasExceededRetries(state as WorkflowState)) return "fix_lint_error";
			return "end";
		},
		{
			skip_lint: END,
			lint_passed: END,
			fix_lint_error: "fix_lint_error",
			end: END
		}
	)
	.addEdge("fix_lint_error", "lint_check");

// Compile the graph
const enzymeToRtlConverterGraph = graph.compile();

/**
 * Creates a workflow graph for migrating a test file using LangGraph.
 */
export function createWorkflow(
	testFilePath: string,
	context: EnrichedContext,
	options: WorkflowOptions = {}
): { initialState: WorkflowState, execute: () => Promise<WorkflowState> } {
	const maxRetries = options.maxRetries || 15;

	// Initial file state
	const initialState: WorkflowState = {
		file: {
			path: testFilePath,
			content: '',
			status: 'pending',
			currentStep: WorkflowStep.INITIALIZE,
			context, // Context from ContextEnricher
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
		},
	};

	/**
	 * Execute the workflow
	 */
	const execute = async (): Promise<WorkflowState> => {
		try {
			// Execute the graph with the initial state
			const result = await enzymeToRtlConverterGraph.invoke(initialState, {
				callbacks: [langfuseCallbackHandler, fileLoggingCallbackHandler],
				recursionLimit: 100
			});
			return result as WorkflowState;
		} catch (error) {
			console.error(`Error in workflow execution:`, error);
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
		execute
	};
}

/**
 * Process a single test file through the migration workflow
 */
export async function processSingleFile(
	testFilePath: string,
	context: EnrichedContext,
	options: WorkflowOptions = {}
): Promise<WorkflowState> {
	const workflow = createWorkflow(testFilePath, context, options);
	return await workflow.execute();
}
