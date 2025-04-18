import { WorkflowState } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { analyzeFailurePrompt } from '../prompts/analyze-failure-prompt.js';
import { callOpenAIStructured } from '../utils/openai.js';
import { AnalyzeFailureOutputSchema } from '../interfaces/index.js';
import { formatImports } from '../utils/format-utils.js';
import { logger } from '../utils/logging-callback.js';

// Create the PromptTemplate for the analyze-failure prompt
export const analyzeFailureTemplate = PromptTemplate.fromTemplate(analyzeFailurePrompt);

/**
 * Analyzes the selected test failure to determine fix approach
 */
export const analyzeFailureNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;
  const NODE_NAME = 'analyze-failure';

  // Get error name if available
  const errorName = file.currentError ? file.currentError.testName : 'unknown';
  await logger.logNodeStart(NODE_NAME, `Analyzing failure for: ${errorName}`);

  // Add progress logging
  await logger.progress(file.path, `Analyzing test failure: ${errorName}`, file.retries);

  try {
    // Check if there's a current error to analyze
    if (!file.currentError) {
      await logger.info(NODE_NAME, `No current error to analyze, skipping`);
      return {
        file,
      };
    }

    // Get the current error
    const currentError = file.currentError;

    // Log the full error details
    await logger.logErrors(NODE_NAME, currentError, "Error details");

    // Format the prompt using the template
    const formattedPrompt = await analyzeFailureTemplate.format({
      testFile: file.rtlTest || '',
      componentName: file.context.componentName,
      componentSourceCode: file.context.componentCode,
      componentFileImports: formatImports(file.context.imports || []),
      previousTestCode: file.rtlTest || '',
      accessibilityDump: file.accessibilityDump || '',
      domTree: file.domTree || '',
      testName: currentError.testName,
      normalizedError: currentError.normalized,
      rawError: currentError.message,
      userProvidedContext: file.context.extraContext || ''
    });

    await logger.info(NODE_NAME, `Calling OpenAI to analyze test failure`);

    // Call OpenAI with the prompt
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: AnalyzeFailureOutputSchema,
      model: state.file.reasoningReflection ? 'o4-mini' : 'gpt-4.1',
      nodeName: 'analyze_failure'
    });

    // Log the analysis results
    await logger.info(NODE_NAME, `Generated fix intent: ${response.fixIntent}`);
    await logger.info(NODE_NAME, `Explanation: ${response.explanation}`);
    await logger.success(NODE_NAME, `Analysis complete`);

    // Add progress logging for completion
    await logger.progress(file.path, `Analysis complete: ${response.fixIntent.substring(0, 50)}${response.fixIntent.length > 50 ? '...' : ''}`, file.retries);

    // Return the updated state with the analysis
    return {
      file: {
        ...file,
        fixIntent: response.fixIntent,
        fixExplanation: response.explanation,
      },
    };
  } catch (error) {
    await logger.error(NODE_NAME, `Error analyzing test failure`, error);

    // If there's an error, continue with the workflow
    return {
      file: {
        ...file,
        fixIntent: 'Fix the test error (generated after analysis failure)',
      },
    };
  }
};
