import { processSingleFile } from '../langgraph-workflow/index.js';
import { ContextEnricher } from '../context-enricher/index.js';
import { TestFileItem } from './test-file-discovery.js';
import { MigrateOptions } from '../commands/migrate.js';
import { WorkflowStep } from '../langgraph-workflow/interfaces/index.js';
import { logger } from '../langgraph-workflow/utils/logging-callback.js';

/**
 * Result of a single file migration
 */
export interface MigrationResult {
  success: boolean;
  filePath: string;
  relativePath: string;
  errorStep?: WorkflowStep;
  error?: Error;
  duration: number;
  retries?: {
    rtl: number;
    test: number;
    ts: number;
    lint: number;
    total: number;
  };
}

/**
 * Summary of all migrations
 */
export interface MigrationSummary {
  totalFiles: number;
  successful: number;
  failed: number;
  skipped: number;
  totalDuration: number;
  results: MigrationResult[];
}

/**
 * Manages parallel migration of multiple test files
 */
export class ParallelMigrationManager {
  private queue: TestFileItem[] = [];
  private active: Map<string, TestFileItem> = new Map();
  private completed: MigrationResult[] = [];
  private concurrency: number;
  private options: MigrateOptions;
  private fileProgress: Map<string, {
    retries: {
      rtl: number;
      test: number;
      ts: number;
      lint: number;
    }
  }> = new Map();

  constructor(files: TestFileItem[], options: MigrateOptions) {
    this.queue = [...files];
    this.concurrency = options.concurrency || 5;
    this.options = options;

    // Initialize progress tracking for each file
    files.forEach(file => {
      this.fileProgress.set(file.path, {
        retries: { rtl: 0, test: 0, ts: 0, lint: 0 }
      });
    });
  }

  /**
   * Get a formatted string showing retry counts
   */
  private getRetryCountsDisplay(retries: { rtl: number; test: number; ts: number; lint: number }): string {
    const totalRetries = retries.rtl + retries.test + retries.ts + retries.lint;
    return `[Retries: ${totalRetries} | RTL: ${retries.rtl}, Test: ${retries.test}, TS: ${retries.ts}, Lint: ${retries.lint}]`;
  }

  /**
   * Run migrations for all test files
   */
  async runAll(): Promise<MigrationSummary> {
    const startTime = Date.now();

    // Set logger to silent mode to prevent console output from nodes
    logger.setSilent(true);

    // Create initial batch of workers
    const workers: Array<{promise: Promise<MigrationResult>, filePath: string}> = [];

    // Start initial workers up to concurrency limit
    while (this.queue.length > 0 && workers.length < this.concurrency) {
      const file = this.queue.shift()!;
      const worker = this.createWorker(file);
      workers.push(worker);
      this.active.set(file.path, file);

      // Log that migration is starting
      console.log(`Starting migration: ${file.relativePath}`);
    }

    // Process queue until all files are complete
    while (workers.length > 0) {
      // Wait for the next worker to complete
      const completed = await Promise.race(
        workers.map(w => w.promise.then(result => ({result, filePath: w.filePath})))
      );

      // Remove completed worker from active list
      const index = workers.findIndex(w => w.filePath === completed.filePath);
      workers.splice(index, 1);
      this.active.delete(completed.filePath);

      // Store result
      this.completed.push(completed.result);

      // Log completion with retry counts
      const retryInfo = completed.result.retries
        ? this.getRetryCountsDisplay(completed.result.retries)
        : '';

      if (completed.result.success) {
        console.log(`✅ Migrated: ${completed.result.relativePath} ${retryInfo}`);
      } else {
        console.log(`❌ Failed: ${completed.result.relativePath} ${completed.result.errorStep ? `(${completed.result.errorStep})` : ''} ${retryInfo}`);
      }

      // If more files, start another worker
      if (this.queue.length > 0) {
        const file = this.queue.shift()!;
        const worker = this.createWorker(file);
        workers.push(worker);
        this.active.set(file.path, file);

        // Log that migration is starting
        console.log(`Starting migration: ${file.relativePath}`);
      }
    }

    // Generate summary
    return {
      totalFiles: this.completed.length,
      successful: this.completed.filter(r => r.success).length,
      failed: this.completed.filter(r => !r.success).length,
      skipped: 0, // For future use
      totalDuration: Date.now() - startTime,
      results: this.completed
    };
  }

  /**
   * Create a worker to process a single test file
   */
  private createWorker(file: TestFileItem): {promise: Promise<MigrationResult>, filePath: string} {
    const startTime = Date.now();

    // Create context enricher
    const contextEnricher = new ContextEnricher(process.cwd());

    // Start migration process
    const promise = (async () => {
      try {
        // Get component context
        const enrichedContext = await contextEnricher.enrichContext(file.path, {
          importDepth: parseInt(this.options.importDepth || '1', 10),
          exampleTests: this.options.examples?.split(',')
        });

        // Process the file with the retry flag if temp file exists
        const result = await processSingleFile(
          file.path,
          {
            componentName: enrichedContext.testedComponent?.name || 'UnknownComponent',
            componentCode: enrichedContext.testedComponent?.content || '',
            componentImports: Object.fromEntries(enrichedContext.componentImports || new Map()),
            imports: Object.fromEntries(contextEnricher.getRelatedFilesContent(enrichedContext)),
            examples: enrichedContext.exampleTests ? Object.fromEntries(enrichedContext.exampleTests) : {},
            extraContext: enrichedContext.extraContext || '',
          },
          {
            // Pass all options from the command line
            maxRetries: parseInt(this.options.maxRetries || '20', 10),
            skipTs: this.options.skipTsCheck || false,
            skipLint: this.options.skipLintCheck || false,
            skipTest: this.options.skipTestRun || false,
            lintCheckCmd: this.options.lintCheckCmd,
            lintFixCmd: this.options.lintFixCmd,
            tsCheckCmd: this.options.tsCheckCmd,
            testCmd: this.options.testCmd,
            // Set retry flag based on temp file existence
            retry: this.options.retry && file.hasTempFile,
            // Pass reasoning flags
            reasoningPlanning: this.options.reasoningPlanning || this.options.reasoning,
            reasoningExecution: this.options.reasoningExecution || this.options.reasoning,
            reasoningReflection: this.options.reasoningReflection || this.options.reasoning,
            // Enable silent mode to prevent console output from nodes
            silent: true
          }
        );

        // Track the retry counts for this file
        const retries = {
          rtl: result.file.retries.rtl,
          test: result.file.retries.test,
          ts: result.file.retries.ts,
          lint: result.file.retries.lint,
          total: result.file.retries.rtl + result.file.retries.test + result.file.retries.ts + result.file.retries.lint
        };

        return {
          success: result.file.status === 'success',
          filePath: file.path,
          relativePath: file.relativePath,
          errorStep: result.file.currentStep,
          error: result.file.error,
          duration: Date.now() - startTime,
          retries
        };
      } catch (error) {
        return {
          success: false,
          filePath: file.path,
          relativePath: file.relativePath,
          error: error instanceof Error ? error : new Error(String(error)),
          duration: Date.now() - startTime
        };
      }
    })();

    return { promise, filePath: file.path };
  }
}
