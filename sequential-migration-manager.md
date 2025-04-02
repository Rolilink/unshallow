# Sequential Migration Manager

## Overview

The `SequentialMigrationManager` is a core component in the orchestration layer responsible for managing the file migration process in a sequential manner. It processes multiple files one at a time, ensuring that each file completes its migration workflow before moving on to the next one.

## Responsibilities

1. **Queue Management**: Maintains a queue of files to be processed
2. **Process Control**: Manages the sequential execution of file migrations
3. **State Tracking**: Tracks the current file being processed
4. **Event Coordination**: Works with the observer to emit state change events
5. **Error Handling**: Ensures errors in one file don't stop the entire process
6. **LangGraph Management**: Creates and manages LangGraph instances for each file

## Interface

```typescript
class SequentialMigrationManager {
  constructor(observer: LangGraphObserver);
  
  // Start migrating a batch of files sequentially
  async startMigration(filePaths: string[]): Promise<void>;
  
  // Stop the migration process
  stop(): void;
  
  // Get current migration stats
  getStats(): {
    total: number;
    remaining: number;
    currentlyProcessing: boolean;
    currentFile?: string;
  };
}
```

## Implementation Details

### State Management

```typescript
class SequentialMigrationManager {
  private observer: LangGraphObserver;
  private fileQueue: string[] = [];
  private currentGraph: StateGraph | null = null;
  private currentFile: string | null = null;
  private isProcessing: boolean = false;
  
  // ... implementation
}
```

The manager maintains:
- A queue of pending files
- Reference to the current graph instance
- Reference to the current file being processed
- Processing status flag

### Workflow Processing

```typescript
async startMigration(filePaths: string[]) {
  if (this.isProcessing) {
    throw new Error("Migration already in progress");
  }
  
  // Reset state
  this.fileQueue = [...filePaths];
  this.isProcessing = true;
  
  // Start with the first file
  this.processNextFile();
  
  // Return a promise that resolves when all files are processed
  return new Promise<void>((resolve) => {
    // ... implementation to resolve when complete
  });
}
```

When starting a migration:
1. The file paths are added to the queue
2. The processing flag is set
3. The first file is processed
4. A promise is returned that resolves when all files are complete

### Sequential Processing

```typescript
private async processNextFile() {
  if (this.fileQueue.length === 0) {
    this.currentGraph = null;
    this.currentFile = null;
    this.isProcessing = false;
    return;
  }
  
  const filePath = this.fileQueue.shift()!;
  this.currentFile = filePath;
  
  try {
    // Emit event to update state about the current file
    this.observer.emit('currentFileChanged', {
      filePath
    });
    
    // Create a new graph instance for this file
    const graph = await createMigrationGraph();
    this.currentGraph = graph;
    
    // Register it with the observer
    this.observer.observeGraph(graph, filePath);
    
    // Create initial state
    const initialState = this.createInitialState(filePath);
    
    // Start the workflow
    await graph.invoke({ file: initialState });
  } catch (error) {
    // Handle errors...
    
    // Continue with next file
    this.processNextFile();
  }
}
```

For each file:
1. The file is dequeued and set as the current file
2. A notification is sent about the current file changing
3. A new LangGraph instance is created for this file
4. The graph is registered with the observer
5. The workflow is invoked with the initial file state
6. When complete (or on error), the next file is processed

### Event Listening

The manager listens for completion and error events to automatically trigger the next file:

```typescript
constructor(observer: LangGraphObserver) {
  this.observer = observer;
  
  // Listen for file completion to process next file in queue
  this.observer.on('fileWorkflowComplete', () => {
    this.processNextFile();
  });
  
  this.observer.on('fileWorkflowError', () => {
    this.processNextFile();
  });
}
```

### Cancellation

Migration can be stopped by clearing the queue:

```typescript
stop() {
  this.fileQueue = [];
  // We can't easily stop the current graph once it's running,
  // but we can prevent processing new files
}
```

## Integration with Migration Service

The SequentialMigrationManager is controlled by the Migration Service, not directly by UI components:

```typescript
// Example of how the Migration Service uses the manager
class MigrationService {
  private manager: SequentialMigrationManager;
  
  constructor() {
    const observer = new LangGraphObserver();
    this.manager = new SequentialMigrationManager(observer);
  }
  
  async migrateFiles(filePaths: string[]) {
    return this.manager.startMigration(filePaths);
  }
  
  stopMigration() {
    this.manager.stop();
  }
  
  getMigrationStats() {
    return this.manager.getStats();
  }
}
```

The Migration Service:
1. Creates and owns the SequentialMigrationManager instance
2. Provides a clean API for controlling migrations
3. Acts as the bridge between CLI/API and the manager

## CLI Usage Example

The manager is used indirectly through the Migration Service from CLI commands:

```typescript
// Example CLI command handler
async function handleMigrateCommand(args) {
  const { files } = args;
  
  if (!files || files.length === 0) {
    console.error('No files specified for migration');
    process.exit(1);
  }
  
  try {
    const migrationService = new MigrationService();
    
    // Register callbacks for progress updates
    migrationService.on('progress', (stats) => {
      console.log(`Migrating file ${stats.current} of ${stats.total}`);
    });
    
    // Start migration
    await migrationService.migrateFiles(files);
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}
```

This architecture ensures that:
1. The manager focuses solely on orchestrating the migration process
2. It doesn't depend directly on UI components
3. It can be used in headless environments (CLI, server, etc.)
4. The observer pattern keeps UI updated without tight coupling 