# File System Module

## Architecture

The file-system module provides a minimal, type-safe abstraction over Node.js file operations. It encapsulates file reading capabilities behind a clean interface, enabling dependency injection and testability while maintaining a focused API surface.

## Contracts

### IFileSystem Interface

```typescript
export interface IFileSystem {
  read(path: string): Promise<string>;
  readAsJson<T = unknown>(path: string): Promise<T>;
}
```

The interface defines two core operations:
- **read**: Asynchronously reads file content as UTF-8 encoded string
- **readAsJson**: Reads and parses JSON files with optional type parameter for type safety

## API

### Public Methods

#### `read(path: string): Promise<string>`
Reads a file from the specified path and returns its content as a string.
- **Parameters**: `path` - Absolute or relative file path
- **Returns**: Promise resolving to file content
- **Throws**: File system errors (ENOENT, EACCES, etc.)

#### `readAsJson<T = unknown>(path: string): Promise<T>`
Reads a JSON file and parses it into the specified type.
- **Parameters**: `path` - Absolute or relative file path
- **Type Parameter**: `T` - Expected shape of parsed JSON (defaults to `unknown`)
- **Returns**: Promise resolving to parsed JSON object
- **Throws**: File system errors or JSON parsing errors

## Dependencies

- **Node.js fs/promises**: Core file system module with promise-based API
- No external npm dependencies required