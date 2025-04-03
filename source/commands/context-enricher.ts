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
export function handleContextEnricherCommand(
  testFilePath: string,
  options: ContextEnricherOptions
): number {
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

    // Process the test file asynchronously and output results
    contextEnricher.enrichContext(absoluteTestFilePath, enrichmentOptions)
      .then(enrichedContext => {
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

          console.log('\nRelated Files:');
          enrichedContext.relatedFiles.forEach((_, filePath) => {
            console.log(`- ${filePath}`);
          });

          if (enrichedContext.exampleTests && enrichedContext.exampleTests.size > 0) {
            console.log('\nExample Tests:');
            enrichedContext.exampleTests.forEach((_, filePath) => {
              console.log(`- ${filePath}`);
            });
          }

          if (enrichedContext.extraContext) {
            console.log('\nExtra Context: Loaded from', options.contextFile);
          }
        }
      })
      .catch(error => {
        console.error('Error enriching context:', error.message);
        process.exit(1);
      });

    return 0; // Success
  } catch (error) {
    console.error('Context enrichment failed:', error);
    return 1; // Error
  }
}
