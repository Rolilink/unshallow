# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
yarn install

# Build TypeScript
yarn build

# Development with watch mode
yarn dev

# Run tests
yarn test

# Watch tests during development
yarn test:watch

# Linting
yarn lint
yarn lint:fix

# Code formatting
yarn format
yarn format:check

# Link for global testing
yarn link:dev
```

### Testing and Validation

Always run these before requesting approval:

```bash
yarn build     # Ensure TypeScript compiles
yarn lint      # Check code style
yarn format    # Format all files (TS, MD, etc.)
yarn test      # Run all tests
```

## Configuration Files

### Project Configuration

- **UNSHALLOW.md**: Migration context, rules, and project-specific patterns (in target project)
- **unshallow.env**: API keys, model tiers, command configurations (in target project)
- **package.json**: Dependencies, scripts, and build configuration
- **tsconfig.json**: TypeScript compiler settings

### Development Tools

- **.eslintrc.cjs**: ESLint configuration for code quality
- **.prettierrc**: Code formatting rules
- **jest.config.js**: Test runner configuration

## Collaboration Workflow

### Three-Phase Development Cycle

Each feature implementation follows this structured approach:

#### Phase 1: Code Implementation

1. **Implement Feature**: Write the core functionality
2. **Quality Checks**: Run `yarn build`, `yarn lint`, `yarn format`, `yarn test`
3. **Request Approval**: "Ask the developer to test and approve commit and push"
4. **Autonomous Commit**: After approval, commit and push without additional approval

#### Phase 2: Unit Testing

1. **Write Tests**: Create comprehensive unit tests for the feature
2. **Quality Checks**: Run `yarn build`, `yarn lint`, `yarn format`, `yarn test`
3. **Request Approval**: "Ask the developer to test and approve commit and push"
4. **Autonomous Commit**: After approval, commit and push without additional approval

#### Phase 3: Documentation

1. **Create Docs**: Write feature documentation with Mermaid diagrams
2. **Update Architecture**: Modify high-level docs if needed
3. **Organize**: Place docs in appropriate folder (e.g., `docs/server/api/`)
4. **Quality Checks**: Run `yarn format` to ensure consistent formatting
5. **Request Approval**: "Ask the developer to test and approve commit and push"
6. **Autonomous Commit**: After approval, commit and push without additional approval

### Key Principles

- **Atomic Commits**: Each phase gets its own focused commit
- **Developer Approval**: Required for each phase before proceeding
- **Autonomous Git**: Claude handles git operations after approval
- **Quality First**: Always run checks and formatting before requesting approval
- **Clear Communication**: End every plan with approval request

### Approval Request Format

Always end implementation plans with:

```
- Ask the developer to test and approve commit and push
- After approval by the dev will git add, commit and push, no need for approval for this git commits
```

## Development Patterns

### File Structure Conventions

```
src/
├── cli/                 # Command-line interface
├── ui/                  # Web UI (empty - external)
└── server/              # Core server implementation
    ├── api/             # Hono.js REST routes
    ├── websocket-events/# WebSocket handlers
    ├── workflow/        # Migration workflow
    ├── task-management/ # Queue + workers
    ├── git-management/  # Worktree operations
    ├── file-system/     # File access layer
    ├── patch-system/    # Diff application
    ├── config/          # Configuration management
    ├── models/          # Model tier selection
    └── shared/          # Server utilities
```

### Code Quality Standards

- **TypeScript**: Strict type checking enabled
- **ESLint**: Follow configured rules for consistency
- **Prettier**: Automatic code formatting
- **Testing**: Jest with TypeScript support
- **Documentation**: Inline comments and external docs for complex logic

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

Configure different AI model tiers per workflow node:

- **plan**: Planning and analysis steps
- **migrate**: Core migration transformations
- **fix**: Error resolution and fixes
- **lint-fix**: Linting error corrections
- **ts-fix**: TypeScript error corrections

Available tiers: `nano`, `mini` (default), `full`

## Common Development Tasks

### Adding New Server Routes

1. Create route handler in `src/server/api/`
2. Add route to main Hono app
3. Write unit tests
4. Document with API examples

### Implementing Workflow Nodes

1. Create node in `src/server/workflow/`
2. Integrate with existing LangGraph structure
3. Add progress event emission
4. Test with worker thread execution

### Git Worktree Operations

1. Use `src/server/git-management/` abstractions
2. Ensure proper cleanup on completion
3. Handle branch association and commits
4. Test isolation between concurrent tasks

## Debugging and Troubleshooting

### Common Issues

- **TypeScript Errors**: Check `tsconfig.json` and run `yarn build`
- **Test Failures**: Verify jest configuration and dependencies
- **Linting Issues**: Run `yarn lint:fix` for auto-fixes
- **Git Operations**: Check worktree state and branch permissions

### Development Tools

- **VS Code**: Recommended with TypeScript and ESLint extensions
- **Node.js**: Version specified in `package.json` engines
- **Yarn**: Preferred package manager (version in `packageManager`)

Remember: This is a breaking refactor of a personal tool. Prioritize clean architecture and modern patterns over backward compatibility.
