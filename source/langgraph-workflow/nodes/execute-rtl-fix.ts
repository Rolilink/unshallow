import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { executeRtlFixPrompt } from '../prompts/execute-rtl-fix-prompt.js';
import { callOpenAIStructured } from '../utils/openai.js';
import { ExecuteRtlFixOutputSchema } from '../interfaces/index.js';
import { migrationGuidelines } from '../prompts/migration-guidelines.js';
import path from 'path';
import * as fs from 'fs/promises';
import { formatImports } from '../utils/format-utils.js';

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

    // Format the prompt using the template
    const formattedPrompt = await executeRtlFixTemplate.format({
      testFile: file.rtlTest || '',
      componentName: file.context.componentName,
      componentSourceCode: file.context.componentCode,
      componentFileImports: formatImports(file.context.componentImports || {}),
      userProvidedContext: file.context.extraContext || '',
      testName: currentError.testName,
      normalizedError: currentError.normalized,
      rawError: currentError.message,
      accessibilityDump: file.accessibilityDump || '',
      domTree: file.domTree || '',
      previousTestCode: file.rtlTest || '',
      previousExplanation: file.fixExplanation || '',
      migrationGuidelines: migrationGuidelines
    });

    console.log(`[execute-rtl-fix] Calling OpenAI to execute fix`);

    // Call OpenAI with the prompt
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: ExecuteRtlFixOutputSchema,
      // Use o3-mini if reasoningExecution is enabled
      model: state.file.reasoningExecution ? 'o3-mini' : 'gpt-4o-mini',
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
