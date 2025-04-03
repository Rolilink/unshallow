/**
 * Handler for the migrate command
 */

import { ContextEnricher } from '../context-enricher/index.js';
import { processSingleFile } from '../langgraph-workflow/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigManager } from '../config/config-manager.js';

// Type definition for command options
export interface MigrateOptions {
  skipTsCheck?: boolean;
  skipLintCheck?: boolean;
  skipTestRun?: boolean;
  maxRetries?: string;
  pattern?: string;
  importDepth?: string;
  examples?: string;
  contextFile?: string;
  lintCheckCmd?: string;
  lintFixCmd?: string;
  tsCheckCmd?: string;
  testCmd?: string;
  apiKey?: string;
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
    const apiKey = options.apiKey || configManager.getOpenAIKey();

    if (!apiKey) {
      console.error('OpenAI API key is not configured.');
      console.error('Please set your API key with:');
      console.error('unshallow config:set-api-key YOUR_API_KEY');
      return 1;
    }

    // Configure options for migration
    const config = {
      skipTs: options.skipTsCheck || false,
      skipLint: options.skipLintCheck || false,
      skipTest: options.skipTestRun || false,
      maxRetries: parseInt(options.maxRetries || '3', 10),
      pattern: options.pattern || '**/*.{test,spec}.{ts,tsx}',
      importDepth: parseInt(options.importDepth || '1', 10),
      exampleTests: options.examples
        ? options.examples.split(',').map((path) => path.trim())
        : undefined,
      extraContextFile: options.contextFile,
      lintCheckCmd: options.lintCheckCmd || 'yarn lint:check',
      lintFixCmd: options.lintFixCmd || 'yarn lint:fix',
      tsCheckCmd: options.tsCheckCmd || 'yarn ts:check',
      testCmd: options.testCmd || 'yarn test',
      apiKey
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
        exampleTests: config.exampleTests,
        extraContextFile: config.extraContextFile,
      }
    );

    console.log(`Identified component: ${enrichedContext.testedComponent.name}`);
    console.log(`Found ${enrichedContext.relatedFiles.size} related files`);

    // Process the file through the workflow
    console.log('Starting migration workflow...');
    const result = await processSingleFile(
      inputPath,
      {
        componentName: enrichedContext.testedComponent.name,
        componentCode: enrichedContext.testedComponent.content,
        imports: Object.fromEntries(enrichedContext.relatedFiles),
        examples: enrichedContext.exampleTests
          ? Object.fromEntries(enrichedContext.exampleTests)
          : {},
        extraContext: enrichedContext.extraContext,
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
        apiKey: config.apiKey,
      }
    );

    // Output the generated RTL test
    if (result && result.file && result.file.rtlTest) {
      // Generate output path (same name but with .rtl.tsx extension)
      const ext = path.extname(inputPath);
      const baseName = path.basename(inputPath, ext);
      const dirName = path.dirname(inputPath);
      const outputPath = path.join(dirName, `${baseName}.rtl${ext}`);

      console.log(`Writing migrated test to: ${outputPath}`);
      await fs.writeFile(outputPath, result.file.rtlTest, 'utf8');

      if (result.file.status === 'success') {
        console.log('Migration completed successfully!');
      } else {
        console.log('Migration completed with some issues. Check the output file.');
      }

      return 0;
    } else {
      console.error('Migration failed - no RTL test was generated');
      if (result && result.file && result.file.error) {
        console.error('Error:', result.file.error.message);
      }
      return 1;
    }
  } catch (error) {
    console.error('Migration command failed', error);
    return 1;
  }
}
