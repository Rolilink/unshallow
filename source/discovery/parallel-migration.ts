import { processSingleFile } from '../langgraph-workflow/index.js';
import { ContextEnricher } from '../context-enricher/index.js';
import { TestFileItem } from './test-file-discovery.js';
import { MigrateOptions } from '../commands/migrate.js';
import { logger } from '../langgraph-workflow/utils/logging-callback.js';
import { MigrationResult, MigrationSummary } from '../langgraph-workflow/interfaces/shared-types.js';
import * as path from 'path';
import * as fs from 'fs/promises';

// Import generateMetaReport function
import { generateMetaReport } from '../langgraph-workflow/utils/meta-report-generator.js';

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
    const summary: MigrationSummary = {
      totalFiles: this.completed.length,
      successful: this.completed.filter(r => r.success).length,
      failed: this.completed.filter(r => !r.success).length,
      skipped: 0, // For future use
      totalDuration: Date.now() - startTime,
      results: this.completed
    };

    // Clean up .unshallow directories if all migrations were successful
    if (summary.failed === 0 && summary.successful > 0) {
      await this.cleanupAllUnshallowDirs();
    } else if (summary.failed > 0) {
      // Generate meta report for failures
      console.log('\nGenerating meta report for failed migrations...');
      try {
        const metaReportPath = await generateMetaReport(summary);
        if (metaReportPath) {
          summary.metaReportPath = metaReportPath;
          console.log(`Meta report saved to: ${metaReportPath}`);
        }
      } catch (error) {
        console.error('Error generating meta report:', error instanceof Error ? error.message : String(error));
      }
    }

    return summary;
  }

  /**
   * Cleans up all .unshallow directories if all migrations were successful
   */
  private async cleanupAllUnshallowDirs(): Promise<void> {
    process.stdout.write('\nAll migrations successful, cleaning up .unshallow directories...\n');

    const unshallowDirs = new Set<string>();

    // Collect all unique .unshallow directories
    for (const result of this.completed) {
      const folderDir = path.dirname(result.filePath);
      const unshallowDir = path.join(folderDir, '.unshallow');
      unshallowDirs.add(unshallowDir);
    }

    // Clean up each directory
    let cleanedCount = 0;
    for (const dir of unshallowDirs) {
      try {
        if (await this.directoryExists(dir)) {
          await fs.rm(dir, { recursive: true, force: true });
          cleanedCount++;
        }
      } catch (error) {
        process.stdout.write(`Error cleaning up directory ${dir}: ${error instanceof Error ? error.message : String(error)}\n`);
      }
    }

    process.stdout.write(`Cleaned up ${cleanedCount} .unshallow ${cleanedCount === 1 ? 'directory' : 'directories'}\n`);
  }

  /**
   * Check if a directory exists
   */
  private async directoryExists(dir: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dir);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
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

        // Read original test content
        const originalEnzymeContent = await fs.readFile(file.path, 'utf8');

        // Process the file with the retry flag if temp file exists
        const result = await processSingleFile(
          file.path,
          {
            componentName: enrichedContext.testedComponent?.name || 'UnknownComponent',
            componentCode: enrichedContext.testedComponent?.content || '',
            imports: enrichedContext.imports || [],
            examples: enrichedContext.exampleTests ? Object.fromEntries(enrichedContext.exampleTests) : {},
            extraContext: enrichedContext.extraContext || '',
          },
          {
            // Pass all options from the command line
            maxRetries: parseInt(this.options.maxRetries || '8', 10),
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

        // Create enhanced migration result with additional data for meta report
        return {
          success: result.file.status === 'success',
          filePath: file.path,
          relativePath: file.relativePath,
          errorStep: result.file.currentStep,
          error: result.file.error,
          duration: Date.now() - startTime,
          retries,

          // Add specific error context
          testResult: result.file.testResult,
          tsCheck: result.file.tsCheck,
          lintCheck: result.file.lintCheck,

          // Add additional data for meta report
          originalEnzymeContent,
          rtlTestContent: result.file.rtlTest,
          planContent: result.file.fixPlan?.plan,
          componentName: enrichedContext.testedComponent?.name,
          componentContent: enrichedContext.testedComponent?.content,
          accessibilitySnapshot: result.file.accessibilityDump,
          domTree: result.file.domTree,
          imports: enrichedContext.imports,
          userContext: enrichedContext.extraContext
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
