# Config Module

## Architecture

The config module provides centralized configuration management for the Unshallow migration system. It handles two distinct configuration types:

1. **Project Configuration** - Migration-specific instructions stored in `UNSHALLOW.md`
2. **Environment Configuration** - System-wide settings stored in `unshallow.json`

The module follows a simple layered design:
- Type definitions (`types.ts`) define contracts
- `ConfigurationManager` class provides the public API
- Validation logic ensures configuration integrity

## Contracts

### Core Interfaces

```typescript
interface ProjectConfig {
  content: string;    // Raw UNSHALLOW.md content
  filePath?: string;  // Absolute path to config file
}

interface EnvironmentConfig {
  apiKeys: {
    openai: string;                    // Required
    langfuse: LangfuseConfig | null;   // Optional telemetry
  };
  modelTiers: {
    plan: ModelTier;     // Planning agent model
    migrate: ModelTier;  // Migration agent model
    lintFix: ModelTier;  // Lint fixing agent model
    tsFix: ModelTier;    // TypeScript fixing agent model
  };
  commands: {
    test: string;      // Test command
    lint: string;      // Lint check command
    lintFix: string;   // Lint fix command
    typeCheck: string; // TypeScript check command
  };
}
```

### Supporting Types

```typescript
type ModelTier = 'nano' | 'mini' | 'full';
type WorkflowNode = 'plan' | 'migrate' | 'lint-fix' | 'ts-fix';
type CommandType = 'test' | 'lint' | 'lint-fix' | 'type-check';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
```

## API

### ConfigurationManager

Public methods:

#### `loadProjectConfig(): Promise<ProjectConfig>`
Loads `UNSHALLOW.md` from repository root. Throws if file not found.

#### `loadEnvironmentConfig(): Promise<EnvironmentConfig>`
Loads `unshallow.json` from repository root. Merges user config with defaults. Throws if OpenAI API key missing.

#### `getModelTier(workflowNode: WorkflowNode, config: EnvironmentConfig): ModelTier`
Maps workflow nodes to their configured model tiers.

#### `getCommand(commandType: CommandType, config: EnvironmentConfig): string`
Retrieves command strings for various operations.

#### `validateConfiguration(config: EnvironmentConfig): ValidationResult`
Validates environment configuration structure and values.

### Default Configuration

```typescript
{
  modelTiers: {
    plan: 'mini',
    migrate: 'mini',
    lintFix: 'mini',
    tsFix: 'mini'
  },
  commands: {
    test: 'npm test',
    lint: 'npm run lint',
    lintFix: 'npm run lint:fix',
    typeCheck: 'npm run type-check'
  }
}
```

## Dependencies

The module depends on:

- **FileSystem** (`../file-system`) - File I/O operations
- **GitRepository** (`../git`) - Repository root detection
- **path** (Node.js built-in) - Path manipulation

No external npm dependencies required.