# Patch-Diff System

## Overview

The patch-diff system provides a robust, context-based approach to applying code changes using the V4A (Version 4A) diff format. Unlike traditional line-based diffs, it uses surrounding code context to locate and modify specific sections within files, making it resilient to file changes and formatting variations.

## Installation

```typescript
import { PatchDiff } from './index';
import { FileSystem } from '../file-system';

const fileSystem = new FileSystem();
const patchDiff = new PatchDiff(fileSystem, '/project/root');
```

## API Reference

### PatchDiff Class

```typescript
class PatchDiff {
  constructor(fileSystem: IFileSystem, rootPath: string);
  
  // Apply a V4A format patch
  async apply(patchText: string): Promise<PatchResult>;
  
  // Validate patch without applying
  validate(patchText: string): ValidationResult;
  
  // Preview changes without applying
  async preview(patchText: string): Promise<PreviewResult>;
}
```

### Basic Usage

```typescript
const patch = `*** Begin Patch
*** Update File: hello.py
@@ def greet(name):
    """Greet someone by name"""
-    print(f"Hello {name}")
+    print(f"Hello, {name}!")
+    print(f"Nice to meet you!")
*** End Patch`;

const result = await patchDiff.apply(patch);

if (result.success) {
  console.log('Applied changes:', result.changes);
  console.log('Fuzz score:', result.fuzz); // 0 = perfect match
} else {
  console.error('Failed:', result.error);
}
```

### Validation

```typescript
const validation = patchDiff.validate(patchText);

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
  console.warn('Warnings:', validation.warnings);
}
```

### Preview Changes

```typescript
const preview = await patchDiff.preview(patchText);

preview.files.forEach(file => {
  console.log(`${file.action}: ${file.path}`);
});
```

## Result Types

### PatchResult

```typescript
interface PatchResult {
  success: boolean;
  changes?: FileChange[];    // Applied changes
  fuzz?: number;            // Context matching quality (0=perfect)
  error?: Error;            // Error if failed
}
```

### FileChange

```typescript
interface FileChange {
  type: ActionType;         // 'add', 'update', 'delete'
  old_content?: string;     // Original content
  new_content?: string;     // New content  
  move_path?: string;       // New path for move operations
}
```

## Supported Operations

### Update File

```typescript
const patch = `*** Begin Patch
*** Update File: src/utils.py
@@ def calculate(x):
-    return x * 2
+    return x * 3
*** End Patch`;
```

### Add File

```typescript
const patch = `*** Begin Patch
*** Add File: src/new-module.py
+def new_function():
+    return "Hello World"
*** End Patch`;
```

### Delete File

```typescript
const patch = `*** Begin Patch
*** Delete File: src/old-module.py
*** End Patch`;
```

### Move File

```typescript
const patch = `*** Begin Patch
*** Update File: old-location.py
*** Move to: src/new-location.py
@@ class Processor:
-    """Old documentation"""
+    """Updated documentation"""
*** End Patch`;
```

### Multiple Files

```typescript
const patch = `*** Begin Patch
*** Update File: main.py
@@ def main():
-    old_function()
+    new_function()

*** Add File: helpers.py
+def new_function():
+    return "Updated logic"

*** Delete File: legacy.py
*** End Patch`;
```

## Advanced Features

### Hierarchical Context

When the same code pattern appears multiple times, use `@@` markers:

```typescript
const patch = `*** Begin Patch
*** Update File: models.py
@@ class User:
    def update(self):
-        print("Old User update")
+        print("New User update")

@@ class Product:
    def update(self):
-        print("Old Product update")  
+        print("New Product update")
*** End Patch`;
```

### Unicode Normalization

The system automatically handles Unicode variants:

```typescript
// These will match despite different Unicode characters:
// EN DASH (–) matches ASCII hyphen (-)
// Smart quotes (") match straight quotes (")
// Non-breaking spaces match regular spaces
```

### Fuzzy Matching

Context matching uses a 3-pass algorithm:

1. **Exact match** (fuzz = 0): Perfect context match
2. **Trim trailing whitespace** (fuzz = 1): Good match
3. **Trim all whitespace** (fuzz = 100): Fuzzy match

Higher fuzz scores indicate less precise matches.

## Error Handling

### Error Types

```typescript
import {
  DiffError,           // Base error
  FileNotFoundError,   // File doesn't exist
  FileExistsError,     // File already exists for ADD
  InvalidPatchError,   // Malformed patch
  SecurityError,       // Path validation failed
  ContextNotFoundError // Context not found in file
} from './index';
```

### Common Error Scenarios

```typescript
try {
  const result = await patchDiff.apply(patch);
} catch (error) {
  if (error instanceof FileNotFoundError) {
    console.error('File missing:', error.message);
  } else if (error instanceof ContextNotFoundError) {
    console.error('Context not found:', error.message);
  } else if (error instanceof SecurityError) {
    console.error('Security violation:', error.message);
  }
}
```

## Security Features

### Path Validation

- **No absolute paths**: All paths must be relative
- **No directory traversal**: `../` patterns are blocked
- **Root confinement**: All operations stay within the specified root directory

### Safe File Operations

- **Atomic operations**: All changes applied together or not at all
- **Parent directory creation**: Automatically creates needed directories
- **Conflict detection**: Prevents overwriting existing files during ADD operations

## Integration with File Systems

The PatchDiff class works with any implementation of `IFileSystem`:

```typescript
interface IFileSystem {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
}
```

### Custom File System

```typescript
class CustomFileSystem implements IFileSystem {
  // Implement methods for your storage backend
}

const patchDiff = new PatchDiff(new CustomFileSystem(), '/root');
```

## Performance Considerations

- **Memory efficient**: Streams file content and processes line by line
- **Context caching**: Reuses canonicalized context for multiple matches
- **Parallel file operations**: Loads multiple files concurrently when possible

## Best Practices

### Writing Patches

1. **Use unique context**: Choose distinctive code patterns for reliable matching
2. **Hierarchical markers**: Use `@@` markers for ambiguous locations  
3. **Test incrementally**: Apply patches in small, verifiable chunks

### Error Recovery

1. **Validate first**: Use `validate()` before `apply()` for safety
2. **Check fuzz scores**: High fuzz scores may indicate unreliable matches
3. **Handle conflicts**: Implement retry logic for transient failures

### Security

1. **Validate input**: Always sanitize patch content from external sources
2. **Limit scope**: Use restrictive root paths to contain operations
3. **Monitor changes**: Log all file operations for audit trails

## Architecture

The system consists of five main components:

- **PatchDiff**: Main orchestrator class
- **PatchParser**: Converts V4A text to structured format
- **ContextFinder**: Locates context within files using fuzzy matching
- **ChunkApplicator**: Applies changes to file content
- **SecurityValidator**: Validates paths and prevents security issues

For detailed technical documentation, see `/docs/subsystems/patch-diff.md`.