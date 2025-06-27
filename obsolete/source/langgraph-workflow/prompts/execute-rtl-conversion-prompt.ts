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
- Each import in the context section includes a path comment showing the correct path relative to the test file.
- When importing dependencies in the RTL test, use the path provided in the "path relative to test" comment to ensure proper import paths.
- Make sure to import from the exact paths relative to the test file as indicated in the import comments.
{migrationGuidelines}

</instructions>

<context>

<file-context>

<test-file> <!-- The original Enzyme test file being migrated -->

\`\`\`tsx
{testFile}
\`\`\`

</test-file>

<component-name> <!-- Name of the React component under test -->

{componentName}

</component-name>

<component-source-code> <!-- Source code of the component under test -->

\`\`\`tsx
{componentSourceCode}
\`\`\`

</component-source-code>

<component-file-imports> <!-- Relevant local imports used by the component -->

{componentFileImports}

</component-file-imports>

</file-context>

<user-provided-context>
IMPORTANT: The following contains user-provided context and additional instructions that should override any previous instructions if they conflict.

{userProvidedContext}

</user-provided-context>

<plan>

\`\`\`gherkin
{gherkinPlan}
\`\`\`

</plan>

</context>

<output-example>

<rtl-implementation>

\`\`\`tsx
import {{ render, screen }} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent from '../components/MyComponent';
import {{ ButtonHelper }} from '../utils/ButtonHelper';
import {{ setupTest }} from '../test-utils';

describe('MyComponent', () => {{
  it('should display welcome message when user logs in', async () => {{
    // Given the component is rendered
    render(<MyComponent />);

    // When the user enters credentials and clicks login
    await userEvent.type(screen.getByLabelText('Username'), 'testuser');
    await userEvent.type(screen.getByLabelText('Password'), 'password');
    await userEvent.click(screen.getByRole('button', {{ name: 'Login' }}));

    // Then the welcome message should be displayed
    expect(screen.getByText('Welcome, testuser!')).toBeInTheDocument();
  }});
}});
\`\`\`

</rtl-implementation>

</output-example>
`;
