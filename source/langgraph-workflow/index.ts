import { EnrichedContext, LintCheckResult, TestResult, TsCheckResult, WorkflowOptions, WorkflowState, WorkflowStep, FileStatus } from './interfaces/index.js';
import { loadTestFileNode } from './nodes/load-test-file.js';
import { applyContextNode } from './nodes/apply-context.js';
import { planRtlConversionNode } from './nodes/plan-rtl-conversion.js';
import { executeRtlConversionNode } from './nodes/execute-rtl-conversion.js';
import { runTestNode } from './nodes/run-test.js';
import { planRtlFixNode } from './nodes/plan-rtl-fix.js';
import { executeRtlFixNode } from './nodes/execute-rtl-fix.js';
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
import { langfuseCallbackHandler } from '../langsmith.js';


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
	testResult?: TestResult;
	tsCheck?: TsCheckResult;
	lintCheck?: LintCheckResult;
	rtlTest?: string;
	error?: Error;
	tempPath?: string;
	outputPath?: string;
	componentContext?: string;
}

const WorkflowStateAnnotation = Annotation.Root({
	file: Annotation<FileState>,
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
	.addNode("plan_rtl_fix", planRtlFixNode)
	.addNode("execute_rtl_fix", executeRtlFixNode)
	.addNode("ts_validation", tsValidationNode)
	.addNode("fix_ts_error", fixTsErrorNode)
	.addNode("lint_check", lintCheckNode)
	.addNode("fix_lint_error", fixLintErrorNode)
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
      if (hasTestPassed(state)) return "test_passed";
      if (hasTestFailed(state) && !hasExceededRetries(state)) return "plan_rtl_fix";
      return "end";
    },
    {
      test_passed: "ts_validation",
      plan_rtl_fix: "plan_rtl_fix",
      end: END
    }
  )
  .addEdge("plan_rtl_fix", "execute_rtl_fix")
  .addEdge("execute_rtl_fix", "run_test")
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
  .addEdge("fix_ts_error", "ts_validation")
  .addConditionalEdges(
    "lint_check",
    (state) => {
      if (state.file.skipLint) return "skip_lint";
      if (hasLintCheckPassed(state)) return "lint_passed";
      if (hasLintCheckFailed(state) && !hasExceededRetries(state)) return "fix_lint_error";
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
      skipTs: options.skipTs || false,
      skipLint: options.skipLint || false,
      skipTest: options.skipTest || false,
    },
  };

  /**
   * Execute the workflow
   */
  const execute = async (): Promise<WorkflowState> => {
    try {
      // Execute the graph with the initial state and set recursion limit to 100
      const result = await enzymeToRtlConverterGraph.invoke(initialState, {
        callbacks: [langfuseCallbackHandler],
        recursionLimit: 100
      });
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
    console.log('Executing workflow...');
    const result = await execute();

    // Log explanation if available for better understanding of changes
    if (result.file.fixExplanation) {
      console.log('\n=== Explanation of Changes ===');
      console.log(result.file.fixExplanation);
      console.log('=============================\n');
    }

    return result;
  } catch (error) {
    console.error(`Error processing file ${testFilePath}:`, error);
    throw error;
  }
}
