# CLAUDE.md (Project Prompt)

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. This file is referred to as the "project prompt" throughout the development process.

## Project Overview

Unshallow is a CLI tool for migrating Enzyme tests to React Testing Library. The project is currently undergoing a **major architectural refactoring** from a CLI-only tool to a modern web-enabled application with real-time monitoring capabilities.

### Current Status

- ⚠️ **Breaking Migration in Progress**: Complete architectural overhaul
- 🚫 **No Backward Compatibility**: This is a personal tool - feel free to make breaking changes
- 🏗️ **New Architecture**: Moving to modular CLI, UI, Server separation
- 📁 **Legacy Code**: Existing implementation moved to `obsolete/` folder

## Architecture Overview

### Three-Module Structure

1. **CLI Module**: Single command interface with configuration file reading
2. **UI Module**: Empty (handled by external Vercel v0 project)
3. **Server Module**: Core business logic, workflow, task management, and API

### Technology Stack

- **Server Framework**: Hono.js (fast, lightweight, TypeScript-first)
- **Queue System**: LevelDB + better-queue for persistent task management
- **Workflow Engine**: LangGraph (existing workflow preserved and integrated)
- **AI Integration**: OpenAI GPT models with configurable tiers (nano, mini, full)
- **Git Integration**: Worktree-based isolation for migration tasks
- **Real-time Updates**: WebSocket communication with UI

### Key Technical Constraints

- **Ephemeral State**: All workflow state in-memory only (except git worktrees/branches)
- **Single File Updates**: Workflow can only modify the target file being migrated
- **Patch-based Updates**: Use GPT-4.1 diff generation and patch application
- **Worker Thread Processing**: Parallel migration execution

## Development Commands

### Core Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Development with watch mode
npm run dev

# Run tests
npm test

# Watch tests during development
npm run test:watch

# Linting
npm run lint
npm run lint:fix

# Code formatting
npm run format
npm run format:check

# Link for global testing
npm link
```

### Testing and Validation

Run these before requesting approval **only when code changes are made**:

```bash
npm run build  # Ensure TypeScript compiles
npm run lint   # Check code style
npm test       # Run all tests (only when changes affect test coverage)
```

**Skip validation for:**

- Documentation-only changes (\*.md files)
- Configuration file updates that don't affect code compilation
- Comment-only changes

#### Test Execution Guidelines

**Run tests only when:**

- Adding new code that requires test coverage
- Modifying existing code that has test coverage
- Changes that could affect existing functionality

**When tests fail:**

1. **Analyze the failure**: Understand why the test broke
2. **Identify root cause**: Determine if it's a legitimate bug or test needs updating
3. **Propose solution**: Suggest either code fix or test update with detailed reasoning
4. **Explain to developer**: Provide detailed explanation of:
   - What was broken and why
   - What decision you recommend (fix code vs update test)
   - Reasoning behind the recommendation
5. **Await approval**: Developer must approve the proposed solution before proceeding

**Never:**

- Automatically update tests without explanation
- Ignore test failures
- Make assumptions about intended behavior

## Configuration Files

### Project Configuration

- **UNSHALLOW.md**: Migration context, rules, and project-specific patterns (in target project)
- **unshallow.json**: API keys, model tiers, command configurations (in target project)
- **package.json**: Dependencies, scripts, and build configuration
- **tsconfig.json**: TypeScript compiler settings

### Development Tools

- **.eslintrc.cjs**: ESLint configuration for code quality
- **.prettierrc**: Code formatting rules
- **jest.config.js**: Test runner configuration

## Collaboration Workflow

### Three-Phase Development Cycle

Each feature implementation follows this structured approach:

#### Phase 1: Core Implementation

1. **Implement Feature**: Write the core functionality using subagents as needed
2. **Module Organization**: Follow proven patterns (types.ts, ModuleName.ts, index.ts)
3. **Quality Checks**: Run `npm run build`, `npm run lint`, and `npm test` if changes affect existing test coverage
4. **Test Failure Handling**: If tests fail, analyze and explain to developer before proceeding
5. **Request Approval**: "Ask the developer to test and approve commit and push"
6. **Autonomous Commit**: After approval, commit and push without additional approval

#### Phase 2: Testing

1. **Write Tests**: Create comprehensive unit and integration tests
   - Co-locate tests in `__tests__/` directories
   - Include one end-to-end integration scenario per module
   - Use `[integration]: describe` for integration tests
   - Target >80% coverage focusing on feature surface
2. **Quality Checks**: Run `npm run build`, `npm run lint`, `npm test`
3. **Test Failure Analysis**: If any tests fail, provide detailed analysis and recommendations
4. **Request Approval**: "Ask the developer to test and approve commit and push"
5. **Autonomous Commit**: After approval, commit and push without additional approval

#### Phase 3: Documentation

1. **Create Subsystem Documentation**: Write developer-focused docs in `docs/subsystems/`
   - **Introduction**: Non-technical TLDR with table of contents for navigation
   - **Purpose**: Why the subsystem exists and what problems it solves internally
   - **Architecture**: Use Mermaid diagrams showing subsystem structure and components
   - **Module Interactions**: Sequence diagrams showing how modules work together
   - **Data Flow**: Mermaid flowchart showing how data moves through the subsystem
   - **Design Decisions**: Explain key architectural choices and patterns used
   - **Error Handling**: How errors are managed and propagated through the subsystem
   - **Test Surface**: Integration test coverage explaining most important subsystem flows
   - **Reference**: See `docs/subsystems/configuration.md` as a complete example
2. **Create Module READMEs**: Add technical docs at module root (`src/core/module-name/README.md`)
   - **Architecture**: High-level design and purpose
   - **Contracts**: Interface definitions and guarantees
   - **API**: Public methods with descriptions
   - **Dependencies**: What this module relies on
3. **Update Architecture**: Modify high-level docs in `docs/architecture/` if needed
4. **Quality Checks**: Skip validation for documentation-only changes
5. **Request Approval**: "Ask the developer to test and approve commit and push"
6. **Autonomous Commit**: After approval, commit and push without additional approval

**Project Cleanup**: Ad-hoc commits for structural improvements, file organization, or configuration updates as needed.

### Key Principles

- **Atomic Commits**: Each phase gets its own focused commit
- **Developer Approval**: Required for each phase before proceeding
- **Autonomous Git**: Claude handles git operations after approval
- **Quality First**: Always run checks and formatting before requesting approval
- **Subagent Usage**: Use as many subagents as required to complete complex tasks efficiently
- **Clear Communication**: End every plan with approval request

### Subagent Usage Guidelines

**Always use subagents when:**

- Implementing multiple modules simultaneously
- Writing comprehensive test suites with multiple test files
- Creating documentation for multiple components
- Performing parallel operations that can be done independently

**Example from Configuration Management:**

```
Task: Implement comprehensive tests for all modules
Solution: Spawn 5 subagents in parallel:
- Agent 1: FileSystem.test.ts (15 tests)
- Agent 2: GitRepository.test.ts (10 tests)
- Agent 3: ConfigurationManager.test.ts (34 tests)
- Agent 4: validation.test.ts (23 tests)
- Agent 5: config-loading.integration.test.ts (26 tests)
```

This approach maximizes efficiency and ensures comprehensive coverage of complex tasks.

### Approval Request Format

Always end implementation plans with:

```
- Ask the developer to test and approve commit and push
- After approval by the dev will git add, commit and push, no need for approval for this git commits
```

## Development Patterns

### File Structure Conventions

#### Proven Module Organization Pattern

```
src/core/module-name/
├── types.ts           # Type definitions and interfaces
├── ModuleName.ts      # Main implementation class
├── index.ts           # Public exports
└── __tests__/         # Co-located tests
    ├── ModuleName.test.ts              # Unit tests
    ├── specific-logic.test.ts          # Feature-specific tests
    └── module-integration.test.ts      # Integration tests
```

#### Overall Project Structure

```
src/
├── cli.ts               # Command-line interface entry point
└── core/                # Core business logic modules
    ├── config/          # ✅ Configuration management (IMPLEMENTED)
    ├── file-system/     # ✅ File operations (IMPLEMENTED)
    ├── git/             # ✅ Git repository operations (IMPLEMENTED)
    ├── api/             # 🔄 Hono.js REST routes (PLANNED)
    ├── websocket-events/# 🔄 WebSocket handlers (PLANNED)
    ├── workflow/        # 🔄 Migration workflow (PLANNED)
    ├── task-management/ # 🔄 Queue + workers (PLANNED)
    ├── git-management/  # 🔄 Worktree operations (PLANNED)
    ├── patch-system/    # 🔄 Diff application (PLANNED)
    ├── models/          # 🔄 Model tier selection (PLANNED)
    └── shared/          # 🔄 Server utilities (PLANNED)
```

#### Module Design Principles

- **Minimal Interfaces**: Only essential operations (e.g., IFileSystem with read() and readAsJson())
- **Domain-Driven Design**: Clear separation between infrastructure and business logic
- **Dependency Injection**: Constructor-based dependencies for testability
- **Fail-Fast Error Handling**: Descriptive errors with full context

### Documentation Structure

#### Subsystem Documentation (`docs/subsystems/`)

Developer-focused documentation explaining internal workings and architecture:

- **Purpose**: Help developers understand how subsystems work internally
- **Structure**: Introduction (TLDR + TOC) → Purpose → Architecture → Module Interactions → Data Flow → Design Decisions → Error Handling → Test Surface
- **Diagrams**: Use Mermaid diagrams appropriate for the subsystem (flowchart, sequence, graph, etc.)
- **Content**: Architectural patterns, design decisions, error handling approaches, integration test coverage
- **Example**: See `docs/subsystems/configuration.md` for a complete implementation example
- **Audience**: Developers implementing or extending subsystems

#### Architecture Documentation (`docs/architecture/`)

High-level system architecture and design decisions:

- **Purpose**: Document overall system design and cross-cutting concerns
- **Content**: System diagrams, design principles, integration patterns
- **Audience**: Developers understanding the full system

#### Module Technical Documentation (`src/core/module-name/README.md`)

Technical documentation co-located with module source code:

- **Purpose**: Document module architecture, contracts, and APIs
- **Content**: Interface definitions, public methods, dependencies
- **Audience**: Developers working on specific modules

**Example Structure:**

```
docs/
├── architecture/
│   ├── system-overview.md     # High-level system architecture
│   └── integration-patterns.md # Cross-cutting concerns
├── subsystems/
│   ├── configuration-management.md  # How config subsystem works internally
│   ├── workflow-engine.md          # Workflow subsystem architecture
│   └── README.md                   # Subsystem documentation index

src/core/
├── config/
│   ├── README.md              # Technical: contracts, APIs, architecture
│   └── [source files]
├── file-system/
│   ├── README.md              # Technical: IFileSystem interface, methods
│   └── [source files]
└── git/
    ├── README.md              # Technical: IGitRepository interface, behavior
    └── [source files]
```

### Code Quality Standards

- **TypeScript**: Strict type checking enabled, zero `any` usage
- **ESLint**: Follow configured rules for consistency
- **Prettier**: Automatic code formatting
- **Testing**: Jest with TypeScript support, >80% coverage target
- **Documentation**: Inline comments and external docs for complex logic

### Type Safety Guidelines

Follow this hierarchy when avoiding `any` usage:

1. **First Choice**: Use base classes or union types (`Type1 | Type2 | Type3`)
2. **Second Choice**: Use existing type patterns from the codebase
3. **Last Resort**: Use `T = unknown` for generics

Examples:

```typescript
// Good: Union types
type Config = EnvironmentConfig | ProjectConfig;

// Good: Generic with default
function readAsJson<T = unknown>(path: string): Promise<T>;

// Good: Proper casting for tests
const config = mockData as unknown as EnvironmentConfig;
```

### Testing Standards

#### Test Organization

- **Co-located Tests**: All tests in `__tests__/` directories alongside source code
- **Coverage Target**: >80% line/branch coverage, focus on feature surface coverage
- **Integration Tests**: Use `[integration]: describe` naming convention

#### Integration Testing Pattern

Each module/feature should have **one specific end-to-end scenario** that tests the complete flow including dependencies:

Example from Configuration Management:

```typescript
describe('[integration]: Configuration Loading End-to-End Tests', () => {
  // Tests ConfigurationManager + FileSystem + GitRepository working together
  // Real file I/O, real git operations, complete validation flow
});
```

#### Test Structure

- **Unit Tests**: Isolated testing with mocked dependencies
- **Integration Tests**: Real dependencies, end-to-end workflows
- **Error Scenarios**: Comprehensive edge cases and error paths
- **Type Safety**: Enforce proper TypeScript usage in tests

### Git Workflow

- **Branch**: Work on `main` branch (personal project)
- **Commits**: Atomic, descriptive commit messages
- **Format**: Follow existing commit message patterns
- **Attribution**: Include Claude Code attribution in commits

## Project-Specific Context

### Breaking Changes Approach

- **No Migration Path**: Complete rewrite, no backward compatibility
- **Personal Tool**: No external users to support during transition
- **Clean Slate**: Feel free to restructure, rename, or remove existing code
- **Modern Patterns**: Focus on clean architecture over legacy support

### Legacy Integration

- **Preserve LangGraph**: Existing workflow in `obsolete/source/langgraph-workflow/`
- **Reuse Logic**: Migration nodes and prompts can be adapted
- **Modern Infrastructure**: Build new server layer around existing workflow

### Model Configuration

Configure different AI model tiers per workflow node (all using ReAct agents):

- **plan**: Planning and analysis ReAct agent
- **migrate**: Migration and fixes ReAct agent
- **lint-fix**: Linting error corrections ReAct agent
- **ts-fix**: TypeScript error corrections ReAct agent

Available tiers: `nano`, `mini` (default), `full`

## Debugging and Troubleshooting

### Common Issues

- **TypeScript Errors**: Check `tsconfig.json` and run `yarn build`
- **Test Failures**: Verify jest configuration and dependencies
- **Linting Issues**: Run `yarn lint:fix` for auto-fixes
- **Git Operations**: Check worktree state and branch permissions

### Development Tools

- **Node.js**: Version specified in `package.json` engines
- **Yarn**: Preferred package manager (version in `packageManager`)

Remember: This is a breaking refactor of a personal tool. Prioritize clean architecture and modern patterns over backward compatibility.
