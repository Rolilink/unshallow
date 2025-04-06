import { WorkflowState } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { extractAccessibilitySnapshotPrompt } from '../prompts/extract-accessibility-snapshot-prompt.js';
import { callOpenAIStructured } from '../utils/openai.js';
import { ExtractAccessibilitySnapshotOutputSchema } from '../interfaces/fix-loop-interfaces.js';

// Create the PromptTemplate for the extract-accessibility-snapshot prompt
export const extractAccessibilitySnapshotTemplate = PromptTemplate.fromTemplate(extractAccessibilitySnapshotPrompt);

/**
 * Extracts accessibility snapshot information from test output
 */
export const extractAccessibilitySnapshotNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[extract-accessibility-snapshot] Extracting accessibility snapshot from test output`);

  try {
    // Check if there's a test result available
    if (!file.testResult) {
      console.log(`[extract-accessibility-snapshot] No test result available, skipping`);
      return {
        file: {
          ...file,
          accessibilityDump: '',
        },
      };
    }

    // Get the test output
    const jestOutput = file.testResult.output || '';

    // Format the prompt using the template
    const formattedPrompt = await extractAccessibilitySnapshotTemplate.format({
      jestOutput,
    });

    console.log(`[extract-accessibility-snapshot] Calling OpenAI to extract accessibility snapshot`);

    // Call OpenAI with the prompt
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: ExtractAccessibilitySnapshotOutputSchema,
      nodeName: 'extract_accessibility_snapshot'
    });

    console.log(`[extract-accessibility-snapshot] Extracted accessibility snapshot of length: ${response.accessibilityDump.length}`);

    // Return the updated state with the accessibility snapshot
    return {
      file: {
        ...file,
        accessibilityDump: response.accessibilityDump,
      },
    };
  } catch (error) {
    console.error(`[extract-accessibility-snapshot] Error: ${error instanceof Error ? error.message : String(error)}`);

    // If there's an error, continue with the workflow but with an empty accessibility dump
    return {
      file: {
        ...file,
        accessibilityDump: '',
      },
    };
  }
};
