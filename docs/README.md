# Unshallow Documentation

Welcome to the Unshallow documentation! This guide will help you navigate through the codebase and understand its architecture, subsystems, and implementation details.

## 📚 Documentation Structure

Our documentation is organized hierarchically to provide both high-level architectural views and detailed implementation guides:

```
docs/
├── README.md                  # You are here!
├── architecture/             # High-level system design
│   ├── overview.md          # System architecture overview
│   ├── workflow-engine.md   # Core workflow execution design
│   ├── data-flow.md         # Data flow and state management
│   └── extension-model.md   # Plugin and extension architecture
└── subsystems/              # Detailed subsystem documentation
    ├── cli/                 # Command-line interface
    ├── core/                # Core workflow engine
    ├── config/              # Configuration management
    ├── storage/             # Data persistence layer
    └── utils/               # Shared utilities
```

## 🚀 Quick Start

For developers new to Unshallow, we recommend starting with:

1. **[Architecture Overview](./architecture/overview.md)** - Understand the big picture
2. **[Workflow Engine Design](./architecture/workflow-engine.md)** - Learn about the core execution model
3. **[CLI Documentation](./subsystems/cli/README.md)** - Get started using Unshallow

## 📖 Architecture Documentation

The architecture folder contains high-level design documents that explain the overall system structure and key design decisions:

- **[System Overview](./architecture/overview.md)**  
  Complete architectural overview including core components, design principles, and system boundaries

- **[Workflow Engine](./architecture/workflow-engine.md)**  
  Deep dive into the workflow execution engine, including node types, execution model, and state management

- **[Data Flow](./architecture/data-flow.md)**  
  How data moves through the system, including input/output handling, transformations, and persistence

- **[Extension Model](./architecture/extension-model.md)**  
  Plugin architecture, custom node development, and extension points

## 🔧 Subsystem Documentation

The subsystems folder contains detailed implementation documentation for each major component:

### Core Systems

- **[Core Engine](./subsystems/core/README.md)**  
  Implementation details of the workflow execution engine, including:
  - Node execution lifecycle
  - Error handling and recovery
  - Performance optimizations

- **[CLI Interface](./subsystems/cli/README.md)**  
  Command-line interface implementation:
  - Command structure and parsing
  - Interactive features
  - Output formatting

### Supporting Systems

- **[Configuration Management](./subsystems/config/README.md)**  
  How configuration is loaded, validated, and used throughout the system

- **[Storage Layer](./subsystems/storage/README.md)**  
  Data persistence implementation including:
  - Workflow definitions storage
  - Execution history
  - State management

- **[Utilities](./subsystems/utils/README.md)**  
  Shared utilities and helper functions used across the codebase

## 🎯 Finding What You Need

### By Topic

- **Want to understand the overall design?**  
  Start with [Architecture Overview](./architecture/overview.md)

- **Need to implement a new feature?**  
  Check the relevant subsystem documentation in [subsystems/](./subsystems/)

- **Looking for API references?**  
  Each subsystem folder contains detailed API documentation

- **Debugging an issue?**  
  See error handling sections in relevant subsystem docs

### By Role

- **New Contributors**  
  1. Read the [Architecture Overview](./architecture/overview.md)
  2. Set up your development environment (see project README)
  3. Pick a subsystem to explore in detail

- **Plugin Developers**  
  Focus on [Extension Model](./architecture/extension-model.md) and [Core Engine API](./subsystems/core/README.md)

- **System Integrators**  
  Start with [CLI Documentation](./subsystems/cli/README.md) and [Configuration Management](./subsystems/config/README.md)

## 📝 Documentation Conventions

- **Architecture docs** focus on the "why" and high-level "how"
- **Subsystem docs** provide implementation details and API references
- Code examples are provided throughout
- Diagrams illustrate complex concepts when helpful

## 🔄 Keeping Documentation Updated

Documentation is maintained alongside code changes. When making changes:

1. Update relevant subsystem documentation
2. Update architecture docs if design changes
3. Ensure examples remain accurate
4. Add new documentation for new features

---

For questions or contributions, please refer to the main project README or open an issue on our repository.