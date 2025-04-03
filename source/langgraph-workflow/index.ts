import { EnrichedContext, LintCheckResult, TestResult, TsCheckResult, WorkflowOptions, WorkflowState, WorkflowStep, FileStatus } from './interfaces/index.js';
import { loadTestFileNode } from './nodes/load-test-file.js';
import { applyContextNode } from './nodes/apply-context.js';
import { convertToRTLNode } from './nodes/convert-to-rtl.js';
import { runTestNode } from './nodes/run-test.js';
import { fixRtlNode } from './nodes/fix-rtl-error.js';
import { tsValidationNode } from './nodes/ts-validation.js';
import { fixTsErrorNode } from './nodes/fix-ts-error.js';
import { lintCheckNode } from './nodes/lint-check.js';
import { fixLintErrorNode } from './nodes/fix-lint-error.js';
import {
  hasTestFailed,
  hasTestPassed,
  hasTsCheckFailed,
  hasTsCheckPassed,
  hasLintCheckFailed,
  hasLintCheckPassed,
  hasExceededRetries
} from './edges.js';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

type FileState = {
	path: string;
	content: string;
	status: FileStatus;
	currentStep: WorkflowStep;
	context: EnrichedContext;
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
	originalTest: string;
	skipTs: boolean;
	skipLint: boolean;
	skipTest: boolean;
	apiKey?: string;
	testResult?: TestResult;
	tsCheck?: TsCheckResult;
	lintCheck?: LintCheckResult;
	rtlTest?: string;
	error?: Error;
	tempPath?: string;
	outputPath?: string;
	componentContext?: string;
}

/**
 * Creates a workflow graph for migrating a test file using LangGraph.
 */
export function createWorkflow(
  testFilePath: string,
  context: EnrichedContext,
  options: WorkflowOptions = {}
): { initialState: WorkflowState, execute: () => Promise<WorkflowState> } {
  const maxRetries = options.maxRetries || 3;

	const WorkflowStateAnnotation = Annotation.Root({
		file: Annotation<FileState>,
	})

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
      apiKey: options.apiKey,
      originalTest: '',
      skipTs: options.skipTs || false,
      skipLint: options.skipLint || false,
      skipTest: options.skipTest || false,
    },
  };

  // Create a new StateGraph
  const graph = new StateGraph(
		WorkflowStateAnnotation,
	);

  // Define all nodes in the graph
  graph.addNode("load_test_file", loadTestFileNode)
	.addNode("apply_context", applyContextNode)
	.addNode("convert_to_rtl", convertToRTLNode)
	.addNode("run_test", runTestNode)
	.addNode("fix_rtl_error", fixRtlNode)
	.addNode("ts_validation", tsValidationNode)
	.addNode("fix_ts_error", fixTsErrorNode)
	.addNode("lint_check", lintCheckNode)
	.addNode("refactor_lint", fixLintErrorNode)
  .addEdge(START, "load_test_file")
  .addConditionalEdges(
    "load_test_file",
    (state) => state.file.status === "failed" ? "end" : "apply_context",
    {
      end: END,
      apply_context: "apply_context"
    }
  )
  .addEdge("apply_context", "convert_to_rtl")
  .addConditionalEdges(
    "convert_to_rtl",
    (state) => state.file.status === "failed" ? "end" : "run_test",
    {
      end: END,
      run_test: "run_test"
    }
  )
  .addConditionalEdges(
    "run_test",
    (state) => {
      if (hasTestPassed(state)) return "test_passed";
      if (hasTestFailed(state) && !hasExceededRetries(state)) return "fix_rtl_error";
      return "end";
    },
    {
      test_passed: "ts_validation",
      fix_rtl_error: "fix_rtl_error",
      end: END
    }
  )
  // Edge from fix_rtl_error back to run_test (retry loop)
  .addEdge("fix_rtl_error", "run_test")
  // Conditional edge from ts_validation that handles skipping
  .addConditionalEdges(
    "ts_validation",
    (state) => {
      if (state.file.skipTs) return "skip_ts";
      if (hasTsCheckPassed(state)) return "ts_passed";
      if (hasTsCheckFailed(state) && !hasExceededRetries(state)) return "fix_ts_error";
      return "end";
    },
    {
      skip_ts: "lint_check",
      ts_passed: "lint_check",
      fix_ts_error: "fix_ts_error",
      end: END
    }
  )
  // Edge from fix_ts_error back to ts_validation (retry loop)
  .addEdge("fix_ts_error", "ts_validation")
  // Conditional edge from lint_check that handles skipping
  .addConditionalEdges(
    "lint_check",
    (state) => {
      if (state.file.skipLint) return "skip_lint";
      if (hasLintCheckPassed(state)) return "lint_passed";
      if (hasLintCheckFailed(state) && !hasExceededRetries(state)) return "refactor_lint";
      return "end";
    },
    {
      skip_lint: "lint_check",
      lint_passed: "lint_check",
      refactor_lint: "refactor_lint",
      end: END
    }
  )
  // Edge from refactor_lint back to lint_check (retry loop)
  .addEdge("refactor_lint", "lint_check")

  // Compile the graph
  const compiledGraph = graph.compile();

  /**
   * Execute the workflow
   */
  const execute = async (): Promise<WorkflowState> => {
    try {
      // Execute the graph with the initial state
      const result = await compiledGraph.invoke(initialState);
      return result;
    } catch (error) {
      console.error('Error in workflow execution:', error);
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
 * Processes a single file through the workflow
 *
 * @param testFilePath Path to the test file
 * @param context Enriched context from the context enricher
 * @param options Workflow options
 * @returns The final state after processing
 */
export async function processSingleFile(
  testFilePath: string,
  context: EnrichedContext,
  options: WorkflowOptions = {}
): Promise<WorkflowState> {
  // Create the workflow
  const { execute } = createWorkflow(testFilePath, context, options);

  // Execute the workflow
  try {
    return await execute();
  } catch (error) {
    console.error(`Error processing file ${testFilePath}:`, error);
    throw error;
  }
}
