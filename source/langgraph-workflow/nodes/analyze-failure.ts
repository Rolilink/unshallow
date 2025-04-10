import { WorkflowState } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { analyzeFailurePrompt } from '../prompts/analyze-failure-prompt.js';
import { callOpenAIStructured } from '../utils/openai.js';
import { AnalyzeFailureOutputSchema } from '../interfaces/index.js';
import { migrationGuidelines } from '../prompts/migration-guidelines.js';
import { formatImports } from '../utils/format-utils.js';

// Create the PromptTemplate for the analyze-failure prompt
export const analyzeFailureTemplate = PromptTemplate.fromTemplate(analyzeFailurePrompt);

/**
 * Analyzes the selected test failure to determine fix approach
 */
export const analyzeFailureNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[analyze-failure] Analyzing test failure to determine fix approach`);

  try {
    // Check if there's a current error to analyze
    if (!file.currentError) {
      console.log(`[analyze-failure] No current error to analyze, skipping`);
      return {
        file,
      };
    }

    // Get the current error
    const currentError = file.currentError;

    // Format the prompt using the template
    const formattedPrompt = await analyzeFailureTemplate.format({
      testFile: file.rtlTest || '',
      componentName: file.context.componentName,
      componentSourceCode: file.context.componentCode,
      componentFileImports: formatImports(file.context.componentImports || {}),
      userProvidedContext: file.context.extraContext || '',
      previousTestCode: file.rtlTest || '',
      accessibilityDump: file.accessibilityDump || '',
      domTree: file.domTree || '',
      testName: currentError.testName,
      normalizedError: currentError.normalized,
      rawError: currentError.message,
      migrationGuidelines: migrationGuidelines
    });

    console.log(`[analyze-failure] Calling OpenAI to analyze test failure`);

    // Call OpenAI with the prompt
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: AnalyzeFailureOutputSchema,
      nodeName: 'analyze_failure'
    });

    console.log(`[analyze-failure] Analysis complete: ${response.fixIntent}`);

    // Return the updated state with the analysis
    return {
      file: {
        ...file,
        fixIntent: response.fixIntent,
        fixExplanation: response.explanation,
      },
    };
  } catch (error) {
    console.error(`[analyze-failure] Error: ${error instanceof Error ? error.message : String(error)}`);

    // If there's an error, continue with the workflow
    return {
      file: {
        ...file,
        fixIntent: 'Fix the test error (generated after analysis failure)',
      },
    };
  }
};
