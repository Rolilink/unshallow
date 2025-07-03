# RootedFileSystem Implementation

## Purpose

The RootedFileSystem class provides a security-enhanced wrapper around any IFileSystem implementation. It constrains all file operations to a specific root directory, preventing path traversal attacks and ensuring operations remain within designated boundaries. This is essential for git worktree isolation and secure patch application.

## Architecture

RootedFileSystem implements the extended IFileSystem interface with path validation and constraint enforcement:

```typescript
class RootedFileSystem implements IFileSystem {
  constructor(baseFileSystem: IFileSystem, rootPath: string)
  
  // Read operations (from IFileSystem)
  async read(path: string): Promise<string>
  async readAsJson<T = unknown>(path: string): Promise<T>
  
  // Write operations (extended interface)
  async write(path: string, content: string): Promise<void>
  async delete(path: string): Promise<void>
  async exists(path: string): Promise<boolean>
  
  // Security and debugging
  getRoot(): string
}
```

## Security Features

### Path Traversal Prevention
- All paths are resolved relative to the root directory
- Path traversal attempts (`../`, `../../`, etc.) are blocked
- Absolute paths are converted to relative paths within the root

### Boundary Enforcement
- No operations can occur outside the specified root directory
- All file paths are validated before delegation to the base file system
- Provides clear error messages for boundary violations

### Git Worktree Isolation
- Perfect for constraining patch operations to specific git worktrees
- Ensures migrations don't affect files outside the target directory
- Supports testing scenarios with isolated temporary directories

## API Documentation

### Constructor
```typescript
constructor(baseFileSystem: IFileSystem, rootPath: string)
```

Creates a rooted file system that constrains all operations to the specified root directory.

**Parameters:**
- `baseFileSystem` - The underlying file system implementation to wrap
- `rootPath` - Absolute path to the root directory that constrains all operations

### Read Operations

#### `read(path: string): Promise<string>`
Reads a file relative to the root directory.

**Parameters:**
- `path` - File path relative to root directory

**Returns:**
- Promise resolving to file content as string

**Security:**
- Path is resolved relative to root directory
- Prevents access to files outside the root boundary

#### `readAsJson<T = unknown>(path: string): Promise<T>`
Reads and parses a JSON file relative to the root directory.

**Parameters:**
- `path` - File path relative to root directory
- `T` - Type parameter for expected JSON structure

**Returns:**
- Promise resolving to parsed JSON object of type T

### Write Operations

#### `write(path: string, content: string): Promise<void>`
Writes content to a file relative to the root directory.

**Parameters:**
- `path` - File path relative to root directory
- `content` - Content to write to the file

**Security:**
- Creates parent directories if needed (within root boundary)
- Prevents writing outside the root directory

#### `delete(path: string): Promise<void>`
Deletes a file relative to the root directory.

**Parameters:**
- `path` - File path relative to root directory

**Security:**
- Only deletes files within the root boundary
- Prevents deletion of files outside the root directory

#### `exists(path: string): Promise<boolean>`
Checks if a file exists relative to the root directory.

**Parameters:**
- `path` - File path relative to root directory

**Returns:**
- Promise resolving to true if file exists, false otherwise

### Security Methods

#### `getRoot(): string`
Returns the absolute path to the root directory.

**Returns:**
- Absolute path to the root directory

## Usage Patterns

### Git Worktree Isolation
```typescript
const baseFileSystem = new FileSystem();
const worktreeRoot = '/path/to/git/worktree';
const rootedFS = new RootedFileSystem(baseFileSystem, worktreeRoot);

// All operations constrained to worktree
await rootedFS.read('src/component.tsx');      // Reads from worktree/src/component.tsx
await rootedFS.write('src/updated.tsx', code); // Writes to worktree/src/updated.tsx
```

### Patch Application Security
```typescript
// Constraint patch operations to specific directory
const patchRoot = '/tmp/patch-workspace';
const secureFS = new RootedFileSystem(baseFileSystem, patchRoot);

// Safe patch application - cannot escape the root
await secureFS.write('../../../etc/passwd', 'malicious'); // Blocked!
await secureFS.write('safe-file.txt', 'content');          // Allowed
```

### Testing Isolation
```typescript
// Create isolated test environment
const testRoot = await fs.mkdtemp('/tmp/test-');
const testFS = new RootedFileSystem(new FileSystem(), testRoot);

// All test operations isolated to temporary directory
await testFS.write('test-file.txt', 'test content');
```

### Path Validation Examples
```typescript
const rootedFS = new RootedFileSystem(baseFS, '/safe/root');

// These paths are all resolved safely within the root:
await rootedFS.read('file.txt');           // → /safe/root/file.txt
await rootedFS.read('./file.txt');         // → /safe/root/file.txt
await rootedFS.read('subdir/file.txt');    // → /safe/root/subdir/file.txt

// These attempts are blocked:
await rootedFS.read('../outside.txt');     // Blocked - outside root
await rootedFS.read('/etc/passwd');        // Blocked - absolute path outside root
```

## Error Handling

The RootedFileSystem provides clear error messages for security violations:

```typescript
try {
  await rootedFS.read('../outside-file.txt');
} catch (error) {
  console.log(error.message); // "Path traversal attempt blocked"
}
```

## Dependencies

- **IFileSystem**: Interface contract from types.ts
- **Node.js path**: Path manipulation utilities
- **Node.js fs/promises**: File system operations (through base file system)

## Integration with Patch System

The RootedFileSystem is specifically designed for the patch application system:

```typescript
// PatchDiff uses RootedFileSystem for security
export class PatchDiff {
  constructor(baseFileSystem: IFileSystem, rootPath: string) {
    this.rootedFileSystem = new RootedFileSystem(baseFileSystem, rootPath);
  }
  
  async apply(patch: string) {
    // All patch operations are constrained to the root directory
    await this.rootedFileSystem.write(fileName, newContent);
  }
}
```

This ensures that patch operations cannot escape their designated workspace, providing essential security for automated code migration tools.