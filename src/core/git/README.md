# Git Module

## Architecture

The git module provides a clean abstraction over Git operations, following the single responsibility principle. It encapsulates Git CLI interactions and provides graceful fallback behavior when operating outside of Git repositories.

The module is designed with:
- **Contract-first approach**: Interface-based design enabling testability and flexibility
- **Graceful degradation**: Falls back to process working directory when Git is unavailable
- **Async-first**: All operations return promises for non-blocking execution

## Contracts

### IGitRepository

```typescript
export interface IGitRepository {
  getRoot(): Promise<string>;
}
```

The core contract defines minimal Git repository operations. Currently focused on repository root discovery, with room for extension as needed.

## API

### GitRepository.getRoot()

Retrieves the Git repository root directory.

**Returns**: `Promise<string>` - Absolute path to repository root

**Behavior**:
- Executes `git rev-parse --show-toplevel` to find repository root
- Falls back to `process.cwd()` when:
  - Not in a Git repository
  - Git CLI is unavailable
  - Command execution fails

**Example**:
```typescript
const repo = new GitRepository();
const root = await repo.getRoot(); // "/path/to/repo" or current directory
```

## Dependencies

- **child_process**: Node.js built-in for Git CLI execution
- **util.promisify**: Converts callback-based `exec` to promise-based flow

No external dependencies required, ensuring minimal footprint and maximum portability.