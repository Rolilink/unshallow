/**
 * Handler for the migrate command
 */

import {ContextEnricher} from '../context-enricher/index.js';
import {processSingleFile} from '../langgraph-workflow/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import {ConfigManager} from '../config/config-manager.js';
import * as fsSync from 'fs';
import {discoverTestFiles} from '../discovery/test-file-discovery.js';
import {ParallelMigrationManager} from '../discovery/parallel-migration.js';

// Type definition for command options
export interface MigrateOptions {
	skipTsCheck?: boolean;
	skipLintCheck?: boolean;
	skipTestRun?: boolean;
	maxRetries?: string;
	pattern?: string;
	importDepth?: string;
	examples?: string;
	lintCheckCmd?: string;
	lintFixCmd?: string;
	tsCheckCmd?: string;
	testCmd?: string;
	reasoning?: boolean; // Use o4-mini for planning, execution, and reflection
	reasoningPlanning?: boolean; // Use o4-mini for planning steps only
	reasoningExecution?: boolean; // Use o4-mini for execution steps only
	reasoningReflection?: boolean; // Use o4-mini for reflection steps only
	retry?: boolean; // Retry from existing partial migration

	// New options for parallel migration
	concurrency?: number; // Number of files to process in parallel
	recursive?: boolean; // Whether to search subdirectories
	silent?: boolean; // Whether to suppress console output
}

/**
 * Handles the migrate command
 */
export async function handleMigrateCommand(
	inputPaths: string[],
	options: MigrateOptions,
): Promise<number> {
	try {
		// Get API key from config or command line
		const configManager = new ConfigManager();
		const apiKey = configManager.getOpenAIKey();

		if (!apiKey) {
			console.error('OpenAI API key is not configured.');
			console.error('Please set your API key with:');
			console.error('unshallow config:set-api-key YOUR_API_KEY');
			return 1;
		}

		// Ensure default context file exists
		const contextFilePath = configManager.getDefaultContextFilePath();
		const contextDir = path.dirname(contextFilePath);

		if (!fsSync.existsSync(contextDir)) {
			fsSync.mkdirSync(contextDir, {recursive: true});
		}

		if (!fsSync.existsSync(contextFilePath)) {
			// Create default context file with template
			const templateContent = `# Additional Context for Test Conversion

This file contains additional context that will be used by unshallow when converting Enzyme tests to React Testing Library.

## Component Behavior

Add information about specific component behaviors or quirks here.

## Testing Strategy

Add information about your preferred testing strategies here.

## Special Cases

Add information about special cases or edge cases here.

## Mocking Guidelines

Add information about mocking strategies and patterns here.

## Example Usage Patterns

Add common usage patterns for your components here.
`;
			fsSync.writeFileSync(contextFilePath, templateContent, 'utf8');
			console.log(`Created default context file at: ${contextFilePath}`);
		}

		// Check if we're dealing with multiple files or directories
		if (inputPaths.length === 0) {
			console.error('No input paths provided');
			return 1;
		}

		// At this point, we know inputPaths[0] exists
		const firstPath = inputPaths[0];
		// TypeScript needs this extra check
		if (typeof firstPath !== 'string') {
			console.error('Input path is not a string');
			return 1;
		}

		const isMultipleFiles =
			inputPaths.length > 1 || (await isDirectory(firstPath));

		if (isMultipleFiles) {
			// Process multiple files in parallel
			return await handleMultipleFiles(inputPaths, options);
		} else {
			// Process a single file (original behavior)
			return await handleSingleFile(firstPath, options);
		}
	} catch (error) {
		console.error('Migration command failed', error);
		return 1;
	}
}

/**
 * Handle migration of multiple files in parallel
 */
async function handleMultipleFiles(
	inputPaths: string[],
	options: MigrateOptions,
): Promise<number> {
	try {
		console.log('Discovering test files...');

		// Find all test files
		const files = await discoverTestFiles(inputPaths, {
			pattern: options.pattern || '**/*.{test,spec}.{ts,tsx,js,jsx}',
			recursive: options.recursive !== false, // Default to true
			retry: options.retry || false,
		});

		if (files.length === 0) {
			console.error('No Enzyme test files found matching criteria');
			return 1;
		}

		console.log(`Found ${files.length} Enzyme test files to migrate`);

		if (options.retry) {
			const filesWithTemp = files.filter(f => f.hasTempFile).length;
			if (filesWithTemp > 0) {
				console.log(
					`${filesWithTemp} file(s) have existing state and will use retry mode`,
				);
			}
		}

		// Create and run parallel manager
		const concurrency = options.concurrency || 5;
		console.log(`Starting parallel migration with concurrency: ${concurrency}`);

		const manager = new ParallelMigrationManager(files, options);
		const summary = await manager.runAll();

		// Format duration as minutes and seconds
		const durationFormatted = formatDuration(summary.totalDuration);

		// Display final report
		console.log('\nMigration Summary:');
		console.log(`Total files: ${summary.totalFiles}`);
		console.log(`Successful: ${summary.successful}`);
		console.log(`Failed: ${summary.failed}`);
		console.log(`Total duration: ${durationFormatted}`);

		// Calculate and display retry statistics
		const totalRetries = {
			rtl: 0,
			test: 0,
			ts: 0,
			lint: 0,
			total: 0,
		};

		summary.results.forEach(result => {
			if (result.retries) {
				totalRetries.rtl += result.retries.rtl;
				totalRetries.test += result.retries.test;
				totalRetries.ts += result.retries.ts;
				totalRetries.lint += result.retries.lint;
				totalRetries.total += result.retries.total;
			}
		});

		console.log('\nRetry Statistics:');
		console.log(`Total retries: ${totalRetries.total}`);
		console.log(`RTL fixes: ${totalRetries.rtl}`);
		console.log(`Test fixes: ${totalRetries.test}`);
		console.log(`TypeScript fixes: ${totalRetries.ts}`);
		console.log(`Lint fixes: ${totalRetries.lint}`);

		// Average retries per file
		const avgRetries = totalRetries.total / summary.totalFiles;
		console.log(`Average retries per file: ${avgRetries.toFixed(2)}`);

		// List failed files if any
		if (summary.failed > 0) {
			console.log('\nFailed migrations:');
			summary.results
				.filter(r => !r.success)
				.forEach(r => {
					const retryInfo = r.retries
						? `[Retries: ${r.retries.total} | RTL: ${r.retries.rtl}, Test: ${r.retries.test}, TS: ${r.retries.ts}, Lint: ${r.retries.lint}]`
						: '';
					console.log(`- ${r.relativePath} ${retryInfo}`);
					if (r.errorStep) console.log(`  Failed at: ${r.errorStep}`);
					if (r.error) console.log(`  Error: ${r.error.message}`);
				});
		}

		if (summary.metaReportPath) {
			console.log(
				'\n-------------------------------------------------------------------------',
			);
			console.log(
				'A meta report has been generated analyzing the migration failures:',
			);
			console.log(summary.metaReportPath);
			console.log(
				'Review this report to understand common failure patterns and improve future migrations',
			);
			console.log(
				'-------------------------------------------------------------------------\n',
			);
		}

		return summary.failed > 0 ? 1 : 0;
	} catch (error) {
		console.error('Error running parallel migration:', error);
		return 1;
	}
}

/**
 * Handle migration of a single file (original behavior)
 */
async function handleSingleFile(
	inputPath: string,
	options: MigrateOptions,
): Promise<number> {
	try {
		// Get project root
		const projectRoot = process.cwd();

		// Configure options for migration
		const config = {
			skipTs: options.skipTsCheck || false,
			skipLint: options.skipLintCheck || false,
			skipTest: options.skipTestRun || false,
			maxRetries: parseInt(options.maxRetries || '8', 10),
			pattern: options.pattern || '**/*.{test,spec}.{ts,tsx}',
			importDepth: parseInt(options.importDepth || '1', 10),
			exampleTests: options.examples
				? options.examples.split(',').map(path => path.trim())
				: undefined,
			lintCheckCmd: options.lintCheckCmd || 'yarn lint:check',
			lintFixCmd: options.lintFixCmd || 'yarn lint:fix',
			tsCheckCmd: options.tsCheckCmd || 'yarn ts:check',
			testCmd: options.testCmd || 'yarn test',
			// If --reasoning is provided, enable all reasoning options
			reasoningPlanning:
				options.reasoning || options.reasoningPlanning || false,
			reasoningExecution:
				options.reasoning || options.reasoningExecution || false,
			reasoningReflection:
				options.reasoning || options.reasoningReflection || false,
			retry: options.retry || false,
		};

		// Log command execution
		console.log('Executing migrate command with:');
		console.log('Path:', inputPath);

		// Verify the file exists
		const stats = await fs.stat(inputPath);
		if (!stats.isFile()) {
			console.error('Input path must be a file');
			return 1;
		}

		// Create context enricher
		const contextEnricher = new ContextEnricher(projectRoot);

		console.log('Enriching context for test file...');

		// Get component context
		const enrichedContext = await contextEnricher.enrichContext(inputPath, {
			importDepth: config.importDepth,
			exampleTests: config.exampleTests,
		});

		console.log(`Identified test file: ${enrichedContext.testedFile.fileName}`);
		console.log(
			`Found ${
				Object.keys(enrichedContext.testedFile.imports || {}).length
			} imports`,
		);

		// Process the file through the workflow
		console.log('Starting migration workflow...');

		const result = await processSingleFile(inputPath, enrichedContext, {
			maxRetries: config.maxRetries,
			skipTs: config.skipTs,
			skipLint: config.skipLint,
			skipTest: config.skipTest,
			lintCheckCmd: config.lintCheckCmd,
			lintFixCmd: config.lintFixCmd,
			tsCheckCmd: config.tsCheckCmd,
			testCmd: config.testCmd,
			// Pass only the specific reasoning flags
			reasoningPlanning: config.reasoningPlanning,
			reasoningExecution: config.reasoningExecution,
			reasoningReflection: config.reasoningReflection,
			retry: config.retry,
		});

		// Check if the migration was successful or not
		if (result && result.file) {
			if (result.file.status === 'success') {
				console.log('Migration completed successfully!');
				console.log(
					`Original file at ${inputPath} has been replaced with the migrated RTL test.`,
				);
			} else {
				console.log(`Migration completed with status: ${result.file.status}`);

				if (result.file.error) {
					console.error('Error:', result.file.error.message);
				}
			}

			if (result.file.metaReportPath) {
				console.log(
					'\n-------------------------------------------------------------------------',
				);
				console.log(
					'A meta report has been generated analyzing the migration failures:',
				);
				console.log(result.file.metaReportPath);
				console.log(
					'Review this report to understand common failure patterns and improve future migrations',
				);
				console.log(
					'-------------------------------------------------------------------------\n',
				);
			}

			return result.file.status === 'success' ? 0 : 1;
		} else {
			console.error('Migration failed - no result was returned');
			return 1;
		}
	} catch (error) {
		console.error('Migration command failed', error);
		return 1;
	}
}

/**
 * Check if a path is a directory
 */
async function isDirectory(path: string): Promise<boolean> {
	try {
		const stats = await fs.stat(path);
		return stats.isDirectory();
	} catch (error) {
		return false;
	}
}

/**
 * Format duration in milliseconds to minutes and seconds
 */
function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;

	return `${minutes}m ${remainingSeconds}s`;
}
