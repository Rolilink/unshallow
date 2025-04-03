import * as path from 'path';
import { ContextEnricher } from '../context-enricher/index.js';

/**
 * Options for the context-enricher command
 */
export interface ContextEnricherOptions {
  importDepth?: string;
  examples?: string;
  contextFile?: string;
  outputFormat?: string;
}

/**
 * Handles the context-enricher command
 */
export async function handleContextEnricherCommand(
  testFilePath: string,
  options: ContextEnricherOptions
): Promise<number> {
  try {
    // Get the project root (current working directory)
    const projectRoot = process.cwd();

    // Create the context enricher
    const contextEnricher = new ContextEnricher(projectRoot);

    // Resolve the test file path
    const absoluteTestFilePath = path.isAbsolute(testFilePath)
      ? testFilePath
      : path.resolve(projectRoot, testFilePath);

    // Configure options
    const enrichmentOptions = {
      importDepth: options.importDepth ? parseInt(options.importDepth, 10) : 1,
      exampleTests: options.examples ? options.examples.split(',').map(p => p.trim()) : undefined,
      extraContextFile: options.contextFile
    };

    // Log what we're going to do
    console.log('Enriching context for test file:', testFilePath);
    console.log('Options:', JSON.stringify(enrichmentOptions, null, 2));

    try {
      // Process the test file asynchronously and get results
      const enrichedContext = await contextEnricher.enrichContext(absoluteTestFilePath, enrichmentOptions);

      const outputFormat = options.outputFormat || 'pretty';

      if (outputFormat === 'json') {
        // Convert Maps to objects for JSON serialization
        const jsonOutput = {
          testedComponent: enrichedContext.testedComponent,
          relatedFiles: Object.fromEntries(enrichedContext.relatedFiles),
          exampleTests: enrichedContext.exampleTests
            ? Object.fromEntries(enrichedContext.exampleTests)
            : undefined,
          extraContext: enrichedContext.extraContext
        };

        console.log(JSON.stringify(jsonOutput, null, 2));
      } else {
        // Pretty print format
        console.log('\nEnriched Context Results:');
        console.log('------------------------');

        console.log(`\nTested Component: ${enrichedContext.testedComponent.name}`);
        console.log(`Component File: ${enrichedContext.testedComponent.filePath}`);

        console.log('\nComponent Content:');
        console.log('------------------------');
        console.log(enrichedContext.testedComponent.content);
        console.log('------------------------\n');

        console.log('\nRelated Files:');
        enrichedContext.relatedFiles.forEach((content, filePath) => {
          console.log(`- ${filePath}`);
          console.log('\nFile Content:');
          console.log('------------------------');
          console.log(content);
          console.log('------------------------\n');
        });

        if (enrichedContext.exampleTests && enrichedContext.exampleTests.size > 0) {
          console.log('\nExample Tests:');
          enrichedContext.exampleTests.forEach((content, filePath) => {
            console.log(`- ${filePath}`);
            console.log('\nExample Test Content:');
            console.log('------------------------');
            console.log(content);
            console.log('------------------------\n');
          });
        }

        if (enrichedContext.extraContext) {
          console.log('\nExtra Context: Loaded from', options.contextFile);
          console.log('\nExtra Context Content:');
          console.log('------------------------');
          console.log(enrichedContext.extraContext);
          console.log('------------------------\n');
        }
      }

      return 0; // Success
    } catch (error: any) {
      console.error('Error enriching context:', error.message);
      return 1; // Error
    }
  } catch (error) {
    console.error('Context enrichment failed:', error);
    return 1; // Error
  }
}
