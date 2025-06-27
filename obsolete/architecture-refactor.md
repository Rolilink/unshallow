# Architecture Refactor Plan - Unshallow Migration Tool

## Executive Summary

This document outlines a comprehensive refactor plan for the Unshallow migration tool, transforming it from a CLI-only tool with temporary file management to a modern, web-enabled application with:

- **Single `migrate` command** that reads context from `UNSHALLOW.md` at project root
- **Git-based state management** for proper versioning and collaboration
- **Domain-driven design** for better maintainability and understanding
- **Worker-to-UI communication architecture** for real-time monitoring
- **Robust queueing** for reliable large-scale operations

## Current Architecture Analysis

### Existing Structure Overview

The current codebase follows a layered architecture with clear separation between CLI, commands, workflow orchestration, and utilities. The core LangGraph workflow manages 14 specialized nodes handling planning, execution, validation, and error recovery phases.

**Key Components:**

- **CLI Layer**: Commander.js-based interface with modular command registration
- **Command Layer**: Migration, configuration, and utility commands
- **Workflow Layer**: LangGraph state machine with 14 specialized nodes
- **Utility Layer**: File system management, context enrichment, and OpenAI integration

**Current State Management:**

- Immutable state updates with comprehensive retry tracking
- `.unshallow` temporary directories for migration artifacts
- Atomic file operations with backup strategies
- Error accumulation and fix attempt history

## Proposed Architecture Refactor

### 1. Domain-Driven Design (DDD) Folder Structure

#### Current Problem

The existing structure mixes technical concerns (nodes, prompts, utils) without clear domain boundaries, making it difficult to understand business logic and maintain related functionality.

#### Proposed DDD Structure

```text
source/
├── shared/                           # Shared kernel
│   ├── types/                       # Common types and interfaces
│   ├── utils/                       # Cross-domain utilities
│   └── config/                      # Configuration management
│
├── domains/
│   ├── planning/                    # Migration planning domain
│   │   ├── domain/                  # Domain logic
│   │   │   ├── entities/           # Plan, ConversionStep
│   │   │   ├── services/           # PlanningService
│   │   │   └── repositories/       # PlanRepository
│   │   ├── infrastructure/         # Implementation details
│   │   │   ├── ai/                 # OpenAI integration
│   │   │   │   ├── prompts/        # Planning prompts
│   │   │   │   └── clients/        # AI client adapters
│   │   │   └── persistence/        # File/Git storage
│   │   ├── application/            # Application services
│   │   │   ├── use-cases/          # CreatePlan, ValidatePlan
│   │   │   └── handlers/           # Command/Query handlers
│   │   └── presentation/           # External interfaces
│   │       ├── nodes/              # LangGraph nodes
│   │       └── api/                # REST/GraphQL endpoints
│   │
│   ├── migration/                  # Code transformation domain
│   │   ├── domain/
│   │   │   ├── entities/           # Migration, TestFile, ConversionResult
│   │   │   ├── services/           # MigrationService, TransformationService
│   │   │   └── value-objects/      # FilePath, TestContent
│   │   ├── infrastructure/
│   │   │   ├── ai/
│   │   │   │   ├── prompts/        # Migration prompts
│   │   │   │   └── clients/        # Specialized AI clients
│   │   │   ├── transformers/       # AST transformation logic
│   │   │   └── validators/         # Migration validation
│   │   ├── application/
│   │   │   ├── use-cases/          # ExecuteMigration, ValidateConversion
│   │   │   └── workflows/          # Migration orchestration
│   │   └── presentation/
│   │       ├── nodes/              # Execute nodes
│   │       └── api/                # Migration endpoints
│   │
│   ├── validation/                 # Testing and validation domain
│   │   ├── domain/
│   │   │   ├── entities/           # TestResult, ValidationError
│   │   │   ├── services/           # TestRunner, ValidationService
│   │   │   └── specifications/     # Validation rules
│   │   ├── infrastructure/
│   │   │   ├── runners/            # Jest, TypeScript, ESLint runners
│   │   │   ├── parsers/            # Error parsers
│   │   │   └── reporters/          # Result formatters
│   │   ├── application/
│   │   │   ├── use-cases/          # RunTests, ValidateTypes
│   │   │   └── strategies/         # Validation strategies
│   │   └── presentation/
│   │       ├── nodes/              # Validation nodes
│   │       └── api/                # Validation endpoints
│   │
│   ├── fixing/                     # Error resolution domain
│   │   ├── domain/
│   │   │   ├── entities/           # FixAttempt, ErrorAnalysis
│   │   │   ├── services/           # FixService, AnalysisService
│   │   │   └── strategies/         # Fix strategies
│   │   ├── infrastructure/
│   │   │   ├── ai/
│   │   │   │   ├── prompts/        # Fix prompts
│   │   │   │   └── analyzers/      # Error analyzers
│   │   │   └── appliers/           # Fix application logic
│   │   ├── application/
│   │   │   ├── use-cases/          # AnalyzeError, ApplyFix
│   │   │   └── workflows/          # Fix orchestration
│   │   └── presentation/
│   │       ├── nodes/              # Fix nodes
│   │       └── api/                # Fix endpoints
│   │
│   └── orchestration/              # Workflow orchestration domain
│       ├── domain/
│       │   ├── entities/           # WorkflowRun, JobQueue
│       │   ├── services/           # OrchestrationService
│       │   └── state-machine/      # Workflow state management
│       ├── infrastructure/
│       │   ├── langgraph/          # LangGraph integration
│       │   ├── queues/             # Queue implementations
│       │   └── git/                # Git integration
│       ├── application/
│       │   ├── use-cases/          # StartMigration, MonitorProgress
│       │   └── coordinators/       # Cross-domain coordination
│       └── presentation/
│           ├── workflows/          # Complete workflows
│           └── api/                # Orchestration endpoints
│
├── infrastructure/                 # Cross-cutting infrastructure
│   ├── cli/                       # Command-line interface
│   ├── web/                       # Web server and UI
│   ├── git/                       # Git integration layer
│   ├── queues/                    # Queue management
│   ├── logging/                   # Logging infrastructure
│   └── monitoring/                # Observability
│
└── application/                   # Application coordination
    ├── services/                  # Application services
    ├── handlers/                  # Cross-domain handlers
    └── facades/                   # Simplified interfaces
```

#### Benefits of DDD Structure

- **Domain Clarity**: Each domain encapsulates related business logic
- **Maintainability**: Changes within a domain don't affect others
- **Testability**: Clear boundaries enable focused unit testing
- **Scalability**: Teams can work on different domains independently
- **Understanding**: Business logic is clearly separated from technical concerns

### 2. Git-Based State Management

#### Current Problem

The `.unshallow` temporary directory approach creates cleanup complexity, lacks proper versioning, and doesn't integrate well with existing developer workflows.

#### Proposed Git-Based Approach

**Git Worktree Integration:**

```typescript
interface GitStateManager {
  // Create isolated workspace for migration
  createMigrationWorkspace(taskId: string): Promise<WorkspaceInfo>;
  
  // Commit incremental progress
  commitProgress(taskId: string, phase: MigrationPhase, changes: FileChanges): Promise<CommitInfo>;
  
  // Create branches for different attempt strategies
  createAttemptBranch(taskId: string, attemptId: string): Promise<BranchInfo>;
  
  // Merge successful migrations back to main branch
  mergeMigration(taskId: string): Promise<MergeResult>;
  
  // Clean up failed attempts
  cleanupFailedAttempts(taskId: string): Promise<void>;
}
```

**Migration State in Git:**

```text
project/
├── .git/
├── .migration-workspace/          # Git worktree for migrations
│   ├── task-12345/               # Task-specific workspace
│   │   ├── planning/             # Planning phase commit
│   │   ├── migration/            # Migration phase commit
│   │   ├── fixing-attempt-1/     # First fix attempt branch
│   │   ├── fixing-attempt-2/     # Second fix attempt branch
│   │   └── final/                # Successful result
│   └── queue-state/              # Queue persistence in git
│       ├── pending-jobs.json
│       ├── active-jobs.json
│       └── completed-jobs.json
```

**Implementation Strategy:**

```typescript
class GitWorkflowStateManager {
  async initializeMigration(filePath: string): Promise<MigrationContext> {
    const taskId = generateTaskId();
    const workspace = await this.git.createWorktree(`migration-${taskId}`);
    
    // Initialize migration branch
    await workspace.createBranch(`migration/${taskId}/main`);
    await workspace.checkout(`migration/${taskId}/main`);
    
    return { taskId, workspace, initialCommit: workspace.currentCommit };
  }
  
  async commitPhase(context: MigrationContext, phase: string, changes: FileChanges) {
    await context.workspace.add(changes.files);
    const commit = await context.workspace.commit(`${phase}: ${changes.summary}`);
    
    // Tag important milestones
    if (phase === 'planning-complete' || phase === 'migration-success') {
      await context.workspace.tag(`${context.taskId}-${phase}`, commit);
    }
    
    return commit;
  }
  
  async createFixAttempt(context: MigrationContext, errorType: string): Promise<FixContext> {
    const attemptBranch = `migration/${context.taskId}/fix-${errorType}-${Date.now()}`;
    await context.workspace.createBranch(attemptBranch);
    await context.workspace.checkout(attemptBranch);
    
    return { ...context, fixBranch: attemptBranch };
  }
}
```

**Benefits:**

- **Version Control**: Complete migration history with branching strategies
- **Rollback Capability**: Easy reversion to any point in migration process
- **Collaboration**: Multiple developers can review migration attempts
- **Integration**: Seamless integration with existing Git workflows
- **Persistence**: No temporary directories to clean up
- **Audit Trail**: Complete history of what was attempted and why

### 3. Simplified CLI with UNSHALLOW.md Context

#### Current Problem

Multiple CLI commands create complexity and require separate configuration management. Single file migrations and manual retry handling add unnecessary complexity to the user experience.

#### Proposed Single Command Architecture

**UNSHALLOW.md Configuration:**

```markdown
# Unshallow Migration Configuration

## Project Context
- **Framework**: React with TypeScript
- **Testing Library**: Jest + Enzyme (migrating to RTL)
- **Component Patterns**: Functional components with hooks
- **State Management**: Redux Toolkit

## Migration Settings
```toml
[migration]
concurrency = 3
skip_ts_check = false
skip_lint_check = false
reasoning_planning = true
reasoning_execution = false

[retries]
max_retries = 20                    # Global retry limit for all fix types
max_error_attempts = 5              # Attempts per individual test error
rtl_retries = 8                     # RTL conversion retries
ts_retries = 8                      # TypeScript fix retries  
lint_retries = 8                    # ESLint fix retries

[commands]
test = "npm test"
lint_check = "npm run lint"
lint_fix = "npm run lint:fix"
ts_check = "npm run type-check"

[patterns]
test_files = "**/*.test.{ts,tsx}"
ignore_patterns = ["node_modules/**", "build/**"]
```

## Component Context
- Common import patterns and utilities
- Custom hooks and context providers
- Shared test utilities and mocks
```

**Simplified CLI Interface:**

```bash
# Single command - always opens web UI, reads UNSHALLOW.md for all configuration
unshallow migrate [directory]

# Examples:
unshallow migrate                    # Migrate all test files in project
unshallow migrate src/components/    # Migrate specific directory
```

### 4. Worker-to-UI Communication Architecture

#### Current Problem

The CLI-only interface limits visibility into complex multi-file migrations and provides no way to monitor or intervene in long-running processes.

#### Proposed Real-Time Communication System

**Event-Driven Architecture:**

```typescript
// Core event system for worker-to-UI communication
interface MigrationEventSystem {
  // Event emitter for worker processes
  emit(event: MigrationEvent): void;
  
  // Event subscription for UI updates
  subscribe(eventType: string, handler: EventHandler): UnsubscribeFn;
  
  // Broadcast to all connected clients
  broadcast(event: MigrationEvent): void;
}

// Migration event types
type MigrationEvent = 
  | { type: 'job-queued'; payload: QueuedJobEvent }
  | { type: 'job-started'; payload: JobStartedEvent }
  | { type: 'phase-changed'; payload: PhaseChangeEvent }
  | { type: 'progress-updated'; payload: ProgressEvent }
  | { type: 'error-encountered'; payload: ErrorEvent }
  | { type: 'fix-applied'; payload: FixAppliedEvent }
  | { type: 'job-completed'; payload: JobCompletedEvent }
  | { type: 'git-commit'; payload: GitCommitEvent };
```

**Worker Process Integration:**

```typescript
// Enhanced LangGraph nodes with event emission
class EventAwareMigrationNode {
  constructor(
    private eventSystem: MigrationEventSystem,
    private nodeId: string
  ) {}
  
  async execute(state: WorkflowState): Promise<WorkflowState> {
    // Emit phase start
    this.eventSystem.emit({
      type: 'phase-changed',
      payload: {
        jobId: state.id,
        phase: this.nodeId,
        status: 'started',
        timestamp: new Date()
      }
    });
    
    try {
      // Execute node logic with progress updates
      const result = await this.processWithProgress(state);
      
      // Emit success
      this.eventSystem.emit({
        type: 'phase-changed',
        payload: {
          jobId: state.id,
          phase: this.nodeId,
          status: 'completed',
          result: result.summary,
          timestamp: new Date()
        }
      });
      
      return result;
    } catch (error) {
      // Emit error
      this.eventSystem.emit({
        type: 'error-encountered',
        payload: {
          jobId: state.id,
          phase: this.nodeId,
          error: error.message,
          context: error.context,
          timestamp: new Date()
        }
      });
      
      throw error;
    }
  }
  
  private async processWithProgress(state: WorkflowState): Promise<WorkflowState> {
    // Emit granular progress updates
    const steps = this.getProcessingSteps();
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      this.eventSystem.emit({
        type: 'progress-updated',
        payload: {
          jobId: state.id,
          phase: this.nodeId,
          step: step.name,
          progress: (i / steps.length) * 100,
          message: step.description,
          timestamp: new Date()
        }
      });
      
      await step.execute(state);
    }
    
    return state;
  }
}
```

**Real-Time Communication Layer:**

```typescript
// WebSocket-based real-time updates
class WebSocketEventBridge {
  constructor(
    private eventSystem: MigrationEventSystem,
    private socketServer: SocketIO.Server
  ) {
    this.setupEventForwarding();
  }
  
  private setupEventForwarding() {
    // Forward all migration events to connected clients
    this.eventSystem.subscribe('*', (event) => {
      this.socketServer.emit('migration-event', event);
    });
    
    // Handle client subscriptions
    this.socketServer.on('connection', (socket) => {
      socket.on('subscribe-to-job', (jobId: string) => {
        socket.join(`job-${jobId}`);
      });
      
      socket.on('pause-job', (jobId: string) => {
        this.eventSystem.emit({
          type: 'job-control',
          payload: { jobId, action: 'pause' }
        });
      });
    });
  }
}

// Queue integration for job lifecycle events
class QueueEventIntegration {
  constructor(
    private queue: MigrationQueue,
    private eventSystem: MigrationEventSystem
  ) {
    this.setupQueueEventHandlers();
  }
  
  private setupQueueEventHandlers() {
    this.queue.on('job-added', (job) => {
      this.eventSystem.emit({
        type: 'job-queued',
        payload: {
          jobId: job.id,
          filePath: job.filePath,
          priority: job.priority,
          estimatedDuration: job.estimatedDuration,
          timestamp: new Date()
        }
      });
    });
    
    this.queue.on('job-started', (job) => {
      this.eventSystem.emit({
        type: 'job-started',
        payload: {
          jobId: job.id,
          workerId: job.workerId,
          startedAt: new Date()
        }
      });
    });
  }
}
```

**UI Communication Interface:**

```typescript
// Client-side event handling
class MigrationMonitor {
  constructor(private socketUrl: string) {
    this.socket = io(socketUrl);
    this.setupEventHandlers();
  }
  
  subscribeToJob(jobId: string, callbacks: JobEventCallbacks) {
    this.socket.emit('subscribe-to-job', jobId);
    
    this.socket.on('migration-event', (event: MigrationEvent) => {
      if (event.payload.jobId === jobId) {
        switch (event.type) {
          case 'phase-changed':
            callbacks.onPhaseChange?.(event.payload);
            break;
          case 'progress-updated':
            callbacks.onProgress?.(event.payload);
            break;
          case 'error-encountered':
            callbacks.onError?.(event.payload);
            break;
          case 'job-completed':
            callbacks.onComplete?.(event.payload);
            break;
        }
      }
    });
  }
  
  // Job control methods
  pauseJob(jobId: string) {
    this.socket.emit('pause-job', jobId);
  }
  
  resumeJob(jobId: string) {
    this.socket.emit('resume-job', jobId);
  }
  
  retryJob(jobId: string, fromPhase?: string) {
    this.socket.emit('retry-job', { jobId, fromPhase });
  }
}
```

**Benefits of Worker-to-UI Communication:**

- **Real-time Updates**: Instant feedback on migration progress
- **Granular Visibility**: Step-by-step progress within each phase
- **Error Context**: Immediate error details with fix suggestions
- **Interactive Control**: Pause, resume, retry operations from UI
- **Multi-job Monitoring**: Track multiple concurrent migrations
- **Historical Data**: Complete event log for post-mortem analysis

### 5. Enhanced Queue System with LevelDB

#### Current Problem

Direct file processing lacks proper queuing, monitoring, and recovery mechanisms for complex multi-file migrations.

#### Proposed Queue Architecture

**Queue System Selection:**

- **Primary**: level-jobs with LevelDB for simplicity and persistence
- **Enhanced**: BullMQ with Redis for web UI and advanced features

**Implementation Strategy:**

```typescript
// Phase 1: LevelDB-based Queue
class LevelDBMigrationQueue {
  constructor(private db: Level, private webSocket?: SocketIO.Server) {}
  
  async addMigration(filePath: string, options: MigrationOptions): Promise<JobId> {
    const job = {
      id: generateJobId(),
      filePath,
      options,
      status: 'pending',
      createdAt: new Date(),
      priority: options.priority || 'normal'
    };
    
    await this.jobs.push(job);
    this.webSocket?.emit('job-added', job);
    return job.id;
  }
  
  async processMigration(job: MigrationJob): Promise<MigrationResult> {
    this.webSocket?.emit('job-started', job);
    
    try {
      const gitStateManager = new GitWorkflowStateManager();
      const context = await gitStateManager.initializeMigration(job.filePath);
      
      const result = await this.runWorkflowWithGitIntegration(context, job.options);
      
      this.webSocket?.emit('job-completed', { job, result });
      return result;
    } catch (error) {
      this.webSocket?.emit('job-failed', { job, error });
      throw error;
    }
  }
}

// Phase 2: Enhanced BullMQ Integration
class BullMQMigrationQueue {
  constructor(private redisConfig: RedisConfig) {
    this.queue = new Queue('migration', { connection: redisConfig });
    this.setupWebDashboard();
  }
  
  private setupWebDashboard() {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');
    
    createBullBoard({
      queues: [new BullMQAdapter(this.queue)],
      serverAdapter
    });
  }
}
```

**Queue Job Structure:**

```typescript
interface MigrationJob {
  id: string;
  filePath: string;
  options: MigrationOptions;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'paused';
  priority: 'low' | 'normal' | 'high' | 'critical';
  progress: {
    phase: MigrationPhase;
    percentage: number;
    currentStep: string;
    estimatedTimeRemaining?: number;
  };
  attempts: JobAttempt[];
  gitContext?: GitMigrationContext;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}
```

**Benefits:**

- **Persistence**: Jobs survive application restarts
- **Monitoring**: Real-time progress tracking and web dashboard
- **Recovery**: Failed jobs can be retried with context
- **Scalability**: Support for high-concurrency migrations
- **Control**: Pause, resume, and cancel operations

## Implementation Roadmap

### Phase 1: Foundation (2-3 weeks)

1. **Setup DDD Structure**: Reorganize existing code into domain boundaries
2. **Git Integration**: Implement basic git worktree management
3. **Queue Foundation**: Implement level-jobs with basic persistence

### Phase 2: Core Features (3-4 weeks)

1. **Domain Services**: Implement core domain services and use cases
2. **Git Workflow**: Complete git branch/commit workflow integration
3. **Basic Web API**: Create REST API for migration management

### Phase 3: Web Interface (2-3 weeks)

1. **Event System**: Implement worker-to-UI communication architecture
2. **Real-time Updates**: Implement Socket.IO for live progress
3. **Queue Management**: Add job control and monitoring

### Phase 4: Enhancement (2-3 weeks)

1. **Advanced Queue**: Upgrade to BullMQ with Redis for advanced features
2. **Git Visualization**: Add git history and diff visualization
3. **Manual Intervention**: Build interface for manual fixes and overrides

### Phase 5: Polish & Production (1-2 weeks)

1. **Error Handling**: Comprehensive error recovery and user feedback
2. **Performance**: Optimize for large-scale migrations
3. **Documentation**: API documentation and user guides

## Migration Strategy

### Backward Compatibility

- Maintain existing CLI interface and behavior
- Gradual migration of internal architecture
- Feature flags for new functionality

### Risk Mitigation

- Implement changes incrementally with thorough testing
- Maintain parallel implementations during transition
- Comprehensive backup and rollback procedures

### Success Metrics

- **Performance**: Improved migration success rates and reduced retry cycles
- **Usability**: Better visibility and control over migration processes
- **Maintainability**: Clearer code organization and easier feature development
- **Scalability**: Support for larger codebases and concurrent operations

## Conclusion

This refactored architecture transforms Unshallow from a CLI-only tool to a comprehensive migration platform with:

- **Simplified single command interface** that always opens web UI with UNSHALLOW.md configuration
- **Git-based state management** for proper versioning and collaboration
- **Domain-driven organization** for better maintainability and understanding
- **Real-time worker-to-UI communication** for monitoring and intervention capabilities
- **Robust queueing** for reliable large-scale operations

The phased implementation approach ensures continuous functionality while gradually introducing advanced features, positioning Unshallow as a professional-grade migration tool suitable for enterprise-level projects.