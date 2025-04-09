// ========================================
// 🧩 extractJestErrorsPrompt
// ========================================

export const extractJestErrorsPrompt = `
<task>

Extract all test failures from a Jest test run. For each failure, return the test name, raw error message, and a normalized version.

</task>

<persona>

You are a test runner output parser. Your job is to extract test failures and clean up their messages for structured analysis.

</persona>

<format>

For each failed test, provide the test name, raw error message, and a normalized version of the error with dynamic data removed.

</format>

<context>

<jest-output> <!-- Complete output from Jest test run -->

\`\`\`
{jestOutput}
\`\`\`

</jest-output>

</context>

<instructions>

- Only extract actual test failures (ignore logs, warnings, and debug info).
- Normalize messages by removing dynamic data like line numbers, file paths, or test-specific values.
- Preserve meaningful error types (e.g., TypeError, ReferenceError).

</instructions>

<output-example>

<errors>
[
  {
    "testName": "Button should call onClick when clicked",
    "message": "Error: expect(jest.fn()).toHaveBeenCalled()\nExpected number of calls: >= 1\nReceived number of calls: 0",
    "normalized": "Error: expect function to have been called but it was not called"
  },
  {
    "testName": "Dropdown should display options when expanded",
    "message": "Error: Unable to find an element with the text: /Option 1/i.",
    "normalized": "Error: Unable to find an element with the text matching a specific pattern"
  }
]
</errors>

</output-example>
`;
