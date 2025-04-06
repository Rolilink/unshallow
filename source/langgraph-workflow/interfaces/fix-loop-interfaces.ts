import { z } from 'zod';

/**
 * Type definitions for TrackedError to track test errors across fix attempts
 */
export type TrackedError = {
  fingerprint: string;
  testName: string;
  message: string;
  normalized: string;
  currentAttempts: number;
  status: 'new' | 'active' | 'fixed' | 'regressed';
};

/**
 * Type definition for FixLoopState to track overall fix loop state
 */
export type FixLoopState = {
  filePath: string;
  trackedErrors: Record<string, TrackedError>;
  currentError: TrackedError | null;
  totalAttempts: number;
  accessibilityDump: string;
};

/**
 * Input type for the extract-accessibility-snapshot node
 */
export type ExtractAccessibilitySnapshotInput = {
  jestOutput: string;
};

/**
 * Output schema for the extract-accessibility-snapshot node
 */
export const ExtractAccessibilitySnapshotOutputSchema = z.object({
  accessibilityDump: z.string(),
});

export type ExtractAccessibilitySnapshotOutput = z.infer<typeof ExtractAccessibilitySnapshotOutputSchema>;

/**
 * Input type for the extract-jest-errors node
 */
export type ExtractJestErrorsInput = {
  jestOutput: string;
};

/**
 * Schema for extracted errors
 */
export const ExtractedErrorSchema = z.object({
  testName: z.string(),
  message: z.string(),
  normalized: z.string(),
});

export type ExtractedError = z.infer<typeof ExtractedErrorSchema>;

/**
 * Output schema for the extract-jest-errors node
 */
export const ExtractJestErrorsOutputSchema = z.object({
  testErrors: z.array(ExtractedErrorSchema),
});

export type ExtractJestErrorsOutput = z.infer<typeof ExtractJestErrorsOutputSchema>;

/**
 * Input type for the analyze-failure node
 */
export type AnalyzeFailureInput = {
  testFile: string;
  componentName: string;
  componentSourceCode: string;
  componentFileImports: string;
  previousTestCode: string;
  accessibilityDump: string;
  userFeedback?: string;
  testError: {
    testName: string;
    normalized: string;
    rawMessage: string;
  };
};

/**
 * Output schema for the analyze-failure node
 */
export const AnalyzeFailureOutputSchema = z.object({
  fixIntent: z.string(),
  explanation: z.string(),
});

export type AnalyzeFailureOutput = z.infer<typeof AnalyzeFailureOutputSchema>;

/**
 * Input type for the execute-rtl-fix node
 */
export type ExecuteFixInput = {
  testFile: string;
  componentName: string;
  componentSourceCode: string;
  componentFileImports: string;
  testError: {
    testName: string;
    normalized: string;
    rawMessage: string;
  };
  fixIntent: string;
  accessibilityDump: string;
  userFeedback?: string;
  previousTestCode: string;
};

/**
 * Output schema for the execute-rtl-fix node
 */
export const ExecuteRtlFixOutputSchema = z.object({
  updatedTestFile: z.string(),
  fixExplanation: z.string(),
});

export type ExecuteRtlFixOutput = z.infer<typeof ExecuteRtlFixOutputSchema>;
