# High-Level Architecture

## Overview

The application follows a layered architecture that separates concerns between the CLI layer, Migration Service, workflow engine, and React UI. The CLI acts only as an entry point, while the Migration Service initializes the UI, manages state, and coordinates the entire migration process.

## Architecture Diagram

```mermaid
graph TD
    %% Define all nodes with clear labels
    subgraph "CLI Layer"
        CLI[CLI Commands]
        MC[Migrate Command]
    end

    subgraph "Orchestration Layer"
        MS[Migration Service]
        SMM[SequentialMigrationManager]
        LGO[LangGraphObserver]
        CE[ContextEnricher]
    end

    subgraph "Workflow Layer"
        LG[LangGraph]
        FPN[File Processing Nodes]
        LLM[LLM Integration]
    end

    subgraph "State Management Layer"
        MContext[MigrationContext]
        MReducer[migrationReducer]
        ULGO[useLangGraphObserver]
    end

    subgraph "React UI Layer"
        RC[React Components]
        UCH[useContext Hooks]
    end

    %% CLI connections - simple command flow
    CLI --> MC
    MC -->|"calls"| MS

    %% Migration Service initializes everything
    MS -->|"initializes"| RC
    MS -->|"configures"| MContext
    MS -->|"creates"| SMM
    MS -->|"sets up"| LGO
    MS -->|"uses"| CE

    %% Context enrichment flow
    CE -->|"analyzes imports"| SMM

    %% Migration process flow
    SMM -->|"manages"| LG
    LG -->|"uses"| FPN
    FPN -->|"calls"| LLM

    %% State observation flow
    LG -.->|"state changes"| LGO
    LGO -.->|"emits events"| MS
    MS -.->|"updates"| ULGO
    ULGO -.->|"updates"| MContext
    MContext -.->|"provides state"| UCH
    UCH -.->|"consumes"| RC

    %% Style settings
    classDef central fill:#f96,stroke:#333,stroke-width:2px;
    classDef primary fill:#bbf,stroke:#33f,stroke-width:1px;
    classDef secondary fill:#ddf,stroke:#33f,stroke-width:1px;
    classDef highlight fill:#fdf,stroke:#939,stroke-width:1px;

    %% Apply styles to highlight key components
    class MS central;
    class CE,SMM,LGO,MContext primary;
    class LG,RC secondary;
    class CE highlight;
```

## Process Flow

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Service as Migration Service
    participant Context as ContextEnricher
    participant UI as React UI
    participant Manager as Sequential Manager
    participant LangGraph

    User->>CLI: migrate command
    CLI->>Service: migrateFiles(inputPath, config)

    Service->>UI: initialize React application

    %% Context enrichment process
    Service->>Context: enrichContext(testFile, importDepth)
    Context->>Context: parse AST
    Context->>Context: identify components
    Context->>Context: resolve imports recursively
    Context-->>Service: return enriched context

    Service->>Manager: set up migration manager
    Service->>Manager: process file with context

    Manager->>LangGraph: process file with component context
    LangGraph->>UI: update UI state via observer

    Manager-->>Service: report completion
    Service-->>CLI: return success/failure
    CLI-->>User: exit with code
```

This flow illustrates how:

1. CLI only initiates the process
2. Migration Service initializes the UI and manages the entire process
3. ContextEnricher provides rich component information through AST analysis
4. LangGraph uses this context for better migration results

## Key Components

### 1. CLI Layer

- **CLI Commands**: Command-line interface for starting migrations
- **Migrate Command**: Handles file path parsing and migration initiation

This layer serves as a minimal entry point, with no UI responsibilities.

### 2. Migration Service

- **Service API**: Central service that receives CLI commands and orchestrates everything
- **UI Initialization**: Starts the React application when migration begins
- **Context Management**: Uses ContextEnricher to analyze test files
- **Process Management**: Coordinates the entire migration process

This layer serves as the core of the application, responsible for initializing and managing all other components.

### 3. Context Enricher

- **AST Analysis**: Parses TypeScript/React test files using the TypeScript compiler API
- **Import Resolution**: Recursively analyzes imports at the specified depth
- **Component Detection**: Identifies which components are being tested
- **Context Building**: Creates a structured representation of components and their relationships

This specialized component provides the LLM with rich context about the components being tested.

### 4. Workflow Layer (LangGraph Engine)

- **LangGraph**: Handles the complex workflow of migrating a single file through various processing steps
- **File Processing Nodes**: Individual processing steps like RTL conversion, linting, and TypeScript checking
- **AST Import Analysis**: Parses and analyzes component imports to provide context for LLM
- **LLM Integration**: Nodes that leverage LLMs for code conversion and refactoring

This layer operates on a per-file basis, processing one file at a time through the migration workflow.

### 5. Orchestration Layer

- **SequentialMigrationManager**: Coordinates the sequential processing of multiple files
- **LangGraphObserver**: Monitors LangGraph state changes and emits events

This layer manages the processing of multiple files and provides state updates to the UI.

### 6. State Management Layer

- **MigrationContext**: Provides application-wide state using React Context
- **migrationReducer**: Manages state transitions based on observed events
- **useLangGraphObserver**: Custom hook that connects the UI to migration state updates

This layer maintains the state for the React UI, providing a real-time view of the migration.

### 7. React UI Layer

- **React Components**: UI components that display migration status and results
- **useContext Hooks**: Component-level hooks that access the shared state

This layer presents the migration process to the user but is initialized and controlled by the Migration Service.

## Responsibility Separation

### CLI

- Parse command-line arguments
- Validate input path
- Call Migration Service
- Exit with appropriate code

### Migration Service

- Initialize React UI
- Set up state management
- Create and configure SequentialMigrationManager
- Utilize ContextEnricher for test analysis
- Start the migration process
- Relay events between components

### ContextEnricher

- Parse test files using AST
- Detect components under test
- Analyze imports recursively
- Extract component props and types
- Build structured context for LLM

### SequentialMigrationManager

- Process files one by one
- Utilize enriched context for better migrations
- Manage LangGraph instances
- Track migration progress
- Report status to Migration Service

## Key Design Decisions

1. **CLI as Entry Point Only**: CLI just starts the process, Migration Service does everything else
2. **UI Initialization by Service**: React UI is started by the Migration Service, not separately
3. **Central Orchestration**: Migration Service initializes and coordinates all components
4. **Observable Process**: LangGraph state changes are observed and reflected in the UI
5. **Complete Encapsulation**: CLI doesn't need to know about UI, state, or migration details

This architecture ensures that the CLI remains a thin wrapper around the Migration Service, which handles all the complexity of the migration process including UI initialization, state management, and workflow coordination.

## Extension Points

The architecture allows for several extension points:

1. **Enhanced CLI Commands**: Additional command options or new commands
2. **Parallel Processing**: Could replace SequentialMigrationManager with a parallel version
3. **Different UI Technologies**: Could replace React with another UI framework
4. **Headless Operation**: Can run migrations without any UI attached
5. **Alternative LLM Integration**: LLM components can be swapped without affecting the architecture
