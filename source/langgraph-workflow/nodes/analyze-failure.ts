import { WorkflowState } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { analyzeFailurePrompt } from '../prompts/analyze-failure-prompt.js';
import { callOpenAIStructured } from '../utils/openai.js';
import { AnalyzeFailureOutputSchema } from '../interfaces/fix-loop-interfaces.js';
import path from 'path';
import { migrationGuidelines } from '../prompts/migration-guidelines.js';

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

    // Get file extension and component path for better formatting
    const testFilePath = file.path;
    const componentPath = file.context.componentName ?
      `${file.context.componentName}${path.extname(testFilePath)}` :
      'Component.tsx';

    // Format the prompt using the template
    const formattedPrompt = await analyzeFailureTemplate.format({
      testFile: formatTestFile(file.rtlTest || '', path.basename(testFilePath)),
      componentName: file.context.componentName,
      componentSourceCode: formatComponentCode(
        file.context.componentCode,
        file.context.componentName,
        componentPath
      ),
      componentFileImports: formatImports(file.context.imports),
      previousTestCode: file.rtlTest || '',
      accessibilityDump: file.accessibilityDump || '',
      userFeedback: file.context.extraContext || '',
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
