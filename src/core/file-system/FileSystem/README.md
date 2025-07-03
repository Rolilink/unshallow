# FileSystem Implementation

## Purpose

The FileSystem class provides a concrete implementation of the IFileSystem interface using Node.js file operations. It serves as the standard file system adapter for the unshallow application, enabling direct file access from the host operating system.

## Architecture

The FileSystem class implements a minimal interface focused on reading operations:

```typescript
class FileSystem implements IFileSystem {
  async read(path: string): Promise<string>
  async readAsJson<T = unknown>(path: string): Promise<T>
}
```

This implementation prioritizes simplicity and type safety, providing essential file reading capabilities without additional complexity.

## API Documentation

### `read(path: string): Promise<string>`

Reads a file from the specified path and returns its content as a UTF-8 encoded string.

**Parameters:**
- `path` - File path (absolute or relative to current working directory)

**Returns:**
- Promise resolving to file content as string

**Throws:**
- `ENOENT` - File does not exist
- `EACCES` - Permission denied
- `EISDIR` - Path is a directory
- Other Node.js file system errors

**Example:**
```typescript
const fs = new FileSystem();
const content = await fs.read('/path/to/file.txt');
console.log(content); // File content as string
```

### `readAsJson<T = unknown>(path: string): Promise<T>`

Reads a JSON file and parses it into the specified type. Provides type safety through TypeScript generics.

**Parameters:**
- `path` - File path to JSON file
- `T` - Type parameter for expected JSON structure (defaults to `unknown`)

**Returns:**
- Promise resolving to parsed JSON object of type T

**Throws:**
- File system errors (same as `read()`)
- `SyntaxError` - Invalid JSON format

**Example:**
```typescript
interface Config {
  apiKey: string;
  timeout: number;
}

const fs = new FileSystem();
const config = await fs.readAsJson<Config>('/path/to/config.json');
console.log(config.apiKey); // Type-safe access
```

## Usage Patterns

### Basic File Reading
```typescript
const fileSystem = new FileSystem();
const content = await fileSystem.read('./example.txt');
```

### Configuration Loading
```typescript
const config = await fileSystem.readAsJson<AppConfig>('./config.json');
```

### Error Handling
```typescript
try {
  const content = await fileSystem.read('./missing-file.txt');
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log('File not found');
  }
}
```

## Dependencies

- **Node.js fs/promises**: Core file system operations
- **IFileSystem**: Interface contract from types.ts

## Integration

The FileSystem class is designed for dependency injection and can be easily mocked for testing:

```typescript
// Production usage
const fileSystem = new FileSystem();

// Testing with mock
const mockFileSystem = {
  read: jest.fn().mockResolvedValue('test content'),
  readAsJson: jest.fn().mockResolvedValue({ test: true })
};
```

This implementation provides the foundation for all file operations in the unshallow application while maintaining a clean, testable interface.