import { WorkflowState, WorkflowStep, FixAttempt } from '../interfaces/index.js';
import { NodeResult } from '../interfaces/node.js';
import { callOpenAIStructured } from '../utils/openai.js';

/**
 * Formats fix history into a string for the prompt
 */
function formatFixHistory(history: FixAttempt[]): string {
  if (!history || history.length === 0) {
    return "No previous fix attempts.";
  }

  return history.map((attempt) => {
    return `
### Fix Attempt ${attempt.attempt}
**Timestamp:** ${attempt.timestamp}

**Code:**
\`\`\`tsx
${attempt.testContent}
\`\`\`

**Resulting Error:**
\`\`\`
${attempt.error}
\`\`\`

**Explanation of Changes:**
${attempt.explanation || "No explanation provided."}
`;
  }).join("\n");
}

/**
 * Formats related imports into a string for the prompt
 */
function formatRelatedImports(imports: Record<string, string>): string {
  if (!imports || Object.keys(imports).length === 0) {
    return "No related imports available.";
  }

  return Object.entries(imports).map(([path, content]) => `
### ${path}
\`\`\`tsx
${content}
\`\`\`
`).join('\n');
}

/**
 * Fixes TypeScript errors in the RTL test
 */
export const fixTsErrorNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;

  console.log(`[fix-ts-error] Fixing TypeScript (retry ${file.retries.ts + 1}/${file.maxRetries})`);

  // Check if we've reached max retries
  if (file.retries.ts >= file.maxRetries) {
    console.log(`[fix-ts-error] Max retries reached (${file.maxRetries})`);
    return {
      file: {
        ...file,
        status: 'failed',
        error: new Error(`Maximum retry limit reached (${file.maxRetries}) for TypeScript fixes`),
        currentStep: WorkflowStep.TS_VALIDATION_FAILED,
      },
    };
  }

  try {
    const tsErrors = file.tsCheck?.errors?.join('\n') || 'Unknown TypeScript errors';

    // Initialize TS fix history if it doesn't exist
    const tsFixHistory = file.tsFixHistory || [];

    // If we have a current test and it's not the first attempt, add it to history
    if (file.rtlTest && file.retries.ts > 0) {
      // Add the current attempt to history
      tsFixHistory.push({
        attempt: file.retries.ts,
        timestamp: new Date().toISOString(),
        testContent: file.rtlTest,
        error: tsErrors,
        explanation: file.fixExplanation
      });

      console.log(`[fix-ts-error] Added attempt ${file.retries.ts} to TS fix history (${tsFixHistory.length} total attempts)`);
    }

    // Format fix history for the prompt
    const fixHistoryText = formatFixHistory(tsFixHistory);

    // Format related imports for the prompt
    const relatedImportsText = formatRelatedImports(file.context.imports);

    // Generate the prompt for fixing TS errors
    const prompt = `
Act as a senior React developer with strong TypeScript expertise. You are reviewing a React Testing Library test that contains TypeScript errors. Your task is to fix only those errors within the test file.

You are allowed to read the related imported files provided below to help resolve type issues, but you must not modify them or assume any changes to them.

## Original Component
\`\`\`tsx
${file.context.componentCode}
\`\`\`

## Related Imports (read-only for context)
${relatedImportsText}

## Current RTL Test Code
\`\`\`tsx
${file.rtlTest}
\`\`\`

## TypeScript Errors
\`\`\`
${tsErrors}
\`\`\`

## Previous Fix Attempts
${fixHistoryText}

## Instructions

1. Fix only the TypeScript errors in the RTL test.
2. Do not change the test's behavior, structure, or logic.
3. Do not modify or rely on changes to external files, including the component or related imports — they are read-only.
4. Use the related imports strictly for type reference and context when fixing issues.
5. Make sure all imports in the test are correct and complete.
6. Add accurate and minimal type annotations where needed. Avoid \`any\` unless strictly necessary — explain its use if applied.
7. Do not modify test queries, assertions, or rendering logic.
8. Do not introduce or remove any test cases or control flow.
9. Do not make improvements for readability, style, or performance — only address type errors.
10. Review previous fix attempts to avoid repeating unsuccessful approaches.
11. Your explanation should include:
    - What TypeScript issues were fixed.
    - How you used the related import files to resolve the issues.
12. For the testContent, return ONLY the fixed test code — no backticks, no comments, no explanation.

Important: You are only allowed to make changes inside the test file. External files are read-only and must not be modified.
`;


    console.log(`[fix-ts-error] Calling OpenAI for fixes with ${tsFixHistory.length} previous attempts as context`);

    // Call OpenAI with the prompt
    const response = await callOpenAIStructured(prompt);

    // Log the explanation without showing test content
    console.log(`[fix-ts-error] Fix explanation summary: ${response.explanation.substring(0, 100)}...`);

    // Return the updated state with the fixed test
    return {
      file: {
        ...file,
        rtlTest: response.testContent.trim(),
        fixExplanation: response.explanation,
        tsFixHistory: tsFixHistory, // Add TS-specific fix history to state
        retries: {
          ...file.retries,
          ts: file.retries.ts + 1,
        },
        currentStep: WorkflowStep.TS_VALIDATION,
      },
    };
  } catch (error) {
    console.error(`[fix-ts-error] Error: ${error instanceof Error ? error.message : String(error)}`);

    return {
      file: {
        ...file,
        error: error instanceof Error ? error : new Error(String(error)),
        status: 'failed',
        currentStep: WorkflowStep.TS_VALIDATION_ERROR,
      },
    };
  }
};