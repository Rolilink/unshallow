import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { executeRtlFixPrompt } from '../prompts/execute-rtl-fix-prompt.js';
import { callOpenAIStructured } from '../utils/openai.js';
import { ExecuteRtlFixOutputSchema } from '../interfaces/fix-loop-interfaces.js';
import { migrationGuidelines } from '../prompts/migration-guidelines.js';
import path from 'path';
import * as fs from 'fs/promises';

// Helper functions to format code with appropriate syntax highlighting
function formatTestFile(content: string, filename: string): string {
  const extension = path.extname(filename).slice(1);
  return `\`\`\`${extension}\n// ${filename}\n${content}\n\`\`\``;
}

function formatComponentCode(content: string, componentName: string, componentPath: string): string {
  const extension = path.extname(componentPath).slice(1);
  return `\`\`\`${extension}\n// ${componentPath} (${componentName})\n${content}\n\`\`\``;
}

function formatImports(imports: Record<string, string> | undefined): string {
  if (!imports || Object.keys(imports).length === 0) return '{}';

  let result = '';
  for (const [importPath, content] of Object.entries(imports)) {
    const extension = path.extname(importPath).slice(1);
    result += `\`\`\`${extension}\n// Imported by the component: ${importPath}\n${content}\n\`\`\`\n\n`;
  }
  return result;
}

// Create the PromptTemplate for the execute-rtl-fix prompt
export const executeRtlFixTemplate = PromptTemplate.fromTemplate(executeRtlFixPrompt);

/**
 * Executes the fix for the selected test failure
 */
export const executeRtlFixNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[execute-rtl-fix] Executing fix for test failure`);

  try {
    // Check if there's a current error to fix
    if (!file.currentError) {
      console.log(`[execute-rtl-fix] No current error to fix, skipping`);
      return {
        file,
      };
    }

    // Ensure we have fix intent
    if (!file.fixIntent) {
      console.log(`[execute-rtl-fix] No fix intent available, using default`);
      file.fixIntent = 'Fix the failing test';
    }

    // Get the current error
    const currentError = file.currentError;

    // Get file extension and component path for better formatting
    const testFilePath = file.path;
    const componentPath = file.context.componentName ?
      `${file.context.componentName}${path.extname(testFilePath)}` :
      'Component.tsx';

    // Format the prompt using the template
    const formattedPrompt = await executeRtlFixTemplate.format({
      testFile: formatTestFile(file.rtlTest || '', path.basename(testFilePath)),
      componentName: file.context.componentName,
      componentSourceCode: formatComponentCode(
        file.context.componentCode,
        file.context.componentName,
        componentPath
      ),
      componentFileImports: formatImports(file.context.imports),
      userFeedback: file.context.extraContext || '',
      testName: currentError.testName,
      normalizedError: currentError.normalized,
      rawError: currentError.message,
      accessibilityDump: file.accessibilityDump || '',
      previousTestCode: file.rtlTest || '',
      previousExplanation: file.fixExplanation || '',
      migrationGuidelines: migrationGuidelines
    });

    console.log(`[execute-rtl-fix] Calling OpenAI to execute fix`);

    // Call OpenAI with the prompt
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: ExecuteRtlFixOutputSchema,
      nodeName: 'execute_rtl_fix'
    });

    console.log(`[execute-rtl-fix] Fix executed, updated test file`);

    // Create temporary file for testing
    const tempDir = path.dirname(file.path);
    const tempFile = file.tempPath || path.join(tempDir, `${path.basename(file.path, path.extname(file.path))}.temp${path.extname(file.path)}`);

    // Write the updated test to the temp file
    await fs.writeFile(tempFile, response.updatedTestFile);

    // Return the updated state with the fixed test
    return {
      file: {
        ...file,
        rtlTest: response.updatedTestFile,
        fixExplanation: response.fixExplanation,
        tempPath: tempFile,
        currentStep: WorkflowStep.RUN_TEST, // Go back to running the test
      },
    };
  } catch (error) {
    console.error(`[execute-rtl-fix] Error: ${error instanceof Error ? error.message : String(error)}`);

    // If there's an error, continue with the workflow
    return {
      file: {
        ...file,
        error: error instanceof Error ? error : new Error(String(error)),
      },
    };
  }
};
