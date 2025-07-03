# File System Module

## Overview

The file-system module provides type-safe, secure file operations for the unshallow application. It includes both basic file system operations and security-enhanced implementations for constrained environments like git worktrees.

## Table of Contents

- [Architecture](#architecture)
- [Implementations](#implementations)
- [Security Features](#security-features)
- [Usage Patterns](#usage-patterns)
- [API Reference](#api-reference)

## Architecture

The file-system module is built around a minimal interface that separates concerns between basic file operations and security constraints:

```
file-system/
├── types.ts              # IFileSystem interface definition
├── FileSystem/           # Basic file system implementation
│   ├── FileSystem.ts     # Standard Node.js file operations
│   └── README.md         # FileSystem documentation
├── RootedFileSystem/     # Security-enhanced implementation
│   ├── RootedFileSystem.ts # Root-constrained file operations
│   └── README.md         # RootedFileSystem documentation
└── index.ts              # Public exports
```

## Implementations

### FileSystem
The standard implementation providing direct access to Node.js file operations.

- **Purpose**: Basic file reading and JSON parsing
- **Use Cases**: Configuration loading, general file access
- **Security**: No path constraints (relies on system permissions)

[View detailed documentation](./FileSystem/README.md)

### RootedFileSystem
A security-enhanced wrapper that constrains all operations to a specific root directory.

- **Purpose**: Secure file operations within bounded directories
- **Use Cases**: Git worktree isolation, patch application, testing
- **Security**: Path traversal prevention, boundary enforcement

[View detailed documentation](./RootedFileSystem/README.md)

## Security Features

### Path Traversal Prevention
- All paths are validated and resolved relative to designated boundaries
- Prevents `../` attacks and absolute path escapes
- Clear error messages for security violations

### Git Worktree Isolation
- Perfect for constraining patch operations to specific git worktrees
- Ensures migrations don't affect files outside the target directory
- Supports testing scenarios with isolated temporary directories

### Boundary Enforcement
- No operations can occur outside specified root directories
- All file paths are validated before delegation to underlying systems
- Provides debugging information about constraint violations

## Usage Patterns

### Basic File Operations
```typescript
import { FileSystem } from './file-system';

const fs = new FileSystem();
const content = await fs.read('./config.json');
const config = await fs.readAsJson<AppConfig>('./config.json');
```

### Secure Patch Application
```typescript
import { FileSystem, RootedFileSystem } from './file-system';

const baseFS = new FileSystem();
const secureFS = new RootedFileSystem(baseFS, '/safe/workspace');

// All operations constrained to /safe/workspace
await secureFS.write('file.txt', 'content');
await secureFS.read('file.txt');
```

### Testing Isolation
```typescript
import { FileSystem, RootedFileSystem } from './file-system';

const testRoot = await fs.mkdtemp('/tmp/test-');
const testFS = new RootedFileSystem(new FileSystem(), testRoot);

// All test operations isolated to temporary directory
await testFS.write('test.txt', 'test content');
```

## API Reference

### IFileSystem Interface

```typescript
export interface IFileSystem {
  // Core read operations
  read(path: string): Promise<string>;
  readAsJson<T = unknown>(path: string): Promise<T>;
  
  // Extended operations (implemented by RootedFileSystem)
  write?(path: string, content: string): Promise<void>;
  delete?(path: string): Promise<void>;
  exists?(path: string): Promise<boolean>;
}
```

### Core Methods

#### `read(path: string): Promise<string>`
- Reads file content as UTF-8 encoded string
- Throws file system errors (ENOENT, EACCES, etc.)

#### `readAsJson<T = unknown>(path: string): Promise<T>`
- Reads and parses JSON files with type safety
- Throws file system errors or JSON parsing errors

### Extended Methods (RootedFileSystem)

#### `write(path: string, content: string): Promise<void>`
- Writes content to file (creates parent directories if needed)
- Constrained to root directory boundaries

#### `delete(path: string): Promise<void>`
- Deletes file within root directory boundaries
- Prevents deletion outside constrained area

#### `exists(path: string): Promise<boolean>`
- Checks file existence within root directory boundaries
- Returns false for files outside constraints

## Dependencies

- **Node.js fs/promises**: Core file system operations
- **Node.js path**: Path manipulation utilities
- No external npm dependencies required

## Integration

The file-system module is designed for dependency injection and easy testing:

```typescript
// Production usage
const fileSystem = new FileSystem();

// Testing with mocks
const mockFileSystem = {
  read: jest.fn().mockResolvedValue('test content'),
  readAsJson: jest.fn().mockResolvedValue({ test: true })
};

// Secure patch application
const patchFS = new RootedFileSystem(fileSystem, '/patch/workspace');
```

This module provides the foundation for all file operations in the unshallow application while maintaining security, testability, and clean interfaces.