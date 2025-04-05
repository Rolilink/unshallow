import { z } from "zod";
import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured } from '../utils/openai.js';
import { reflectionPrompt } from '../prompts/reflection-prompt.js';
import { PromptTemplate } from "@langchain/core/prompts";

// Create a schema that matches the <output-format> section in reflection-prompt.ts
export const reflectionSchema = z.object({
  reflection: z.string().describe("A rich reflection message with optional suggestions inline"),
  explanation: z.string().describe("A short, plain summary of the reflection for logging/debugging")
});

export type ReflectionResponse = z.infer<typeof reflectionSchema>;

// Create the PromptTemplate for the reflection prompt
export const reflectionTemplate = PromptTemplate.fromTemplate(reflectionPrompt);

export const reflectionNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[reflection] Reflecting on test failure`);

  try {
    // Check if rtlFixHistory exists and has items
    if (!file.rtlFixHistory || file.rtlFixHistory.length === 0) {
      console.log("[reflection] No fix history found, skipping");
      return {
        file: {
          ...file,
          currentStep: WorkflowStep.PLAN_RTL_FIX
        }
      };
    }

    const lastAttempt = file.rtlFixHistory[file.rtlFixHistory.length - 1];

    // Format the template using the PromptTemplate
    const formattedPrompt = await reflectionTemplate.format({
      testFile: file.rtlTest || file.originalTest,
      componentName: file.context.componentName,
      componentSourceCode: file.context.componentCode,
      componentFileImports: JSON.stringify(file.context.imports),
      supportingExamples: file.context.examples ? JSON.stringify(file.context.examples) : '',
      userInstructions: file.context.extraContext || '',
      explanation: lastAttempt?.explanation || '',
      lastAttemptError: lastAttempt?.error || '',
      attemptSummary: file.attemptSummary || '',
      migrationGuidelines: '', // This will be populated by the user in the prompts folder
    });

    console.log(`[reflection] Calling OpenAI for reflection`);

    // Call OpenAI with the formatted prompt and reflection schema
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: reflectionSchema,
      model: 'o3-mini'
    });

    console.log(`[reflection] Reflection: ${response.explanation}`);

    // Return updated state with reflection
    return {
      file: {
        ...file,
        lastReflection: response.reflection,
        currentStep: WorkflowStep.REFLECTION
      }
    };
  } catch (error) {
    console.error(`[reflection] Error: ${error instanceof Error ? error.message : String(error)}`);

    return {
      file: {
        ...file,
        error: error instanceof Error ? error : new Error(String(error)),
        currentStep: WorkflowStep.RUN_TEST_FAILED
      }
    };
  }
};
