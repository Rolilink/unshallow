# Unshallow CLI Documentation

## Command Interface

### Main Command
```bash
unshallow migrate <path> [options]
```

### Arguments
- `path`: File or directory to migrate from Enzyme to RTL
  - Can be a single test file
  - Can be a directory containing test files
  - Supports both relative and absolute paths

### Options
- `--skip-ts-check`: Skip TypeScript checking
- `--skip-lint-check`: Skip ESLint checking
- `--max-retries <number>`: Maximum LLM retries (default: 5)
- `-h, --help`: Display help for command

### Examples
```bash
# Migrate a single file
unshallow migrate ./src/tests/MyComponent.test.tsx

# Migrate an entire directory
unshallow migrate ./src/tests

# Migrate with options
unshallow migrate ./src/tests --skip-ts-check --max-retries 3
```

## Process Flow

### Migration Steps
1. Input Validation
   - Verify file/directory exists
   - Check if path contains test files
   - Validate options

2. Migration Process
   - Parse Enzyme tests
   - Convert to RTL syntax
   - Apply transformations
   - Handle edge cases

3. Validation Steps
   - TypeScript type checking
   - ESLint code style checking
   - Syntax verification

4. Error Handling
   - Retry failed migrations
   - Report errors clearly
   - Provide fix suggestions

### Exit Codes
- 0: Successful migration
- 1: Migration failed
- 2: Invalid arguments
- 3: File system error

### Error Messages
Standard error message format:
```
Error: [Error Type] in [File]
Details: [Error Details]
Suggestion: [How to Fix]
```

## Usage Guidelines

### Best Practices
1. Run on a clean git branch
2. Commit changes before migration
3. Review generated tests
4. Run test suite after migration

### Common Patterns
1. Single File Migration
   ```bash
   unshallow migrate src/tests/Component.test.tsx
   ```

2. Directory Migration
   ```bash
   unshallow migrate src/tests
   ```

3. Skip Validation
   ```bash
   unshallow migrate src/tests --skip-ts-check --skip-lint-check
   ```

4. Increase Retries
   ```bash
   unshallow migrate src/tests --max-retries 10
   ``` 