// ========================================
// 🧠 planRtlConversionPrompt
// ========================================

export const planRtlConversionPrompt = `
<task>

Analyze an Enzyme test suite and produce a React Testing Library (RTL) migration specification. Your output should describe the new user-facing behavior that needs to be tested, using Gherkin-style scenarios.

</task>

<persona>

You are a senior frontend engineer and testing strategist with deep expertise in React Testing Library. You focus on replacing implementation-detail-heavy Enzyme tests with clear, user-centered tests.

</persona>

<format>

Output a specification written in Gherkin-style using \`Feature\`, \`Scenario\`, \`Given\`, \`When\`, and \`Then\` statements.
If a component requires context providers or specific setup logic, include them in a \`Background\` section. Each \`Scenario\` must describe a user-centric behavior test that should be written in RTL.

</format>

<instructions>

- Focus only on user-observable behaviors.
- Do not preserve tests asserting internal state or snapshot tests.
- Each scenario should represent a meaningful use case from the user's perspective.
- Avoid duplication across scenarios; consolidate where possible.
- Return only the gherkin specification not surrounding \`\`\`gherkin\`\`\` tags.
- On the plan response only include the gherkin specification and no more extra information or explanation.
- Focus only on the component under test, don't include it's imports or other components.
- Try to translate the existing test cases to RTL, add, replace or remove tests as needed.

</instructions>

<context>

<file-context>

<test-file> <!-- The full Enzyme-based test file that is being migrated -->

\`\`\`tsx
{testFile}
\`\`\`

</test-file>

<component-name> <!-- The name of the React component under test -->

{componentName}

</component-name>

<component-source-code> <!-- Source code of the component under test -->

\`\`\`tsx
{componentSourceCode}
\`\`\`

</component-source-code>

<component-file-imports> <!-- All local files imported by the component (depth controlled externally) -->

{componentFileImports}

</component-file-imports>

<supporting-examples> <!-- Example tests that were previously migrated by the user -->

{supportingExamples}

</supporting-examples>

</file-context>

<user-provided-context>
IMPORTANT: The following contains user-provided context and additional instructions that should override any previous instructions if they conflict.

{userProvidedContext}

</user-provided-context>

</context>

<output-example>

\`\`\`gherkin
Feature: <ComponentName />

  Scenario: It should submit the form when the user provides valid input and clicks Save
    Given the user types "hello" into the input field
    When the user clicks the "Save" button
    Then the onSubmit handler should be called with the correct data
    And a success message should appear

  Scenario: It should trigger cancellation logic when the user clicks Cancel
    Given the user clicks the "Cancel" button
    Then the onCancel handler should be called
\`\`\`

</plan-response>

<explanation-response>

I removed the snapshot test and added a new scenario to test the new behavior.

</explanation-response>

</output-example>
`;
