# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Unshallow is a CLI tool for migrating Enzyme tests to React Testing Library using LangGraph workflows and OpenAI LLMs. The project implements a sophisticated state machine with intelligent retry mechanisms and parallel processing capabilities.

## Core Development Commands

### Building and Development
```bash
# Install dependencies
yarn install

# Build the TypeScript project
yarn build

# Watch mode for development
yarn dev

# Link for global usage
yarn link
```

### Testing and Validation
```bash
# Run full test suite (prettier, xo linting, ava tests)
yarn test

# Individual commands used internally:
# - Prettier check
# - XO linting
# - AVA tests
```

## Architecture Overview

### Entry Points
- **CLI** (`source/cli.tsx`): Main command-line interface using Commander.js
- **App** (`source/app.tsx`): Currently a placeholder React component (not integrated)

### Core Components

1. **Commands** (`source/commands/`)
   - `migrate.ts`: Main migration handler supporting single and multiple file processing
   - `config.ts`: Configuration management commands
   - `context-enricher.ts`: Context analysis command
   - `set-langfuse-config.ts`: Langfuse integration setup
   - `test-lint.ts`: Test linting utilities

2. **Context Enricher** (`source/context-enricher/`)
   - Analyzes TypeScript/JavaScript files using AST
   - Extracts component information and dependencies
   - Provides enriched context for better migration results

3. **LangGraph Workflow** (`source/langgraph-workflow/`)
   - Implements state machine for migration process
   - Handles planning, execution, validation, and error recovery

### Workflow Nodes

The actual workflow includes these nodes:
- `plan-rtl-conversion`: Creates Gherkin-style conversion plan
- `execute-rtl-conversion`: Implements the conversion plan
- `run-test`: Executes tests to validate migration
- `parallel-extraction`: Extracts errors and accessibility info in parallel
- `analyze-test-errors`: Analyzes test failures
- `analyze-failure`: Deep analysis of specific failures
- `execute-rtl-fix`: Applies fixes based on analysis
- `ts-validation`: TypeScript type checking
- `fix-ts-error`: Fixes TypeScript errors
- `lint-check`: ESLint validation
- `fix-lint-error`: Fixes linting issues

### State Management

The workflow maintains comprehensive state:
```typescript
interface WorkflowState {
  file: {
    path: string
    content: string
    originalTest: string
    rtlTest?: string
    status: 'pending' | 'in-progress' | 'success' | 'failed'
    currentStep: WorkflowStep
    context: EnrichedContext
    retries: { rtl: number; test: number; ts: number; lint: number }
    // Error tracking and fix history
  }
}
```

## Key Features

### Parallel Migration
- Discovers test files matching patterns
- Processes multiple files concurrently
- Configurable concurrency levels
- Generates meta-reports for failure analysis

### Retry Mechanism
- Saves failed attempts in `.unshallow` directories
- Can resume from previous attempts with `--retry` flag
- Maintains fix history to avoid repeating failed approaches

### Model Configuration
- Uses different OpenAI models for different tasks
- Configurable via command-line flags:
  - `--reasoning`: Enhanced reasoning for all phases
  - `--reasoning-planning`: Enhanced planning only
  - `--reasoning-execution`: Enhanced execution only
  - `--reasoning-reflection`: Enhanced reflection only

### Error Recovery
- Iterative fixing with intelligent analysis
- Extracts specific error information
- Generates targeted fixes based on error patterns
- Configurable retry limits

## Configuration

### API Keys
```bash
# Set OpenAI API key
unshallow config:set-api-key YOUR_API_KEY

# Configure Langfuse (optional)
unshallow config:set-langfuse-config '{"publicKey":"...", "secretKey":"...", "host":"..."}'
```

### Configuration Storage
- User config: `~/.unshallow/config.json`
- Default context: `~/.unshallow/context.md`
- Test artifacts: `.unshallow/[component-name]/`

## Command-Line Interface

### Migration Command
```bash
# Single file migration
unshallow migrate path/to/test.tsx

# Multiple files with options
unshallow migrate src/ --pattern="**/*.test.tsx" --concurrency=5

# Retry failed migration
unshallow migrate path/to/test.tsx --retry

# Skip validation steps
unshallow migrate path/to/test.tsx --skip-ts-check --skip-lint-check
```

### Context Enrichment
```bash
# Analyze component context
unshallow context-enricher path/to/component.tsx --import-depth=2
```

## Development Guidelines

### Adding New Workflow Nodes
1. Create node in `source/langgraph-workflow/nodes/`
2. Accept `WorkflowState` as input
3. Return updated state
4. Add to workflow graph in `index.ts`
5. Update `WorkflowStep` enum if needed

### Modifying Prompts
- Prompts are in `source/langgraph-workflow/prompts/`
- Follow existing structure with clear sections
- Include relevant context and examples
- Handle retry scenarios with escalating strategies

### File System Operations
- `TestFileSystem`: Manages test directories and attempts
- `ArtifactFileSystem`: Handles logs and migration results
- Always use absolute paths
- Clean up on success, preserve on failure

## Important Patterns

### Error Handling
- Each node properly catches and propagates errors
- Detailed logging throughout the process
- Failed migrations preserve state for debugging

### LLM Integration
- Structured prompts with consistent formatting
- Context injection for better results
- Token usage tracking via Langfuse (optional)

### Testing Patterns
- AVA test framework with TypeScript support
- Tests use ESM modules
- Located alongside source files or in test directories

## Debugging

### Logs and Artifacts
- Logs: `.unshallow/[component]/logs.txt`
- Failed attempts: `.unshallow/[component]/attempt.tsx`
- Meta reports: `.unshallow/meta-report-[timestamp].md`

### Common Issues
1. **API Key**: Ensure OpenAI key is configured
2. **Commands**: Verify lint/test commands match your project
3. **Patterns**: Check file patterns for test discovery
4. **Dependencies**: Ensure all required packages are installed

## Extension Points

1. **New Commands**: Add to `source/commands/` and register in CLI
2. **Custom Validators**: Extend validation nodes
3. **Alternative LLMs**: Modify OpenAI client usage
4. **Custom Prompts**: Override default prompts via context