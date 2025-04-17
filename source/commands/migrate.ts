/**
 * Handler for the migrate command
 */

import { ContextEnricher } from '../context-enricher/index.js';
import { processSingleFile } from '../langgraph-workflow/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigManager } from '../config/config-manager.js';
import * as fsSync from 'fs';

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
  reasoning?: boolean;            // Use o4-mini for planning, execution, and reflection
  reasoningPlanning?: boolean;    // Use o4-mini for planning steps only
  reasoningExecution?: boolean;   // Use o4-mini for execution steps only
  reasoningReflection?: boolean;  // Use o4-mini for reflection steps only
  retry?: boolean;                // Retry from existing partial migration
}

/**
 * Handles the migrate command for a single file
 */
export async function handleMigrateCommand(
  inputPath: string,
  options: MigrateOptions
): Promise<number> {
  try {
    // Get project root (current working directory)
    const projectRoot = process.cwd();

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
      fsSync.mkdirSync(contextDir, { recursive: true });
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

    // Configure options for migration
    const config = {
      skipTs: options.skipTsCheck || false,
      skipLint: options.skipLintCheck || false,
      skipTest: options.skipTestRun || false,
      maxRetries: parseInt(options.maxRetries || '15', 10),
      pattern: options.pattern || '**/*.{test,spec}.{ts,tsx}',
      importDepth: parseInt(options.importDepth || '1', 10),
      exampleTests: options.examples
        ? options.examples.split(',').map((path) => path.trim())
        : undefined,
      lintCheckCmd: options.lintCheckCmd || 'yarn lint:check',
      lintFixCmd: options.lintFixCmd || 'yarn lint:fix',
      tsCheckCmd: options.tsCheckCmd || 'yarn ts:check',
      testCmd: options.testCmd || 'yarn test',
      // If --reasoning is provided, enable all reasoning options
      reasoningPlanning: options.reasoning || options.reasoningPlanning || false,
      reasoningExecution: options.reasoning || options.reasoningExecution || false,
      reasoningReflection: options.reasoning || options.reasoningReflection || false,
      retry: options.retry || false
    };

    // Log command execution
    console.log('Executing migrate command with:');
    console.log('Path:', inputPath);

    // Verify the file exists
    const stats = await fs.stat(inputPath);
    if (!stats.isFile()) {
      console.error('Input path must be a file (directory support coming soon)');
      return 1;
    }

    // Create context enricher
    const contextEnricher = new ContextEnricher(projectRoot);

    console.log('Enriching context for test file...');

    // Get component context
    const enrichedContext = await contextEnricher.enrichContext(
      inputPath,
      {
        importDepth: config.importDepth,
        exampleTests: config.exampleTests
      }
    );

    console.log(`Identified component: ${enrichedContext.testedComponent.name}`);
    console.log(`Found ${enrichedContext.componentImports.size} direct imports and ${enrichedContext.relatedFiles.size} related files`);

    // Process the file through the workflow
    console.log('Starting migration workflow...');
    const result = await processSingleFile(
      inputPath,
      {
        componentName: enrichedContext.testedComponent?.name || 'UnknownComponent',
        componentCode: enrichedContext.testedComponent?.content || '',
        componentImports: Object.fromEntries(enrichedContext.componentImports || new Map()),
        imports: Object.fromEntries(contextEnricher.getRelatedFilesContent(enrichedContext)),
        examples: enrichedContext.exampleTests ? Object.fromEntries(enrichedContext.exampleTests) : {},
        extraContext: enrichedContext.extraContext || '',
      },
      {
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
        retry: config.retry
      }
    );

    // Check if the migration was successful or not
    if (result && result.file) {
      if (result.file.status === 'success') {
        console.log('Migration completed successfully!');
        console.log(`Original file at ${inputPath} has been replaced with the migrated RTL test.`);
      } else {
        console.log(`Migration completed with status: ${result.file.status}`);

        if (result.file.error) {
          console.error('Error:', result.file.error.message);
        }
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
