# Migration Workflow Implementation Plan

## Overview

This document outlines a phased implementation approach for the migration workflow system, building incrementally from a basic CLI through each workflow phase. Each phase implements only the necessary components for that specific step, allowing for iterative development and testing.

## Implementation Strategy

### Approach
- **Incremental Development**: Each phase builds on the previous one
- **Minimal Implementation**: Only implement what's needed for current phase
- **Early Testing**: Each phase can be tested independently
- **State Evolution**: State structure grows with each phase

### Dependencies
- Existing modules: Configuration, File System, Git Management, Patch-Diff
- LangChain/LangGraph for agents and workflow orchestration
- OpenAI API for ReAct agents

## Phase 1: Basic CLI + Research

### Objective
Create a minimal CLI that can research a test file and generate comprehensive research context.

### Components to Implement

#### Core Infrastructure
```
src/core/workflow/
├── types.ts                    # Basic workflow types
├── WorkflowEngine.ts          # Minimal LangGraph setup
├── common/
│   ├── state/
│   │   └── types.ts           # Research-focused state types
│   └── toolkits/
│       └── base.ts            # Base tools only
└── tools/                     # Research + base tools
    ├── globTool.ts
    ├── grepTool.ts
    ├── readFileTool.ts
    ├── readFilesTool.ts
    ├── lsTool.ts
    ├── getDependencyTreeTool.ts
    └── writeToScratchpadTool.ts
```

#### Phase 1 State
```typescript
interface Phase1WorkflowState {
  // File Information
  testFilePath: string;
  originalTestContent: string;
  componentFilePath?: string;
  
  // Research Context
  researchContext: ResearchContext;
  
  // Execution
  currentStep: WorkflowStep; // Only RESEARCH, COMPLETED
  
  // Configuration
  config: WorkflowConfig;
}
```

#### Research Domain
```
src/core/workflow/research/
├── ResearchNode.ts        # LangGraph node implementation
├── ResearchAgent.ts       # ReAct agent with research tools
├── toolkit.ts             # Research toolkit function
├── prompts.ts             # Research agent prompt
└── types.ts               # Research-specific types
```

#### Tools Implementation Priority
1. **Base Tools**: `glob`, `grep`, `readFile`, `readFiles`, `ls`
2. **Research Tools**: `getDependencyTree`, `writeToScratchpad`

#### CLI Interface
```typescript
// Basic CLI command
unshallow research <test-file-path>

// Output: Detailed research context displayed and saved
```

### Implementation Tasks
1. ✅ Create minimal WorkflowEngine with single Research node
2. ✅ Implement base tools with path resolution
3. ✅ Implement research-specific tools
4. ✅ Create ResearchAgent with ReAct pattern
5. ✅ Write research prompts focusing on dependency analysis
6. ✅ Build CLI command to trigger research phase
7. ✅ Test with sample test files

### Success Criteria
- CLI can analyze any test file and generate comprehensive research context
- Research context includes dependency tree, mock requirements, and example patterns
- State is properly saved and can be inspected
- All tools work with relative path resolution

---

## Phase 2: Planning

### Objective
Add planning capability that analyzes research context and creates migration plans for each test.

### New Components

#### Updated State
```typescript
interface Phase2WorkflowState extends Phase1WorkflowState {
  // Planning
  testPlans: TestPlan[];
  
  // Updated execution
  currentStep: WorkflowStep; // RESEARCH, PLANNING, COMPLETED
}
```

#### Planning Domain
```
src/core/workflow/planning/
├── PlanningNode.ts        # LangGraph node for planning
├── PlanningAgent.ts       # ReAct agent for test planning
├── toolkit.ts             # Planning toolkit function
├── prompts.ts             # Planning agent prompt
└── types.ts               # Planning-specific types
```

#### New Tools
```
src/core/workflow/tools/
├── addTestPlanTool.ts
└── addMultipleTestPlansTool.ts
```

#### Updated Workflow Engine
- Add PlanningNode to graph
- Add edge from Research to Planning
- Handle state transitions

### Implementation Tasks
1. ✅ Extend WorkflowState with testPlans
2. ✅ Implement test plan tools with ToolMessage feedback
3. ✅ Create PlanningAgent with planning-focused ReAct prompt
4. ✅ Update WorkflowEngine to include Planning node
5. ✅ Test research → planning flow

### CLI Updates
```typescript
// Extended CLI commands
unshallow research <test-file-path>    # Phase 1 only
unshallow plan <test-file-path>        # Phase 1 + 2
```

### Success Criteria
- Can generate detailed test plans for each test in the file
- Plans correctly identify tests to migrate, delete, keep, or add
- Gherkin-style plans are generated for migrate/add actions
- Planning agent makes informed decisions based on research context

---

## Phase 3: Migration + Fix

### Objective
Implement the core migration functionality with test execution and fixing capabilities.

### New Components

#### Updated State
```typescript
interface Phase3WorkflowState extends Phase2WorkflowState {
  // Execution
  currentStep: WorkflowStep; // RESEARCH, PLANNING, MIGRATE, COMPLETED
  successfulPatches: number;
  startingNode?: 'migrate' | 'linter' | 'typescript'; // For conditional starting
  
  // Error Tracking
  errors: ErrorTracker;
  
  // Exit State
  exitState: WorkflowExitState;
}
```

#### Migration Domain
```
src/core/workflow/migrate/
├── MigrateNode.ts         # LangGraph node for migration
├── MigrateAgent.ts        # ReAct agent for test migration
├── toolkit.ts             # Migration toolkit function
├── prompts.ts             # Migration agent prompt
└── types.ts               # Migration-specific types
```

#### New Tools
```
src/core/workflow/tools/
├── writeOnTestFileTool.ts
└── runTestFileTool.ts
```

#### Error Tracking System
```
src/core/workflow/common/state/
├── ErrorTracker.ts        # Error tracking logic
└── types.ts               # Error tracking types
```

### Implementation Tasks
1. ✅ Implement patch application tool with patch-diff integration
2. ✅ Implement test execution tool with Jest/test runner integration
3. ✅ Create error tracking system for retry logic
4. ✅ Build MigrateAgent with sophisticated migration prompts
5. ✅ Implement retry logic within agent loop
6. ✅ Add exit state tracking for success/failure
7. ✅ Update WorkflowEngine with migration node and retry edges

### CLI Updates
```typescript
unshallow migrate <test-file-path>     # Full research → planning → migration
```

### Success Criteria
- Can successfully migrate Enzyme tests to React Testing Library
- Handles test failures with intelligent retry logic
- Applies patches correctly using patch-diff system
- Tracks errors and prevents infinite retry loops
- Marks workflow as succeeded/failed appropriately

---

## Phase 4: Lint + Fix

### Objective
Add linting capabilities with auto-fix and manual error correction.

### New Components

#### Updated State
```typescript
interface Phase4WorkflowState extends Phase3WorkflowState {
  currentStep: WorkflowStep; // + LINT
}
```

#### Linter Domain
```
src/core/workflow/linter/
├── LinterNode.ts          # LangGraph node for linting
├── LinterAgent.ts         # ReAct agent for lint fixing
├── toolkit.ts             # Linter toolkit function
├── prompts.ts             # Linter agent prompt
└── types.ts               # Linter-specific types
```

#### New Tools
```
src/core/workflow/tools/
├── lintAutoFixTool.ts
└── runLintCheckTool.ts
```

### Implementation Tasks
1. ✅ Implement lint auto-fix tool
2. ✅ Implement lint check tool with detailed error reporting
3. ✅ Create LinterAgent focused on code quality fixes
4. ✅ Add linter node to workflow after migration
5. ✅ Extend error tracking for lint-specific errors
6. ✅ Test lint fixes don't break functionality

### CLI Updates
```typescript
unshallow lint <test-file-path>        # Complete workflow through linting
```

### Success Criteria
- Automatically fixes common linting issues
- Manually fixes remaining lint errors
- Preserves test functionality during lint fixes
- Integrates seamlessly with existing workflow

---

## Phase 5: TypeScript + Fix

### Objective
Complete the workflow with TypeScript error checking and resolution.

### New Components

#### Final State
```typescript
interface FinalWorkflowState extends Phase4WorkflowState {
  currentStep: WorkflowStep; // + TYPESCRIPT, COMPLETED
}
```

#### TypeScript Domain
```
src/core/workflow/typescript/
├── TypeScriptNode.ts      # LangGraph node for TS checking
├── TypeScriptAgent.ts     # ReAct agent for type fixing
├── toolkit.ts             # TypeScript toolkit function
├── prompts.ts             # TypeScript agent prompt
└── types.ts               # TypeScript-specific types
```

#### New Tools
```
src/core/workflow/tools/
└── runTsCheckTool.ts
```

### Implementation Tasks
1. ✅ Implement TypeScript check tool
2. ✅ Create TypeScriptAgent focused on type safety
3. ✅ Add TypeScript node as final step
4. ✅ Complete workflow orchestration
5. ✅ Implement final success/failure determination
6. ✅ Add comprehensive workflow summary generation

### Final CLI
```typescript
unshallow migrate <test-file-path>     # Complete end-to-end workflow
```

### Success Criteria
- Resolves all TypeScript compilation errors
- Maintains type safety in migrated tests
- Completes full workflow with comprehensive summary
- Handles edge cases and provides clear error messages

---

## Cross-Phase Implementation Details

### State Management Strategy

#### Phase Evolution
```typescript
// Phase 1: Research only
interface Phase1State { research, basic execution }

// Phase 2: + Planning
interface Phase2State extends Phase1State { testPlans }

// Phase 3: + Migration
interface Phase3State extends Phase2State { patches, errors, exitState }

// Phase 4: + Linting
interface Phase4State extends Phase3State { /* lint errors in ErrorTracker */ }

// Phase 5: Complete
interface FinalState extends Phase4State { /* all workflow steps */ }
```

#### State Persistence
- Save state after workflow completion
- Focus on successful end-to-end execution
- Simple state structure for current phase

### Workflow Engine Evolution

#### Phase 1: Linear Research
```typescript
const graph = new StateGraph(Phase1State)
  .addNode("research", researchNode)
  .addEdge("__start__", "research")
  .addEdge("research", "__end__");
```

#### Phase 2: Research → Planning
```typescript
const graph = new StateGraph(Phase2State)
  .addNode("research", researchNode)
  .addNode("planning", planningNode)
  .addEdge("__start__", "research")
  .addEdge("research", "planning")
  .addEdge("planning", "__end__");
```

#### Phase 3: + Migration
```typescript
const graph = new StateGraph(Phase3State)
  .addNode("research", researchNode)
  .addNode("planning", planningNode)
  .addNode("migrate", migrateNode)
  .addConditionalEdges("__start__", determineStartingNode, {
    research: "research",
    migrate: "migrate"
  })
  .addEdge("research", "planning")
  .addEdge("planning", "migrate")
  .addEdge("migrate", "__end__");
```

#### Final: Complete Workflow
```typescript
const graph = new StateGraph(FinalState)
  .addNode("research", researchNode)
  .addNode("planning", planningNode)
  .addNode("migrate", migrateNode)
  .addNode("linter", linterNode)
  .addNode("typescript", typescriptNode)
  .addConditionalEdges("__start__", determineStartingNode, {
    research: "research",
    migrate: "migrate",
    linter: "linter", 
    typescript: "typescript"
  })
  .addEdge("research", "planning")
  .addEdge("planning", "migrate")
  .addEdge("migrate", "linter")
  .addEdge("linter", "typescript")
  .addEdge("typescript", "__end__");

// Conditional edge function
function determineStartingNode(state: WorkflowState): string {
  if (state.startingNode) {
    // Validate that state has required fields for starting node
    switch (state.startingNode) {
      case 'migrate':
        return state.testPlans?.length > 0 ? 'migrate' : 'research';
      case 'linter':
        return state.successfulPatches > 0 ? 'linter' : 'research';
      case 'typescript':
        return state.exitState?.status === 'running' ? 'typescript' : 'research';
      default:
        return 'research';
    }
  }
  return 'research';
}
```

### Tool Implementation Strategy

#### Incremental Tool Development
1. **Phase 1**: Base tools + research tools
2. **Phase 2**: + planning tools
3. **Phase 3**: + migration tools + error tracking
4. **Phase 4**: + linter tools
5. **Phase 5**: + typescript tools

#### Shared Tool Architecture
- All tools implemented from the start in `/tools` directory
- Tools imported by phase-specific toolkits as needed
- Consistent ToolMessage feedback pattern across all tools

### Testing Strategy

#### Per-Phase Testing
1. **Unit Tests**: Individual tools and agents
2. **Integration Tests**: Node-level workflow testing
3. **End-to-End Tests**: Complete phase workflow
4. **State Tests**: State transitions and persistence

#### Test File Progression
- Start with simple Enzyme test files
- Progress to complex components with multiple dependencies
- Test edge cases and error scenarios
- Validate against real-world test migration scenarios