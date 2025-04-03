# Unshallow

A CLI tool for migrating Enzyme tests to React Testing Library.

## Features

- Analyzes Enzyme test files using AST
- Enriches context with component information
- Converts Enzyme assertions to React Testing Library
- Provides interactive UI for migration progress
- Validates TypeScript and ESLint compatibility

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/unshallow.git
cd unshallow

# Install dependencies
yarn

# Build the project
yarn build
```

## Usage

```bash
# Run the migration on a specific test file
yarn start migrate path/to/test.tsx

# Run the migration on a directory of test files
yarn start migrate path/to/tests/

# Set import resolution depth (default is 2)
yarn start migrate path/to/test.tsx --depth 3

# Skip TypeScript checking
yarn start migrate path/to/test.tsx --skip-ts-check

# Skip ESLint checking
yarn start migrate path/to/test.tsx --skip-lint-check
```

## Development

```bash
# Run tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run TypeScript in watch mode
yarn dev

# Lint the code
yarn lint

# Format the code
yarn format
```

## Tech Stack

- **TypeScript**: Primary development language
- **Commander.js**: CLI framework
- **Ink**: React-based terminal UI
- **LangChain.js**: LLM integration
- **Zod**: Type validation
- **Jest**: Testing
- **Prettier**: Code formatting

## License

MIT
