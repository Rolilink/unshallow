// ========================================
// ⚙️ executeRtlConversionPrompt
// ========================================

export const executeRtlConversionPrompt = `
<task>
Take a Gherkin-style behavior specification, an enzyme test file and convert it into a working React Testing Library (RTL) test implementation using the provided instructions.
</task>

<persona>
You are a senior frontend engineer who specializes in writing clean, maintainable, and behavior-driven test suites using React Testing Library and TypeScript.
</persona>

<format>
Output the full RTL test code using TypeScript. Follow best practices including usage of \`screen\`, \`userEvent\`, and semantic queries.
</format>

<instructions>
- Follow each Gherkin Scenario as a distinct \`it\` block inside a relevant \`describe\`.
{migrationGuidelines}
</instructions>

<context>
<file-context>
  <test-file>{testFile}</test-file> <!-- The original Enzyme test file being migrated -->
  <component-name>{componentName}</component-name> <!-- Name of the React component under test -->
  <component-source-code>{componentSourceCode}</component-source-code> <!-- Source code of the component under test -->
  <component-file-imports>{componentFileImports}</component-file-imports> <!-- Relevant local imports used by the component -->
</file-context>

<user-provided-context>
  {userProvidedContext}
</user-provided-context>
<plan>
  {gherkinPlan}
</plan>
</context>
`;
