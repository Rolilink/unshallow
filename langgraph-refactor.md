# LangGraph Workflow Refactor Plan (Revised)

## Overview

This document outlines a comprehensive plan to refactor the LangGraph workflow from a component-centric approach to a file-centric approach. Since this is a v1 with no active users, we can implement a **clean break** approach without worrying about backward compatibility or gradual transitions. The refactoring will completely replace the component-oriented structure with the new `EnrichedContext` and `File` interfaces.

## Current Architecture Analysis

After reviewing the codebase, I've identified the following areas that need to be refactored:

### Key Components

1. **State Management**: The `FileState` interface currently mixes component-oriented properties with file-oriented ones.
2. **Utils**: Particularly `format-context.ts` is entirely component-oriented.
3. **Nodes**: Several nodes directly access component properties from the context.
4. **Prompts**: Prompt templates use component-specific placeholders.
5. **Interfaces**: Many interfaces still refer to components rather than files.

### Cleanup Opportunities

1. **Remove Deprecated Interfaces**: All deprecated interfaces can be completely removed.
2. **Remove Component-Oriented Code**: All component-specific code can be deleted rather than adapted.
3. **Consistent File-Centric Naming**: Rename all variables and properties to follow file-centric terminology.

## Refactoring Approach

### 1. Update the Core Types

Fully adopt the new `EnrichedContext` and `File` interfaces from source/types.ts:

```typescript
// Already defined in types.ts
export interface File {
  fileName: string;
  fileContent: string;
  fileAbsolutePath: string;
  pathRelativeToTestedFile?: string;
  imports?: Record<string, File>;
}

export interface EnrichedContext {
  testedFile: File;
  exampleTests?: Record<string, File>;
  userProvidedContext?: string;
}
```

### 2. Update the FileState Interface

Complete replacement of the `FileState` interface with a fully file-oriented structure:

```typescript
export interface FileState {
  // Replace path and content with testFile
  testFile: File; // The test file itself (without imports)
  originalTest: string; // Keep original test content for reference

  // Remove rtlTest since we'll modify original files directly

  // State tracking properties
  status: FileStatus;
  currentStep: WorkflowStep;
  error?: Error;

  // File-oriented context
  context: EnrichedContext;

  // Langfuse tracking ID (for parallel migrations)
  langfuseId?: string;

  // Keep misc properties the same
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

  // Fix loop properties
  accessibilityDump?: string;
  domTree?: string;
  trackedErrors?: Record<string, TrackedError>;
  currentError?: TrackedError | null;
  totalAttempts?: number;
  fixIntent?: string;

  // Reasoning properties
  reasoningPlanning?: boolean;
  reasoningExecution?: boolean;
  reasoningReflection?: boolean;

  // File system properties
  unshallowDir?: string;
  testDir?: string;
  logsPath?: string;
  attemptPath?: string;

  // Retry mode
  retryMode?: boolean;

  // Reporting
  metaReportPath?: string;
}
```

### 3. Create Node-Specific Context Getters

Instead of a single context formatting utility, create node-specific context getter functions that map directly to the variables expected by each prompt. This approach enables better token caching through consistent prompt prefixes:

```typescript
/**
 * Interface for context getters to enable type safety
 */
export interface ContextGetterResult {
  [key: string]: string;
}

/**
 * Context getter for the plan-rtl-conversion node
 */
export function getPlanRtlConversionContext(state: WorkflowState): ContextGetterResult {
  const { file } = state;
  const { context } = file;
  const testedFile = context.testedFile;
  const testFile = file.testFile;

  // Format imports for the prompt
  let fileImports = '';
  if (testedFile.imports) {
    fileImports = Object.entries(testedFile.imports)
      .map(([path, importFile]) => {
        return `
### ${importFile.fileName} (Import path: ${path}):
\`\`\`tsx
// path: ${importFile.fileAbsolutePath}
${importFile.fileContent}
\`\`\``;
      })
      .join('\n');
  }

  // Format example tests if available
  let supportingExamples = '';
  if (context.exampleTests && Object.keys(context.exampleTests).length > 0) {
    supportingExamples = Object.entries(context.exampleTests)
      .map(([path, exampleFile]) => {
        return `
### ${exampleFile.fileName}:
\`\`\`tsx
${exampleFile.fileContent}
\`\`\``;
      })
      .join('\n');
  }

  // Return exactly the variables the prompt expects
  return {
    testFile: testFile.fileContent,
    testedFileName: testedFile.fileName,
    testedFileContent: testedFile.fileContent,
    fileImports,
    supportingExamples,
    userProvidedContext: context.userProvidedContext || '',
  };
}

/**
 * Context getter for the execute-rtl-conversion node
 */
export function getExecuteRtlConversionContext(state: WorkflowState): ContextGetterResult {
  const { file } = state;
  const { context } = file;
  const testedFile = context.testedFile;
  const testFile = file.testFile;

  // Return exactly the variables the prompt expects, potentially different from other nodes
  return {
    testFile: testFile.fileContent,
    testedFileName: testedFile.fileName,
    testedFileContent: testedFile.fileContent,
    // Include different format or subset of imports if needed by this specific prompt
    fileImports: formatImportsForExecuteNode(testedFile.imports),
    gherkinPlan: file.fixPlan?.plan || '',
    userProvidedContext: context.userProvidedContext || '',
  };
}

/**
 * Context getter for the analyze-failure node
 */
export function getAnalyzeFailureContext(state: WorkflowState): ContextGetterResult {
  const { file } = state;
  const { context, testResult, currentError } = file;
  const testedFile = context.testedFile;
  const testFile = file.testFile;

  // Return variables specific to the analyze-failure prompt
  return {
    testFile: testFile.fileContent,
    testedFileName: testedFile.fileName,
    testedFileContent: testedFile.fileContent,
    testName: currentError?.testName || '',
    normalizedError: currentError?.normalized || '',
    rawError: currentError?.message || '',
    accessibilityDump: file.accessibilityDump || '',
    domTree: file.domTree || '',
    previousTestCode: file.originalTest,
  };
}

// Helper function for formatting imports specifically for execute node
function formatImportsForExecuteNode(imports?: Record<string, File>): string {
  if (!imports) return '';

  // Format differently based on node-specific needs
  return Object.entries(imports)
    .map(([path, importFile]) => {
      return `
// Import from: ${path}
\`\`\`tsx
${importFile.fileContent}
\`\`\``;
    })
    .join('\n');
}

// Additional context getters for each node in the workflow...
```

### 4. Update Nodes to Use Context Getters

Update each node to use its specific context getter function to obtain prompt variables:

```typescript
export const planRtlConversionNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;
  const NODE_NAME = 'plan-rtl-conversion';

  await logger.logNodeStart(NODE_NAME, `Planning RTL conversion`);

  try {
    // Use the node-specific context getter
    const promptContext = getPlanRtlConversionContext(state);

    // The prompt template interpolation now happens with the getter result
    const prompt = planRtlConversionPrompt
      .replace('{testFile}', promptContext.testFile)
      .replace('{testedFileName}', promptContext.testedFileName)
      .replace('{testedFileContent}', promptContext.testedFileContent)
      .replace('{fileImports}', promptContext.fileImports)
      .replace('{supportingExamples}', promptContext.supportingExamples)
      .replace('{userProvidedContext}', promptContext.userProvidedContext);

    // Log node progress...

    // Make the LLM call with the prompt...

    // Process the result...

    // Return the updated state...
  } catch (error) {
    // Error handling...
  }
};
```

### 5. Update OpenAI Calls for Langfuse Tracing

Update the structured OpenAI function call utility to include langfuseId for consistent tracing:

```typescript
/**
 * Enhanced OpenAI structured function call that maintains Langfuse tracing
 */
export async function callStructuredOpenAI<T extends z.ZodType>(
  prompt: string,
  outputSchema: T,
  model: string,
  options: {
    temperature?: number;
    maxTokens?: number;
    langfuseId?: string; // Include langfuseId for tracing
    parentTraceId?: string; // Optional parent trace ID
  } = {}
): Promise<z.infer<T>> {
  const { temperature = 0.2, maxTokens = 4000, langfuseId, parentTraceId } = options;

  // Create trace metadata for Langfuse
  const traceMetadata: Record<string, any> = {};
  if (langfuseId) {
    traceMetadata.langfuseId = langfuseId;
  }
  if (parentTraceId) {
    traceMetadata.parentTraceId = parentTraceId;
  }

  try {
    // Create Langfuse trace if langfuseId is provided
    let trace;
    if (langfuseId && langfuseClient) {
      trace = langfuseClient.trace({
        id: langfuseId, // Use the provided ID for consistent tracing
        name: 'openai-call',
        metadata: traceMetadata,
      });
    }

    // Make OpenAI API call with trace span
    const result = await (trace
      ? trace.span({
          name: `${model}-call`,
          input: { prompt, schema: outputSchema.description },
        }, () => callOpenAIWithSchema(prompt, outputSchema, model, temperature, maxTokens))
      : callOpenAIWithSchema(prompt, outputSchema, model, temperature, maxTokens));

    return result;
  } catch (error) {
    // Log error to Langfuse if available
    if (langfuseId && langfuseClient) {
      langfuseClient.error({
        traceId: langfuseId,
        name: 'openai-call-error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
}

/**
 * Base OpenAI call function with schema validation
 */
async function callOpenAIWithSchema<T extends z.ZodType>(
  prompt: string,
  outputSchema: T,
  model: string,
  temperature: number,
  maxTokens: number
): Promise<z.infer<T>> {
  // Actual OpenAI API call implementation...
}
```

### 6. Update createWorkflow Function

Update the createWorkflow function to prepare the initial state without formatting context in advance and include a langfuseId:

```typescript
export function createWorkflow(
  testFilePath: string,
  context: EnrichedContext,
  options: WorkflowOptions = {},
): {initialState: WorkflowState; execute: () => Promise<WorkflowState>} {
  const maxRetries = options.maxRetries || 8;

  /**
   * Helper function to load test file content synchronously
   */
  const loadTestFile = (filePath: string): { content: string, error?: Error } => {
    try {
      // Use synchronous file reading since we're initializing the workflow
      const content = fs.readFileSync(filePath, 'utf8');
      logger.info('workflow', `Loaded test file: ${filePath} (${content.length} characters)`);
      return { content };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('workflow', `Failed to load test file: ${filePath}`, error);
      return { content: '', error };
    }
  };

  // Load the test file content
  const { content: fileContent, error: fileError } = loadTestFile(testFilePath);

  // Create File object for the test file with content already loaded
  const testFile: File = {
    fileName: path.basename(testFilePath),
    fileContent,
    fileAbsolutePath: testFilePath
  };

  // Determine initial step based on options and retry mode
  let initialStep = WorkflowStep.INITIALIZE;
  if (fileError) {
    initialStep = WorkflowStep.INITIALIZE; // Keep at initialize if there's an error
  } else if (options.retry) {
    // In retry mode, check if we have existing RTL test content
    try {
      // Check for existing temp file - logic would be moved to createWorkflow
      const hasExistingRtl = artifactFileSystem.checkTempFileExists(testFilePath);

      if (hasExistingRtl) {
        // If we have existing RTL content, we can skip planning and execution
        initialStep = WorkflowStep.RUN_TEST;
        logger.info('workflow', `Retry mode: Found existing RTL content, starting at RUN_TEST step`);
      } else {
        // Otherwise start with planning
        initialStep = WorkflowStep.PLAN_RTL_CONVERSION;
        logger.info('workflow', `Retry mode: No existing RTL content, starting at PLAN_RTL_CONVERSION step`);
      }
    } catch (error) {
      // If checking fails, default to planning
      initialStep = WorkflowStep.PLAN_RTL_CONVERSION;
      logger.error('workflow', `Error checking for existing RTL content, defaulting to PLAN_RTL_CONVERSION`, error);
    }
  } else {
    // Regular flow, start with planning
    initialStep = WorkflowStep.PLAN_RTL_CONVERSION;
    logger.info('workflow', `Starting migration with PLAN_RTL_CONVERSION step`);
  }

  // Generate a unique ID for Langfuse tracing
  const langfuseId = options.langfuseId || `migration-${uuidv4()}`;

  // Initial state with file already loaded but without formatted context
  const initialState: WorkflowState = {
    file: {
      testFile,
      originalTest: fileContent,
      status: fileError ? 'failed' : 'pending',
      currentStep: initialStep,
      context, // Just pass the raw context, each node will format it as needed
      langfuseId, // Include the Langfuse ID for tracing
      error: fileError,
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
      skipTs: options?.skipTs || false,
      skipLint: options?.skipLint || false,
      skipTest: options?.skipTest || false,

      // Set retry mode flag
      retryMode: options?.retry || false,

      // Pass reasoning flags for use in nodes
      reasoningPlanning: options?.reasoningPlanning || false,
      reasoningExecution: options?.reasoningExecution || false,
      reasoningReflection: options?.reasoningReflection || false,
    },
  };

  /**
   * Execute the workflow
   */
  const execute = async (): Promise<WorkflowState> => {
    try {
      // Use the langfuseId from the state
      const workflowRunId = initialState.file.langfuseId;

      // Get the Langfuse callback handler with the ID
      const langfuseCallbackHandler = await getLangfuseCallbackHandler(workflowRunId);

      // Log initial progress
      logger.progress(testFilePath, 'Starting migration');

      // If we failed to load the file, return immediately
      if (fileError) {
        logger.error('workflow', 'Failed to load test file, aborting workflow');
        return initialState;
      }

      // Execute the graph with the initial state, starting with the appropriate node
      const result = await enzymeToRtlConverterGraph.invoke(initialState, {
        callbacks: langfuseCallbackHandler ? [langfuseCallbackHandler] : [],
        recursionLimit: 200,
        runId: workflowRunId,
      });

      // Log final progress
      logger.progress(
        testFilePath,
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
```

### 7. Update processSingleFile Function

Direct implementation for file-centric approach with modification of original files:

```typescript
export async function processSingleFile(
  testFilePath: string,
  context: EnrichedContext,
  options: WorkflowOptions = {},
): Promise<WorkflowState> {
  // Set up directories for logging and backup
  const testDirectoryPaths = await testFileSystem.setupTestDirectory(testFilePath);
  const {unshallowDir, testDir, attemptPath} = testDirectoryPaths;

  // Initialize the logs file
  const logsPath = await artifactFileSystem.initializeLogsFile(testDir);

  // Configure the logger with the logs file path
  logger.setLogsPath(logsPath);

  // Set logger silent mode if specified
  if (options.silent) {
    logger.setSilent(true);
  }

  logger.info('workflow', `Starting migration for ${testFilePath}`);

  // Direct use of the EnrichedContext
  const workflow = createWorkflow(testFilePath, context, options);

  // Update the initial state with the unshallow paths
  workflow.initialState.file = {
    ...workflow.initialState.file,
    unshallowDir,
    testDir,
    logsPath,
    attemptPath,
  };

  try {
    // Execute the workflow
    const result = await workflow.execute();

    // If the migration was successful, directly update the original file
    if (result.file.status === 'success' && result.file.testFile.fileContent !== result.file.originalTest) {
      logger.success('workflow', 'Migration completed successfully');

      // Backup the original file first
      await artifactFileSystem.saveBackupFile(testDir, testFilePath, result.file.originalTest);

      // Replace the original file with the migrated content
      await import('fs/promises').then(fs =>
        fs.writeFile(testFilePath, result.file.testFile.fileContent),
      );

      // Clean up the test directory on success
      await testFileSystem.cleanupTestDirectory(testDir);
    } else {
      logger.info(
        'workflow',
        `Migration completed with status: ${result.file.status}`,
      );

      // If the migration failed but we have a partial result, save it to the attempt file
      if (result.file.testFile.fileContent !== result.file.originalTest) {
        await artifactFileSystem.saveAttemptFile(
          testDir,
          testFilePath,
          result.file.testFile.fileContent,
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
```

### 8. Update Graph Definition

Update the graph definition to remove both the load-test-file and apply-context nodes:

```typescript
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
  .addEdge(START, 'plan_rtl_conversion') // Start directly with plan_rtl_conversion by default
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
    }
  )
  // ... rest of the edges remain unchanged
```

## Token Caching through Prompt Prefixes

The node-specific context getters enable better token caching by:

1. **Consistent prefix structure**: Each prompt can have a consistent prefix structure that remains unchanged between runs
2. **Specialized formatting**: Each getter formats only what's needed for its specific prompt
3. **Cached tokens**: LLM providers can cache tokens when prefix patterns are consistent
4. **Reduced redundancy**: No need to include all context in every prompt

While the prompt templates themselves will be updated separately, the context getters provide the foundation for an efficient token caching strategy.

## Langfuse Tracing Continuity

The langfuseId in the FileState interface enables:

1. **Consistent tracing** across parallel migrations
2. **Linked traces** between workflow steps
3. **Proper parent-child relationships** in the Langfuse UI
4. **Continuous monitoring** of each file's migration process

By passing the langfuseId to the structured OpenAI function calls, we maintain a complete trace of the entire migration process, making debugging and performance monitoring much more effective.

## Implementation Sequence

Since this is a clean break approach, we can implement the changes in this logical order:

1. **Remove all deprecated interfaces** from interfaces/index.ts
2. **Create node-specific context getter functions** for each workflow node
3. **Update the FileState interface** to use testFile and remove rtlTest
4. **Remove loadTestFileNode and apply-context node** from the codebase
5. **Update graph definition** to start with the appropriate node based on state
6. **Update createWorkflow** to load test files directly and prepare initial state
7. **Update OpenAI calling utility** to accept and use langfuseId
8. **Update artifact-filesystem.ts** to handle direct file modification and backup
9. **Update all nodes** to use their specific context getters
10. **Update all prompt templates** to use file-specific terminology (will be done separately)
11. **Update processSingleFile** to work with direct file modification
12. **Update parallel-migration.ts** to properly pass langfuseId to each worker
13. **Update any remaining references** to components throughout the codebase
14. **Add a logger.logFile method** to replace logger.logComponent if needed

## Cleanup Activities

1. **Delete all component-oriented interfaces** - Remove Component, ImportInfo, LegacyEnrichedContext
2. **Remove the formatComponentContext function** - Delete rather than deprecate
3. **Delete loadTestFileNode and apply-context node** - Replace with direct initialization in createWorkflow
4. **Replace all componentContext references** - Change to fileContext references where needed
5. **Update logging methods** - Ensure they work with files rather than components
6. **Update test files** - Make sure all tests use the file-centric approach
7. **Remove temporary file logic** - Replace with backup and direct file modification approach
8. **Remove the single formatFileContext function** - Replace with node-specific context getters
