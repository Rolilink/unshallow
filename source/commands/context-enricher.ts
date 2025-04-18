import * as path from 'path';
import { ContextEnricher } from '../context-enricher/index.js';
import { ConfigManager } from '../config/config-manager.js';
import * as fsSync from 'fs';

/**
 * Options for the context-enricher command
 */
export interface ContextEnricherOptions {
  importDepth?: string;
  examples?: string;
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

    // Ensure default context file exists
    const configManager = new ConfigManager();
    const contextFilePath = configManager.getDefaultContextFilePath();
    const contextDir = path.dirname(contextFilePath);

    if (!fsSync.existsSync(contextDir)) {
      fsSync.mkdirSync(contextDir, { recursive: true });
    }

    if (!fsSync.existsSync(contextFilePath)) {
      // Create default context file with template
      const templateContent = ``;
      fsSync.writeFileSync(contextFilePath, templateContent, 'utf8');
      console.log(`Created default context file at: ${contextFilePath}`);
    }

    // Resolve the test file path
    const absoluteTestFilePath = path.isAbsolute(testFilePath)
      ? testFilePath
      : path.resolve(projectRoot, testFilePath);

    // Configure options
    const enrichmentOptions = {
      importDepth: options.importDepth ? parseInt(options.importDepth, 10) : 1,
      exampleTests: options.examples ? options.examples.split(',').map(p => p.trim()) : undefined
    };

    // Log what we're going to do
    console.log('Enriching context for test file:', testFilePath);
    console.log('Options:', JSON.stringify(enrichmentOptions, null, 2));
    console.log('Using default context file at:', contextFilePath);

    try {
      // Process the test file asynchronously and get results
      const enrichedContext = await contextEnricher.enrichContext(absoluteTestFilePath, enrichmentOptions);

      const outputFormat = options.outputFormat || 'pretty';

      if (outputFormat === 'json') {
        // Convert Maps to objects for JSON serialization
        const jsonOutput = {
          testedComponent: enrichedContext.testedComponent,
          imports: enrichedContext.imports || [],
          // Handle potentially undefined maps with a fallback empty object
          componentImports: enrichedContext.componentImports ? Object.fromEntries(enrichedContext.componentImports) : {},
          relatedFiles: enrichedContext.relatedFiles ? Object.fromEntries(enrichedContext.relatedFiles) : {},
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

        // Display new structured imports
        console.log('\nStructured Imports:');
        if (enrichedContext.imports && enrichedContext.imports.length > 0) {
          enrichedContext.imports.forEach(imp => {
            console.log(`- ${imp.name} (${imp.isComponent ? 'component' : 'import'})`);
            console.log(`  Path relative to test: ${imp.pathRelativeToTest}`);
            if (imp.pathRelativeToComponent) {
              console.log(`  Path relative to component: ${imp.pathRelativeToComponent}`);
            }
          });
        } else {
          console.log('No structured imports found');
        }

        // Only display legacy imports if available
        if (enrichedContext.componentImports && enrichedContext.componentImports.size > 0) {
          console.log('\nComponent Imports (Legacy):');
          enrichedContext.componentImports.forEach((content, filePath) => {
            console.log(`- ${filePath}`);
            console.log('\nFile Content:');
            console.log('------------------------');
            console.log(content);
            console.log('------------------------\n');
          });
        }

        if (enrichedContext.relatedFiles && enrichedContext.relatedFiles.size > 0) {
          console.log('\nOther Related Files (Legacy):');
          enrichedContext.relatedFiles.forEach((content, filePath) => {
            console.log(`- ${filePath}`);
            console.log('\nFile Content:');
            console.log('------------------------');
            console.log(content);
            console.log('------------------------\n');
          });
        }

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
          console.log('\nExtra Context: Loaded from default context file');
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
