import { z } from "zod";
import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured } from '../utils/openai.js';
import { summarizeAttemptPrompt } from '../prompts/summarize-attempts-prompt.js';
import { PromptTemplate } from "@langchain/core/prompts";
import { migrationGuidelines } from "../prompts/migration-guidelines.js";

// Create a schema that matches the <output-format> section in summarize-attempts-prompt.ts
export const summarizeAttemptsSchema = z.object({
  summary: z.string().describe("A concise summary of previous fix attempts"),
  explanation: z.string().describe("Short explanation of the patterns identified")
});

export type SummarizeAttemptsResponse = z.infer<typeof summarizeAttemptsSchema>;

// Create the PromptTemplate for the summarize attempts prompt
export const summarizeAttemptsTemplate = PromptTemplate.fromTemplate(summarizeAttemptPrompt);

export const summarizeAttemptsNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[summarize-attempts] Summarizing fix attempts`);

  try {
    // Ensure rtlFixHistory exists
    if (!file.rtlFixHistory || file.rtlFixHistory.length === 0) {
      console.log("[summarize-attempts] No fix history found, skipping");
      return {
        file: {
          ...file,
          currentStep: WorkflowStep.PLAN_RTL_FIX
        }
      };
    }

    const lastAttempt = file.rtlFixHistory[file.rtlFixHistory.length - 1];

    // Format the template using the PromptTemplate
    const formattedPrompt = await summarizeAttemptsTemplate.format({
      testFile: file.rtlTest || file.originalTest,
      componentName: file.context.componentName,
      plan: lastAttempt?.plan?.plan || '',
      planExplanation: lastAttempt?.plan?.explanation || '',
      code: lastAttempt?.testContentAfter || '',
      error: lastAttempt?.error || '',
      reflection: file.lastReflection || '',
      previousSummary: file.attemptSummary || '',
      migrationGuidelines,
    });

    console.log(`[summarize-attempts] Calling OpenAI for summary`);

    // Call OpenAI with the formatted prompt and summarize attempts schema
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: summarizeAttemptsSchema,
      model: 'gpt-4o-mini',
      temperature: 0.2,
      nodeName: 'summarize_attempts'
    });

    console.log(`[summarize-attempts] Summary: ${response.explanation}`);

    // Return updated state with summary
    return {
      file: {
        ...file,
        attemptSummary: response.summary,
        currentStep: WorkflowStep.SUMMARIZE_ATTEMPTS
      }
    };
  } catch (error) {
    console.error(`[summarize-attempts] Error: ${error instanceof Error ? error.message : String(error)}`);

    return {
      file: {
        ...file,
        error: error instanceof Error ? error : new Error(String(error)),
        currentStep: WorkflowStep.REFLECTION
      }
    };
  }
};
