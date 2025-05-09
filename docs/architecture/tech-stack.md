# Unshallow Tech Stack Documentation

## Core Technologies

### CLI Framework

- **Commander.js**
  - Excellent TypeScript support
  - Mature and well-maintained
  - Rich feature set
  - Large community and extensive documentation
  - Used by major tools like Vue CLI and Create React App
  - Lightweight yet powerful
  - Perfect for handling file paths and options
  - Robust command parsing
  - Built-in help text generation

### UI Framework

- **Ink**
  - Built specifically for React
  - First-class TypeScript support
  - Uses Yoga layout engine (same as React Native)
  - Active maintenance and community
  - Rich component ecosystem
  - Built-in spinners, text input, select components
  - Modern terminal app capabilities

### Language & Runtime

- **TypeScript**: Primary development language
  - Strong type safety
  - Modern JavaScript features
  - Enhanced IDE support
  - Better code maintainability
- **Node.js**: Runtime environment

### LLM Integration

- **LangChain.js**: Framework for LLM operations

  - Chain management
  - Prompt templating
  - LLM integration
  - Retry mechanisms
  - Error handling
  - Context management

- **LangGraph**: Advanced LLM orchestration
  - Graph-based flow control
  - Complex multi-step LLM operations
  - State management between steps
  - Cyclic and conditional execution
  - Error recovery and fallback paths
  - Progress tracking and monitoring

### AST Analysis & File Processing

- **TypeScript Compiler API**: For AST parsing and analysis

  - Precise source code analysis
  - Component and import detection
  - Type information extraction
  - Full TypeScript syntax support

- **glob**: File pattern matching

  - Recursive directory traversal
  - Pattern-based file matching
  - Used for finding test files

- **fs/promises**: File system operations
  - Asynchronous file reading/writing
  - Directory management
  - Temporary file handling

### Event Handling

- **EventEmitter**: For event-based communication
  - Observer pattern implementation
  - Non-blocking event dispatch
  - State change notifications
  - Loosely coupled component communication

### Type Safety & Validation

- **Zod**: Runtime type validation
  - Schema definition and validation
  - TypeScript type inference
  - Parse and validate CLI inputs
  - Runtime data validation
  - Error messages generation
  - Custom validation rules
  - Integration with TypeScript types

## State Management

- React Context for global state
- Component-level state for UI elements
- Event-based progress tracking
- Error state management
- Reducer pattern for state transitions

## Development Tools

- ESLint for code quality
- TypeScript compiler for type checking
- Jest for testing
- Prettier for code formatting
