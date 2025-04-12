# unshallow

<img width="708" alt="Screenshot 2025-04-03 at 2 12 16 AM" src="https://github.com/user-attachments/assets/77df3aae-3ef0-42d9-8611-3054ea4f6ed0" />

Unshallow is a CLI tool for migrating Enzyme tests to React Testing Library.

## Install

Since unshallow is not yet published to npm, you'll need to build it from source:

```bash
# Clone the repository
$ git clone https://github.com/yourusername/unshallow.git
$ cd unshallow

# Install dependencies
$ yarn install

# Build the package
$ yarn build

# Create a global symlink
$ yarn link

# Now you can use unshallow globally
$ unshallow --help
```

You can also run unshallow in development mode:

```bash
# Watch for changes and rebuild automatically
$ yarn dev

# In another terminal, after linking
$ unshallow migrate path/to/test.tsx
```

## CLI

```
$ unshallow --help

  Usage
    $ unshallow [command]

  Commands
    migrate <path>      Migrate Enzyme test files to React Testing Library
    config              Configuration management
    context-enricher    Analyze and enrich context for a component

  Options for migrate command
    --skip-ts-check     Skip TypeScript checking
    --skip-lint-check   Skip ESLint checking
    --skip-test-run     Skip running the test
    --max-retries       Maximum LLM retries (default: 20)
    --pattern           Test file pattern (default: **/*.{test,spec}.{ts,tsx})
    --import-depth      Depth for AST import analysis (default: 1)
    --examples          Comma-separated list of example tests to use as references
    --debug             Enable verbose debug output

    # Model selection options
    --reasoning         Use enhanced reasoning for all steps (planning, execution, reflection)
    --reasoning-planning Enable enhanced reasoning for planning steps only
    --reasoning-execution Enable enhanced reasoning for execution steps only
    --reasoning-reflection Enable enhanced reasoning for reflection steps only

  Examples
    $ unshallow migrate path/to/MyComponent.test.tsx
    $ unshallow config:set-api-key YOUR_API_KEY
```

## Configuration

### API Key

Before using unshallow, you need to set up your OpenAI API key:

```bash
# Set your OpenAI API key
$ unshallow config:set-api-key YOUR_API_KEY

# Verify your API key is set correctly
$ unshallow config:get-api-key
```

The API key is stored securely in your user directory under `.unshallow/config.json`.

### Langfuse Integration (Optional)

Unshallow supports Langfuse for tracing and monitoring your LLM usage. To set up Langfuse:

```bash
# Configure Langfuse with your credentials
$ unshallow config:set-langfuse-config '{"publicKey":"YOUR_PUBLIC_KEY","secretKey":"YOUR_SECRET_KEY","host":"http://localhost:3000"}'
```

The configuration accepts a JSON object with the following properties:

- `publicKey`: Your Langfuse public key
- `secretKey`: Your Langfuse secret key
- `host`: The Langfuse server URL (default: "https://cloud.langfuse.com")

When Langfuse is configured, each migration will be traced, allowing you to:

- Monitor token usage and costs
- Analyze model performance
- Debug failed migrations
- View the entire migration workflow

## Advanced Configuration Options

### Model Selection

Unshallow uses different OpenAI models for different phases of the migration process. By default, it uses GPT-4o mini for most tasks, but you can enable enhanced reasoning for specific phases:

- `--reasoning`: Enable enhanced reasoning for all phases (uses OpenAI o3-mini model)
- `--reasoning-planning`: Use enhanced reasoning only for the planning phase
- `--reasoning-execution`: Use enhanced reasoning only for the execution/implementation phase
- `--reasoning-reflection`: Use enhanced reasoning only for the error analysis phase

Enhanced reasoning generally provides better results for complex tests but may use more tokens.

```bash
# Use enhanced reasoning for all phases
$ unshallow migrate path/to/MyComponent.test.tsx --reasoning

# Use enhanced reasoning only for planning
$ unshallow migrate path/to/MyComponent.test.tsx --reasoning-planning
```

### Models Used

Unshallow strategically uses different OpenAI models for different workflow phases:

| Workflow Phase | Default Model | Enhanced Reasoning Model | Flag                     |
| -------------- | ------------- | ------------------------ | ------------------------ |
| Planning       | GPT-4o-mini   | o3-mini                  | `--reasoning-planning`   |
| Execution      | GPT-4o-mini   | o3-mini                  | `--reasoning-execution`  |
| Error Analysis | GPT-4o-mini   | o3-mini                  | `--reasoning-reflection` |

**GPT-4o-mini**:

- Used by default for all phases
- Balanced between performance and cost
- Good for most migration cases

**o3-mini**:

- Used when enhanced reasoning is enabled
- Better for complex scenarios that require deeper reasoning
- Excels at analyzing errors and planning fixes
- Generally more expensive but provides better results for difficult migrations

Each phase of the workflow has different reasoning requirements:

- **Planning Phase**: Creating a Gherkin-style plan from the Enzyme test
- **Execution Phase**: Implementing the React Testing Library code based on the plan
- **Error Analysis**: Analyzing test failures, understanding root causes, and planning fixes

For simpler tests, the default GPT-4o-mini is usually sufficient. For complex tests with intricate component behavior or many edge cases, enabling enhanced reasoning can significantly improve success rates.

### Providing Examples and Extra Context

Unshallow provides two powerful ways to improve migration quality:

#### Example Tests

You can provide previously migrated tests as examples to help the model understand your project's specific patterns and styles:

```bash
# Provide single example
$ unshallow migrate path/to/MyComponent.test.tsx --examples=path/to/AlreadyMigrated.test.tsx

# Provide multiple examples
$ unshallow migrate path/to/MyComponent.test.tsx --examples=path/to/Example1.test.tsx,path/to/Example2.test.tsx
```

Examples are particularly helpful when:

- You have specific testing patterns you want to maintain
- Components share similar behaviors or validation approaches
- Previous migrations have established patterns you want to continue

#### Extra Context via Context File

Unshallow automatically creates a default context file at `~/.unshallow/context.md` that you can edit to provide additional context and instructions:

```bash
# Open the context file in your default editor
$ open ~/.unshallow/context.md
```

The context file follows this structure:

```markdown
# Additional Context for Test Conversion

## Component Behavior

Add information about specific component behaviors or quirks here.

This file is read during migration and provided to the model as additional guidance. It's extremely valuable for:

- Explaining project-specific conventions
- Describing preferred mocking strategies
- Specifying testing patterns to follow or avoid
- Adding details about your component architecture
- Providing guidance on handling edge cases

Customizing this file can significantly improve migration quality for your specific codebase.

## Migration Process

When migrating a test, unshallow creates a temporary `.unshallow` folder in the same directory as the test file. This folder contains all the artifacts and logs generated during the migration process.

### Folder Structure

The `.unshallow` folder is organized as follows:

```
/path/to/test-directory/
├── .unshallow/
│   ├── ComponentName/          # Folder named after the component (not the test file)
│   │   ├── logs.txt            # Detailed logs of the migration process
│   │   ├── plan.txt            # Gherkin-style plan for the test conversion
│   │   └── ComponentName.test.attempt.tsx  # Saved if migration fails
```

- The component folder is named after the component being tested, not the test file (e.g., `TodoApp` for `TodoApp.test.tsx`)
- `logs.txt` contains detailed logs of the entire migration process
- `plan.txt` contains the Gherkin-style plan generated for the test conversion
- If migration fails, an `.attempt` file is created with the most recent conversion attempt

### How It Works

1. **Planning Phase**: Unshallow analyzes the Enzyme test and generates a Gherkin-style plan for the migration
2. **Execution Phase**: The plan is executed to convert the Enzyme test to RTL
3. **Test Phase**: The converted test is run to verify it works
4. **Fix Loop**: If the test fails, unshallow attempts to fix it up to the maximum retry limit
5. **TypeScript and Lint Checks**: If the test passes, TypeScript and lint checks are performed

If the migration fails after exhausting the retry limit, unshallow will:

1. Save the most recent attempt in the `.unshallow` directory
2. Skip TypeScript and lint checks (they only run on successfully migrated tests)
3. Report the failure with a non-zero exit code

### Cleanup

When a test is successfully migrated, the test-specific directory in `.unshallow` is cleaned up. The `.unshallow` folder is only removed when all test directories inside it have been removed.

## License

MIT
