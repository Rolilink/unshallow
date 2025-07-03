# Agent Toolkit API Reference

## Table of Contents

1. [Overview](#overview)
2. [CodingAgentFactory](#codingagentfactory)
3. [OpenAIAbstraction](#openaibstraction)
4. [Agent Interfaces](#agent-interfaces)
5. [Tool System](#tool-system)
6. [Context Engineering](#context-engineering)
7. [Error Types](#error-types)
8. [Configuration](#configuration)
9. [Usage Examples](#usage-examples)

## Overview

The Agent Toolkit provides a comprehensive set of interfaces and implementations for creating and managing coding agents. All agents are built on LangGraph's `createReactAgent` foundation with domain-specific tools and context engineering.

## CodingAgentFactory

The central factory for creating and configuring all agent types.

### Interface

```typescript
class CodingAgentFactory {
  constructor(
    config: ConfigurationManager,
    openaiAbstraction: OpenAIAbstraction,
    fileSystem: IFileSystem,
    rootPath: string
  );

  createPlanningAgent(): ReActAgent;
  createMigrationAgent(): ReActAgent;
  createLintFixAgent(): ReActAgent;
  createTypeScriptFixAgent(): ReActAgent;
  
  // Utility methods
  getAvailableTools(agentType: AgentType): BaseTool[];
  validateConfiguration(): ConfigurationValidationResult;
}
```

### Methods

#### `createPlanningAgent(): ReActAgent`

Creates a specialized agent for analyzing test files and generating migration plans.

**Returns**: Configured ReAct agent with FileSystemTool and TestExecutionTool

**Tools Included**:
- `FileSystemTool`: For reading test files and dependencies
- `TestExecutionTool`: For understanding test structure and behavior

**System Prompt**: Optimized for code analysis and plan generation

**Example**:
```typescript
const factory = new CodingAgentFactory(config, openai, fileSystem, '/project');
const planningAgent = factory.createPlanningAgent();

const result = await planningAgent.invoke({
  testFile: 'src/Component.test.tsx',
  projectConfig: projectConfiguration
});
```

#### `createMigrationAgent(): ReActAgent`

Creates an agent specialized for executing test migrations with iterative fix loops.

**Returns**: Configured ReAct agent with FileSystemTool, TestExecutionTool, and PatchTool

**Tools Included**:
- `FileSystemTool`: For reading and writing test files
- `TestExecutionTool`: For running tests and analyzing failures
- `PatchTool`: For applying code modifications

**System Prompt**: Optimized for code migration and iterative fixing

**Example**:
```typescript
const migrationAgent = factory.createMigrationAgent();

const result = await migrationAgent.invoke({
  plan: planningResult.plan,
  context: planningResult.compressedContext,
  testFile: 'src/Component.test.tsx'
});
```

#### `createLintFixAgent(): ReActAgent`

Creates an agent specialized for resolving linting errors.

**Returns**: Configured ReAct agent with LintTool and PatchTool

**Tools Included**:
- `LintTool`: For executing linting with auto-fix capabilities
- `FileSystemTool`: For reading and writing files
- `PatchTool`: For applying manual corrections

**System Prompt**: Optimized for code style and quality fixes

#### `createTypeScriptFixAgent(): ReActAgent`

Creates an agent specialized for resolving TypeScript compilation errors.

**Returns**: Configured ReAct agent with TypeCheckTool and PatchTool

**Tools Included**:
- `TypeCheckTool`: For TypeScript compilation and error analysis
- `FileSystemTool`: For reading and writing files
- `PatchTool`: For applying type fixes

**System Prompt**: Optimized for type error resolution

## OpenAIAbstraction

Manages OpenAI model selection, configuration, and telemetry integration.

### Interface

```typescript
class OpenAIAbstraction {
  constructor(
    config: ConfigurationManager,
    langfuseClient?: LangfuseClient
  );

  getModel(nodeType: AgentType): ChatOpenAI;
  createStructuredModel<T>(nodeType: AgentType, schema: z.ZodSchema<T>): ChatOpenAI;
  
  // Configuration methods
  getModelTier(nodeType: AgentType): ModelTier;
  getTokenLimits(nodeType: AgentType): TokenLimits;
  
  // Telemetry methods
  createRunId(): string;
  trackUsage(nodeType: AgentType, tokens: number): void;
}
```

### Methods

#### `getModel(nodeType: AgentType): ChatOpenAI`

Returns a configured ChatOpenAI instance for the specified agent type.

**Parameters**:
- `nodeType`: The type of agent ('plan' | 'migrate' | 'lint-fix' | 'ts-fix')

**Returns**: Configured ChatOpenAI model instance

**Model Tier Mapping**:
- `nano` → `gpt-4o-mini`
- `mini` → `gpt-4o`
- `full` → `gpt-4.1`

**Example**:
```typescript
const openai = new OpenAIAbstraction(config, langfuseClient);
const model = openai.getModel('plan'); // Returns gpt-4o for 'mini' tier
```

#### `createStructuredModel<T>(nodeType: AgentType, schema: z.ZodSchema<T>): ChatOpenAI`

Creates a model configured for structured output using the provided Zod schema.

**Parameters**:
- `nodeType`: The type of agent
- `schema`: Zod schema for structured output validation

**Returns**: ChatOpenAI model with structured output configuration

**Example**:
```typescript
const PlanResultSchema = z.object({
  plan: z.string(),
  confidence: z.number()
});

const model = openai.createStructuredModel('plan', PlanResultSchema);
```

## Agent Interfaces

### AgentType

```typescript
type AgentType = 'plan' | 'migrate' | 'lint-fix' | 'ts-fix';
```

### AgentResult

Base interface for all agent results:

```typescript
interface AgentResult {
  success: boolean;
  agentType: AgentType;
  executionTimeMs: number;
  retryCount: number;
  error?: AgentError;
}
```

### PlanningResult

```typescript
interface PlanningResult extends AgentResult {
  plan: string;                    // Gherkin-style migration plan
  testsToUpdate: string[];         // Test cases requiring updates
  testsToRemove: string[];         // Test cases to be removed
  testsToMaintain: string[];       // Test cases to keep as-is
  compressedContext: string;       // Investigation summary for migration agent
  confidence: number;              // Confidence score (0-1)
  analysisDetails: {
    enzymePatterns: string[];      // Identified Enzyme patterns
    dependencies: string[];        // Test dependencies discovered
    complexity: 'low' | 'medium' | 'high';
  };
}
```

### MigrationResult

```typescript
interface MigrationResult extends AgentResult {
  changesApplied: CodeChange[];    // List of changes made
  testsPass: boolean;              // Whether all tests pass
  issues: Issue[];                 // Any remaining issues
  nextSteps: string[];             // Recommended next actions
  testResults: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    errors: TestError[];
  };
}
```

### LintFixResult

```typescript
interface LintFixResult extends AgentResult {
  autoFixesApplied: number;        // Number of automatic fixes
  manualFixesApplied: number;      // Number of manual fixes
  remainingIssues: LintIssue[];    // Any unresolved issues
  rulesViolated: string[];         // ESLint rules that were violated
}
```

### TypeScriptFixResult

```typescript
interface TypeScriptFixResult extends AgentResult {
  errorsFixed: number;             // Number of type errors resolved
  remainingErrors: TypeError[];    // Any unresolved type errors
  changesApplied: CodeChange[];    // Type fixes applied
}
```

## Tool System

### BaseTool Interface

All tools implement this common interface:

```typescript
interface BaseTool {
  name: string;
  description: string;
  schema: z.ZodSchema;
  execute(input: unknown): Promise<unknown>;
}
```

### FileSystemTool

Provides secure file operations through RootedFileSystem.

```typescript
interface FileSystemToolInput {
  operation: 'read' | 'write' | 'exists' | 'delete' | 'list';
  path: string;
  content?: string;
}

interface FileSystemToolResult {
  success: boolean;
  content?: string;
  exists?: boolean;
  files?: string[];
  error?: string;
}
```

**Usage**:
```typescript
const result = await fileSystemTool.execute({
  operation: 'read',
  path: 'src/Component.test.tsx'
});
```

### TestExecutionTool

Executes tests and analyzes results.

```typescript
interface TestExecutionToolInput {
  operation: 'run' | 'analyze' | 'coverage';
  filePath?: string;
  testCommand?: string;
  options?: {
    timeout?: number;
    verbose?: boolean;
  };
}

interface TestExecutionToolResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  errors: TestError[];
  coverage?: CoverageReport;
  executionTime: number;
}
```

### LintTool

Executes linting with auto-fix capabilities.

```typescript
interface LintToolInput {
  operation: 'check' | 'fix' | 'rules';
  filePath: string;
  autoFix?: boolean;
  rules?: string[];
}

interface LintToolResult {
  success: boolean;
  issues: LintIssue[];
  fixesApplied: number;
  autoFixAvailable: boolean;
  ruleViolations: string[];
}
```

### TypeCheckTool

Performs TypeScript validation and error analysis.

```typescript
interface TypeCheckToolInput {
  operation: 'check' | 'analyze' | 'project';
  filePath?: string;
  strict?: boolean;
}

interface TypeCheckToolResult {
  success: boolean;
  errors: TypeError[];
  warnings: TypeWarning[];
  errorCount: number;
  diagnostics: TsDiagnostic[];
}
```

### PatchTool

Applies code modifications using the PatchDiff system.

```typescript
interface PatchToolInput {
  operation: 'apply' | 'validate' | 'preview';
  patchText: string;
  targetFile?: string;
  options?: {
    dryRun?: boolean;
    validateOnly?: boolean;
  };
}

interface PatchToolResult {
  success: boolean;
  filesModified: number;
  filesCreated: number;
  filesDeleted: number;
  changes: PatchChange[];
  warnings: string[];
  errors: string[];
}
```

## Context Engineering

### ContextBuilder

Utilities for constructing and optimizing agent context.

```typescript
class ContextBuilder {
  static buildPlanningContext(
    testFile: string,
    projectConfig: ProjectConfig,
    options?: ContextOptions
  ): string;

  static buildMigrationContext(
    planResult: PlanningResult,
    testFile: string,
    options?: ContextOptions
  ): string;

  static compressContext(
    context: string,
    maxTokens: number,
    preserveEssential?: string[]
  ): string;

  static extractErrorContext(
    errors: Error[],
    codeContext: string
  ): string;
}
```

### ContextOptions

```typescript
interface ContextOptions {
  maxTokens?: number;
  includeProjectPatterns?: boolean;
  includeDependencies?: boolean;
  compressionLevel?: 'none' | 'light' | 'aggressive';
  preserveCodeBlocks?: boolean;
}
```

## Error Types

### AgentError

Base error type for all agent-related errors.

```typescript
class AgentError extends Error {
  constructor(
    message: string,
    public agentType: AgentType,
    public context: ErrorContext,
    public recoveryHints: string[] = []
  );
}

interface ErrorContext {
  currentState: WorkflowState;
  toolsUsed: string[];
  retryCount: number;
  lastSuccessfulOperation?: string;
  tokenUsage?: number;
}
```

### ToolError

Error type for tool execution failures.

```typescript
class ToolError extends Error {
  constructor(
    message: string,
    public toolName: string,
    public operation: string,
    public input: unknown,
    public originalError?: Error
  );
}
```

### ContextError

Error type for context engineering failures.

```typescript
class ContextError extends Error {
  constructor(
    message: string,
    public contextType: 'construction' | 'compression' | 'extraction',
    public tokenLimit?: number,
    public actualTokens?: number
  );
}
```

## Configuration

### Agent Configuration Schema

```typescript
interface AgentConfiguration {
  modelTiers: {
    plan: ModelTier;
    migrate: ModelTier;
    lintFix: ModelTier;
    tsFix: ModelTier;
  };
  contextLimits: {
    maxTokens: number;
    compressionThreshold: number;
  };
  retryLimits: {
    maxRetries: number;
    backoffMultiplier: number;
  };
  toolTimeouts: {
    fileSystem: number;
    testExecution: number;
    lint: number;
    typeCheck: number;
    patch: number;
  };
}
```

### Model Tier Types

```typescript
type ModelTier = 'nano' | 'mini' | 'full';

interface ModelMapping {
  nano: 'gpt-4o-mini';
  mini: 'gpt-4o';
  full: 'gpt-4.1';
}
```

## Usage Examples

### Complete Workflow Example

```typescript
import { 
  CodingAgentFactory, 
  OpenAIAbstraction, 
  AgentWorkflow 
} from '@unshallow/agents';

// Setup
const config = new ConfigurationManager();
const openai = new OpenAIAbstraction(config, langfuseClient);
const fileSystem = new FileSystem();
const factory = new CodingAgentFactory(config, openai, fileSystem, '/project');

// Create workflow
const workflow = new AgentWorkflow(factory);

// Execute complete migration
const result = await workflow.execute('src/Component.test.tsx');

if (result.success) {
  console.log('Migration completed successfully');
  console.log(`Tests passing: ${result.testsPass}`);
  console.log(`Linting clean: ${result.lintingClean}`);
  console.log(`Types valid: ${result.typesValid}`);
} else {
  console.error('Migration failed:', result.error);
}
```

### Individual Agent Usage

```typescript
// Planning phase
const planningAgent = factory.createPlanningAgent();
const planResult = await planningAgent.invoke({
  testFile: 'src/Component.test.tsx',
  projectConfig: await config.loadProjectConfig()
});

// Migration phase
const migrationAgent = factory.createMigrationAgent();
const migrationResult = await migrationAgent.invoke({
  plan: planResult.plan,
  context: planResult.compressedContext,
  testFile: 'src/Component.test.tsx'
});

// Linting phase
const lintAgent = factory.createLintFixAgent();
const lintResult = await lintAgent.invoke({
  filePath: 'src/Component.test.tsx'
});

// TypeScript phase
const tsAgent = factory.createTypeScriptFixAgent();
const tsResult = await tsAgent.invoke({
  filePath: 'src/Component.test.tsx'
});
```

### Custom Tool Configuration

```typescript
// Create agent with custom tools
const customTools = [
  new FileSystemTool(fileSystem, '/project'),
  new TestExecutionTool(config),
  new CustomAnalysisTool(analysisConfig)
];

const customAgent = createReactAgent({
  llm: openai.getModel('migrate'),
  tools: customTools,
  stateModifier: CUSTOM_SYSTEM_PROMPT,
  responseFormat: CustomResultSchema
});
```

### Error Handling Example

```typescript
try {
  const result = await workflow.execute('problematic-test.tsx');
} catch (error) {
  if (error instanceof AgentError) {
    console.error(`Agent ${error.agentType} failed:`, error.message);
    console.log('Recovery hints:', error.recoveryHints);
    console.log('Retry count:', error.context.retryCount);
    
    // Attempt recovery
    if (error.context.retryCount < 3) {
      // Retry with modified context or different approach
    }
  }
}
```

### Context Engineering Example

```typescript
// Build optimized context for planning
const context = ContextBuilder.buildPlanningContext(
  testFileContent,
  projectConfig,
  {
    maxTokens: 4000,
    includeProjectPatterns: true,
    compressionLevel: 'light'
  }
);

// Compress context for handoff
const compressedContext = ContextBuilder.compressContext(
  fullInvestigationContext,
  1000, // Max tokens for migration agent
  ['enzyme patterns', 'critical dependencies'] // Preserve these
);
```

This API reference provides comprehensive documentation for integrating and extending the coding agents system, enabling developers to create sophisticated code migration workflows with intelligent reasoning and tool execution capabilities.