# LangGraph Workflow Refactor Plan

## Overview

This document outlines the step-by-step refactoring plan for enhancing the LangGraph workflow with reflective capabilities using LangChain PromptTemplates. The goal is to integrate new reflection and summarization steps into the workflow to improve the fix-attempt cycle while maintaining schema validation for structured outputs.

## Implementation Goals

1. Convert existing prompts to LangChain PromptTemplates
2. Update the OpenAI utility to support different model parameters (o3-mini vs. gpt-4o-mini)
3. Enhance the FileState interface to track reflection and attempt summaries
4. Create new nodes for reflection and summarization
5. Integrate these nodes into the workflow graph
6. Update existing nodes to use PromptTemplates

## Step-by-Step Refactoring Plan

### Step 1: Update Interface Definitions

Update the `FileState` interface to support reflection and summarization:

```typescript
// interfaces/index.ts
export interface FileState {
  // Existing fields...

  // Add new reflection fields
  lastReflection?: string;
  attemptSummary?: string;

  // Other fields...
}

// Update FixAttempt to use before/after test content
export interface FixAttempt {
  attempt: number;
  timestamp: string;
  testContentBefore: string; // Previous test content
  testContentAfter: string;  // Updated test content
  error: string;
  explanation?: string;
  plan?: {
    explanation: string;
    plan: string;
    // Remove mockingNeeded and mockStrategy fields
  };
  reflection?: string;
}

// Update FixPlan to remove unnecessary fields
export interface FixPlan {
  explanation: string;
  plan: string;
  // Remove mockingNeeded and mockStrategy fields
  timestamp: string;
}

// Add new workflow steps
export enum WorkflowStep {
  // Existing steps...
  REFLECTION = 'REFLECTION',
  SUMMARIZE_ATTEMPTS = 'SUMMARIZE_ATTEMPTS',
  // Other steps...
}
```

### Step 2: Define Response Schemas in Node Files

Create schema definitions based on the XML output formats already defined in the prompts:

```typescript
// nodes/reflection.ts
import { z } from "zod";

// Schema matching <output-format> in reflection-prompt.ts
export const reflectionSchema = z.object({
  reflection: z.string().describe("A rich reflection message with optional suggestions inline"),
  explanation: z.string().describe("A short, plain summary of the reflection for logging/debugging")
});

export type ReflectionResponse = z.infer<typeof reflectionSchema>;
```

```typescript
// nodes/summarize-attempts.ts
import { z } from "zod";

// Create schema based on the summarize-attempts-prompt.ts output format
export const summarizeAttemptsSchema = z.object({
  summary: z.string().describe("A concise summary of previous fix attempts"),
  explanation: z.string().describe("Short explanation of the patterns identified")
});

export type SummarizeAttemptsResponse = z.infer<typeof summarizeAttemptsSchema>;
```

```typescript
// nodes/plan-rtl-fix.ts
import { z } from "zod";

// Schema matching <output-format> in plan-rtl-fix-prompt.ts
export const rtlFixPlannerSchema = z.object({
  plan: z.string().describe("The revised XML plan"),
  explanation: z.string().describe("A short explanation of how this revision improves the test")
});

export type RtlFixPlannerResponse = z.infer<typeof rtlFixPlannerSchema>;
```

```typescript
// nodes/plan-rtl-conversion.ts
import { z } from "zod";

// Schema matching output format in plan-rtl-conversion-prompt.ts
export const rtlConversionPlannerSchema = z.object({
  plan: z.string().describe("The XML plan for conversion"),
  explanation: z.string().describe("A concise explanation of the Enzyme test's structure and what needs to be converted")
});

export type RtlConversionPlannerResponse = z.infer<typeof rtlConversionPlannerSchema>;
```

### Step 3: Update OpenAI Utility

Modify the OpenAI utility to use the XML output format in prompts, removing the need to append format instructions:

```typescript
// utils/openai.ts
export async function callOpenAIStructured<T extends z.ZodType>({
  prompt,
  schema,
  model = 'gpt-4o-mini',
  temperature = 0.2
}: {
  prompt: string;
  schema: T; // Schema is now required and passed from each node
  model?: string;
  temperature?: number;
}): Promise<z.infer<T>> {
  try {
    // Configure the LLM
    const llmOptions: any = {
      modelName: model,
      openAIApiKey: getApiKey(),
      callbacks: [langfuseCallbackHandler],
    };

    // Only add temperature for models that support it
    if (model !== 'o3-mini' && temperature !== undefined) {
      llmOptions.temperature = temperature;
    }

    const llm = new ChatOpenAI(llmOptions);

    // Use the LLM - note: No need to append format instructions as they are in the XML <output-format> tags
    const result = await llm.invoke([
      {
        type: "human",
        content: prompt
      }
    ]);

    // Parse the response
    const content = result.content.toString();
    console.log('Received response, parsing structured output...');

    // Create parser from schema
    const parser = StructuredOutputParser.fromZodSchema(schema);

    // Parse the response with the parser
    const parsedOutput = await parser.parse(content);
    console.log('Structured response successfully parsed');

    return parsedOutput;
  } catch (error) {
    console.error('Error in OpenAI structured response:', error);
    throw error;
  }
}
```

### Step 4: Convert Prompts to LangChain PromptTemplates

For each prompt file in the prompts directory, create a PromptTemplate that preserves the XML structure:

```typescript
// prompts/reflection-prompt.ts
import { PromptTemplate } from "langchain/prompts";

// Keep original export for backward compatibility
export const reflectionPrompt = `
<prompt>
<role>
You are a reflection agent, analyzing the most recent migration fix attempt for React Testing Library (RTL) tests.
Your job is to guide the planner by identifying errors in the test and providing insights on how to fix them. Help the planner avoid repeating the same mistakes and suggest strategies for better handling RTL testing challenges.
</role>

<goal>
Reflect on the errors in the test migration process, and provide insights and alternative strategies for fixing the RTL test issues. Ensure that future attempts break out of repetitive error patterns and improve the migration approach.
</goal>

{migrationGuidelines}

<context>
	<file-context>
		<test-file>{testFile}</test-file>
		<component-name>{componentName}</component-name>
		<component-source-code>{componentSourceCode}</component-source-code>
		<component-file-imports>{componentFileImports}</component-file-imports>
		<supporting-examples>{supportingExamples}</supporting-examples>
	</file-context>

	<user-instructions>
		The following instructions will override previous guidelines and give extra context for this specific test:
		{userInstructions}
	</user-instructions>

	<explanation>{explanation}</explanation>
	<last-attempt-error>{lastAttemptError}</last-attempt-error>
	<attempt-summary>{attemptSummary}</attempt-summary>
</context>

<reflection-format>
    <!-- Existing reflection format content -->
</reflection-format>

<output-format>
	Return a JSON object with the following structure:

	{
		reflection: string,   // A rich reflection message with optional suggestions inline.
		explanation: string   // A short, plain summary of the reflection for logging/debugging.
	}

	Only return the JSON object. Do not include markdown or extra commentary.
</output-format>
</prompt>
`;

// Add LangChain PromptTemplate, maintaining the XML structure
export const reflectionTemplate = PromptTemplate.fromTemplate(reflectionPrompt);
```

Repeat this pattern for all prompt files:
- plan-rtl-conversion-prompt.ts
- execute-rtl-conversion-prompt.ts
- plan-rtl-fix-prompt.ts
- execute-rtl-fix-prompt.ts
- reflection-prompt.ts
- summarize-attempts-prompt.ts

### Step 5: Implement Reflection Node

Create a new file for the reflection node using the XML-structured prompt:

```typescript
// nodes/reflection.ts
import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured } from '../utils/openai.js';
import { reflectionTemplate } from '../prompts/reflection-prompt.js';
import { reflectionSchema } from './schemas/reflection.js';
import { migrationGuidelinesTemplate } from '../prompts/migration-guidelines.js';

export const reflectionNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[reflection] Reflecting on test failure`);

  try {
    const lastAttempt = file.rtlFixHistory[file.rtlFixHistory.length - 1];

    // Get migration guidelines
    const migrationGuidelines = await migrationGuidelinesTemplate.format({});

    // Format the template using LangChain PromptTemplate
    const formattedPrompt = await reflectionTemplate.format({
      migrationGuidelines,
      testFile: file.rtlTest || file.originalTest,
      componentName: file.context.componentName,
      componentSourceCode: file.context.componentCode,
      componentFileImports: JSON.stringify(file.context.imports),
      supportingExamples: file.context.examples ? JSON.stringify(file.context.examples) : '',
      userInstructions: file.context.extraContext || '',
      explanation: lastAttempt.explanation || '',
      lastAttemptError: lastAttempt.error,
      attemptSummary: file.attemptSummary || ''
    });

    console.log(`[reflection] Calling OpenAI for reflection`);

    // Call OpenAI with the formatted prompt and reflection schema
    const response = await callOpenAIStructured({
      prompt: formattedPrompt,
      schema: reflectionSchema,
      model: 'o3-mini',
      temperature: undefined
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
```

### Step 6: Implement Remaining Nodes

Apply the same pattern to all other nodes, using the XML-structured prompts and node-specific schemas.

Each node should:
1. Import its prompt template
2. Import its schema definition
3. Format the prompt template with values from the state
4. Call OpenAI with the formatted prompt
5. Update the state with the response

### Step 7: Update Workflow Graph

Update the workflow graph to include the new nodes and edges:

```typescript
// index.ts or edges.ts
import { reflectionNode } from './nodes/reflection.js';
import { summarizeAttemptsNode } from './nodes/summarize-attempts.js';

// Add the nodes to the graph
const builder = new StateGraphBuilder({
  // ... existing configuration
});

// ... existing nodes

builder.addNode('REFLECTION', reflectionNode);
builder.addNode('SUMMARIZE_ATTEMPTS', summarizeAttemptsNode);

// Add edges for the new nodes
builder.addEdge('RUN_TEST_FAILED', 'REFLECTION');
builder.addEdge('REFLECTION', 'SUMMARIZE_ATTEMPTS');
builder.addEdge('SUMMARIZE_ATTEMPTS', 'PLAN_RTL_FIX');

// ... rest of graph configuration
```
