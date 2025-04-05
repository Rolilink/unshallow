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
      extraContextFile: options.contextFile,
      lintCheckCmd: options.lintCheckCmd || 'yarn lint:check',
      lintFixCmd: options.lintFixCmd || 'yarn lint:fix',
      tsCheckCmd: options.tsCheckCmd || 'yarn ts:check',
      testCmd: options.testCmd || 'yarn test'
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
        testCmd: config.testCmd
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

      // Write explanation to a markdown file if available
      if (result.file.fixExplanation) {
        const explanationPath = path.join(dirName, `${baseName}.explanation.md`);
        console.log(`Writing explanation to: ${explanationPath}`);

        // Format different fix histories if available
        let fixHistoriesSections = '';

        // Add fix plan section if available
        if (result.file.fixPlan) {
          fixHistoriesSections += `
## Fix Plan
**Generated on:** ${new Date(result.file.fixPlan.timestamp).toLocaleString()}

### Error Analysis
${result.file.fixPlan.explanation}

### Planned Fixes
${result.file.fixPlan.plan}

### Mocking Strategy
"No mocking information available."
`;
        }

        // Format RTL fix history if available
        if (result.file.rtlFixHistory && result.file.rtlFixHistory.length > 0) {
          fixHistoriesSections += `
## RTL Test Fix History
${result.file.rtlFixHistory.map((attempt) => `
### Attempt ${attempt.attempt} (${new Date(attempt.timestamp).toLocaleString()})

**Test Code:**
\`\`\`tsx
${attempt.testContentBefore}
\`\`\`

**Error:**
\`\`\`
${attempt.error}
\`\`\`

**Explanation:**
${attempt.explanation || "No explanation provided."}
`).join('\n')}
`;
        }

        // Format TS fix history if available
        if (result.file.tsFixHistory && result.file.tsFixHistory.length > 0) {
          fixHistoriesSections += `
## TypeScript Fix History
${result.file.tsFixHistory.map((attempt) => `
### Attempt ${attempt.attempt} (${new Date(attempt.timestamp).toLocaleString()})

**Test Code:**
\`\`\`tsx
${attempt.testContentBefore}
\`\`\`

**Error:**
\`\`\`
${attempt.error}
\`\`\`

**Explanation:**
${attempt.explanation || "No explanation provided."}
`).join('\n')}
`;
        }

        // Format Lint fix history if available
        if (result.file.lintFixHistory && result.file.lintFixHistory.length > 0) {
          fixHistoriesSections += `
## Lint Fix History
${result.file.lintFixHistory.map((attempt) => `
### Attempt ${attempt.attempt} (${new Date(attempt.timestamp).toLocaleString()})

**Test Code:**
\`\`\`tsx
${attempt.testContentBefore}
\`\`\`

**Error:**
\`\`\`
${attempt.error}
\`\`\`

**Explanation:**
${attempt.explanation || "No explanation provided."}
`).join('\n')}
`;
        }

        const explanationContent = `# Conversion Explanation for ${baseName}${ext}

${result.file.fixExplanation}

## Original Test
\`\`\`tsx
${result.file.content}
\`\`\`

## Converted Test
\`\`\`tsx
${result.file.rtlTest}
\`\`\`
${fixHistoriesSections}
`;

        await fs.writeFile(explanationPath, explanationContent, 'utf8');
      }

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
