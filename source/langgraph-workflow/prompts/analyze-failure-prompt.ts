// ========================================
// ❌ analyzeFailurePrompt
// ========================================

export const analyzeFailurePrompt = `
<task>

Analyze the current test failure and provide a plan for how to fix it in a future attempt.

</task>

<persona>

You are a senior test engineer and debugging expert specializing in React Testing Library.

</persona>

<format>

Produce a clear analysis of the failure and provide a focused intent for fixing the issue.

</format>

<context>

<test-file> <!-- Current version of the test file -->

\`\`\`tsx
{testFile}
\`\`\`

</test-file>

<component-name> <!-- Name of the React component under test -->

{componentName}

</component-name>

<component-source-code> <!-- Source code of the component -->

\`\`\`tsx
{componentSourceCode}
\`\`\`

</component-source-code>

<component-file-imports> <!-- Files imported by the component -->

{componentFileImports}

</component-file-imports>

<test-error> <!-- Information about the failing test -->

<test-name>

{testName}

</test-name>

<normalized>

\`\`\`
{normalizedError}
\`\`\`

</normalized>

<raw-message>

\`\`\`
{rawError}
\`\`\`

</raw-message>

</test-error>

<accessibility-snapshot> <!-- Accessibility roles information -->

\`\`\`
{accessibilityDump}
\`\`\`

</accessibility-snapshot>

<dom-tree> <!-- DOM structure from RTL -->

\`\`\`
{domTree}
\`\`\`

</dom-tree>

<user-provided-context>

{userProvidedContext}

</user-provided-context>

<previous-code> <!-- Previously implemented test -->

\`\`\`tsx
{previousTestCode}
\`\`\`

</previous-code>

</context>

<instructions>

- Focus only on the failing test.
- Provide a clear and actionable fix intent in human language.
- Consider query issues, setup/mocking problems, missing user events, etc.

</instructions>

<output-example>

<fix-intent>
The test is failing because it's trying to use getByText() to find an element that doesn't exist in the rendered output. We should switch to using getByRole('button', {{ name: /submit/i }}) to properly target the button element.
</fix-intent>

<explanation>
The button text is actually rendered inside a span rather than directly in the button element, which is why getByText() can't find it. Using getByRole with a name option will correctly find the button regardless of its internal structure.
</explanation>

</output-example>
`;
