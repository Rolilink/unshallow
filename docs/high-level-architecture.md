# High-Level Architecture Plan for Unshallow CLI Tool

## Primary Architecture Separation

The architecture is built around three main modules with clear separation of concerns:

### 1. CLI Module
- Single command interface: `unshallow migrate [folder]`
- Configuration file reading (`UNSHALLOW.md`, `unshallow.env`)
- Server lifecycle management (start/stop)
- Minimal, focused responsibility

### 2. UI Module  
- Empty folder (handled by external Vercel v0 project)
- Will connect to server via WebSocket and API calls

### 3. Server Module
- Core business logic and infrastructure
- All workflow, task management, and file system operations
- Ephemeral in-memory state (except git worktrees/branches)
- Hono.js-based API and WebSocket endpoints for UI communication

## Server Module Structure

```
src/server/
├── api/                     # Hono.js REST API routes
├── websocket-events/        # WebSocket event handlers  
├── workflow/               # Migration workflow logic
├── task-management/        # Queue + worker management
├── git-management/         # Worktree + branch operations
├── file-system/            # File access with worktree support
├── patch-system/           # GPT-4.1 diff application
├── config/                 # Configuration management
├── models/                 # Model tier selection
└── shared/                 # Server-wide utilities
```

## Key Technical Stack & Features

### Hono.js Server Framework
- **Fast & Lightweight**: Modern web framework for Node.js
- **API Routes**: Clean REST endpoint definitions
- **WebSocket Support**: Real-time communication with UI
- **Middleware**: Built-in support for CORS, logging, validation
- **TypeScript-First**: Excellent TypeScript integration

### Ephemeral State Management
- All workflow state stored in-memory only
- LevelDB exclusively for worker/task/queue persistence
- Server startup clears all previous tasks
- Git worktrees and branches are the only persistent artifacts

### Git Management Module
- **Worktree Creation**: Isolated workspaces per migration task
- **Branch Association**: Link worktrees to specific branches
- **UI Integration**: Support for requeueing, transforming worktrees to branches
- **Commit/Push Logic**: Handle successful and failed migration commits
- **Cleanup Operations**: Automatic worktree deletion when appropriate

### File System Module
- **Dual Access**: Main repository (read, test discovery) + worktree (read/write)
- **Worktree-Aware**: All file operations understand current working context
- **Path Resolution**: Transparent handling of main vs worktree file paths
- **Test Discovery**: Scan main repository for Enzyme test files

### Patch System
- **GPT-4.1 Integration**: Generate file diffs using advanced model capabilities
- **Patch Application**: Migrate existing patch tool for applying diffs
- **Single File Updates**: Workflow restricted to modifying only target file
- **Diff Validation**: Ensure patch integrity before application

### Model Configuration System
- **Tier Selection**: nano, mini, full (default: mini)
- **Per-Node Configuration**: Different tiers for plan, migrate, fix, lint-fix, ts-fix
- **Environment Configuration**: Model selection exclusively via unshallow.env
- **Cost Optimization**: Balance between quality and API costs

### Task Management
- **LevelDB Queue**: Persistent task storage for worker coordination
- **Worker Threads**: Parallel processing of migration tasks
- **In-Memory State**: Workflow progress and results stored temporarily
- **Clean Startup**: Fresh state on each server restart

### Workflow Integration  
- **Existing LangGraph**: Reuse current workflow nodes and logic
- **Worker Isolation**: Each task runs in separate worker thread
- **Progress Events**: Real-time updates via WebSocket
- **File Constraints**: Single file modification per workflow execution

## Configuration Files

### UNSHALLOW.md
- Migration context and rules
- Project-specific patterns and conventions
- Business logic guidance for migrations

### unshallow.env  
- OpenAI API keys
- Model tier selections per workflow node (plan, migrate, fix, lint-fix, ts-fix)
- Command configurations (lint, test, typecheck)
- Environment-specific technical settings

## Core Workflows

### Migration Process
1. CLI discovers test files in main repository
2. Tasks created in LevelDB queue with associated worktrees
3. Worker threads execute workflow in isolated environments
4. Real-time progress via WebSocket to UI
5. Successful migrations ready for commit/push via UI

### UI Control Flow
- Monitor migration progress in real-time
- Requeue failed tasks
- Transform worktrees to permanent branches
- Commit and push completed migrations
- Manual intervention for complex cases