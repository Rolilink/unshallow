import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { formatComponentContext } from '../utils/format-context.js';
import { NodeResult } from '../interfaces/node.js';
import { logger } from '../utils/logging-callback.js';
import { artifactFileSystem } from '../utils/filesystem.js';

/**
 * Applies the context to the test file
 */
export const applyContextNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;
  const { context } = file;
  const NODE_NAME = 'apply-context';

  await logger.logNodeStart(NODE_NAME, `Enriching context for test`);

  try {
    await logger.info(NODE_NAME, `Applying context for component: ${context.componentName}`);

    // Log component details
    await logger.logComponent(NODE_NAME, context.componentName, context.componentCode);

    // Log all component imports
    await logger.info(NODE_NAME, `Found ${context.imports.length} imports in total`);

    // Log the component import specifically
    const componentImport = context.imports.find(imp => imp.isComponent);
    if (componentImport) {
      await logger.info(NODE_NAME, `Component import path: ${componentImport.pathRelativeToTest}`);
    }

    // Log example tests if available
    if (context.examples && Object.keys(context.examples).length > 0) {
      await logger.logExamples(NODE_NAME, context.examples);
    }

    // Use the template function to format the component context
    const componentContext = formatComponentContext(
      context.componentName,
      context.componentCode,
      context.imports,
      context.examples,
      context.extraContext
    );

    await logger.success(NODE_NAME, `Context enriched successfully (${componentContext.length} characters)`);

    // Check for retry mode and existing temp file
    if (file.retryMode) {
      if (artifactFileSystem.checkTempFileExists(file.path)) {
        await logger.info(NODE_NAME, `Retry mode: Found existing temp file for test ${file.path}`);

        try {
          // Read temp file content using the specific method
          const tempFileContent = await artifactFileSystem.readTempFile(file.path);

          await logger.success(NODE_NAME, `Retry mode: Loaded existing RTL test content (${tempFileContent.length} characters)`);

          // Return updated state with temp file content
          return {
            file: {
              ...file,
              componentContext,
              rtlTest: tempFileContent,  // Set the RTL test content from temp file
              currentStep: WorkflowStep.APPLY_CONTEXT,
            },
          };
        } catch (error) {
          await logger.error(NODE_NAME, `Retry mode: Error reading temp file`, error);
          // Continue without retry data if file can't be read
        }
      } else {
        await logger.info(NODE_NAME, `Retry mode: No existing temp file found for test ${file.path}`);
      }
    }

    // Update the file state with this context
    return {
      file: {
        ...file,
        componentContext,
        currentStep: WorkflowStep.APPLY_CONTEXT,
      },
    };
  } catch (error) {
    await logger.error(NODE_NAME, `Error applying context`, error);

    return {
      file: {
        ...file,
        error: error instanceof Error ? error : new Error(String(error)),
        currentStep: WorkflowStep.APPLY_CONTEXT,
      },
    };
  }
};
