/**
 * Handler for the test-lint command
 */

import { ContextEnricher } from '../context-enricher/index.js';
import { testLintCycle } from '../langgraph-workflow/test-workflows.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigManager } from '../config/config-manager.js';

// Type definition for command options
export interface TestLintOptions {
  maxRetries?: string;
  lintCheckCmd?: string;
  lintFixCmd?: string;
  outputFile?: string;
}

/**
 * Handles the test-lint command for a single file
 */
export async function handleTestLintCommand(
  inputPath: string,
  options: TestLintOptions
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

    // Configure options for testing
    const config = {
      maxRetries: parseInt(options.maxRetries || '15', 10),
      lintCheckCmd: options.lintCheckCmd || 'yarn lint:check',
      lintFixCmd: options.lintFixCmd || 'yarn lint:fix',
    };

    // Log command execution
    console.log('Executing test-lint command with:');
    console.log('Path:', inputPath);
    console.log('Max retries:', config.maxRetries);
    console.log('Lint check command:', config.lintCheckCmd);
    console.log('Lint fix command:', config.lintFixCmd);

    // Verify the file exists
    const stats = await fs.stat(inputPath);
    if (!stats.isFile()) {
      console.error('Input path must be a file');
      return 1;
    }

    // Create context enricher
    const contextEnricher = new ContextEnricher(projectRoot);

    console.log('Creating minimal context for test file...');

    // Get minimal context (just enough for lint checking)
    const enrichedContext = await contextEnricher.enrichContext(inputPath, {
      importDepth: 0 // Minimal import depth
    });

    console.log(`Starting lint cycle test for: ${path.basename(inputPath)}`);

    // Run the lint cycle test
    const result = await testLintCycle(
      inputPath,
      {
        componentName: enrichedContext.testedComponent?.name || 'UnknownComponent',
        componentCode: enrichedContext.testedComponent?.content || '',
        imports: Object.fromEntries(enrichedContext.relatedFiles || new Map()),
        examples: {},
        extraContext: '',
      },
      {
        maxRetries: config.maxRetries,
        lintCheckCmd: config.lintCheckCmd,
        lintFixCmd: config.lintFixCmd,
      }
    );

    // Output the final state
    console.log('\n=== Test Summary ===');
    console.log(`Status: ${result.file.status}`);
    console.log(`Lint cycles: ${result.file.retries.lint}`);

    // If we have lint fix history, display it
    if (result.file.lintFixHistory && result.file.lintFixHistory.length > 0) {
      console.log(`\nFix attempts: ${result.file.lintFixHistory.length}`);
      result.file.lintFixHistory.forEach((attempt, index) => {
        console.log(`\nAttempt ${index + 1}:`);
        console.log(`Explanation: ${attempt.explanation || 'No explanation provided'}`);
      });
    }

    // Write the fixed content to an output file if specified
    if (options.outputFile && result.file.rtlTest) {
      const outputPath = options.outputFile;
      console.log(`\nWriting fixed content to: ${outputPath}`);
      await fs.writeFile(outputPath, result.file.rtlTest, 'utf8');
    }

    return result.file.status === 'success' ? 0 : 1;
  } catch (error) {
    console.error('Test lint command failed', error);
    return 1;
  }
}
