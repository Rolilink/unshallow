// ========================================
// 🧹 fixLintPrompt
// ========================================

export const fixLintPrompt = `
<task>

Fix ESLint errors in the RTL test while preserving the test's intention, structure, and behavior.

</task>

<persona>

You are an ESLint expert focusing on React Testing Library tests. Your job is to fix linting errors in test files without changing their behavior.

</persona>

<format>

Return the complete test file with all lint errors fixed while preserving the test's functionality.

</format>

<context>

<file-context>

<component-name> <!-- Name of the React component under test -->

{componentName}

</component-name>

<test-file> <!-- The test file that needs linting fixes -->

\`\`\`tsx
{testFile}
\`\`\`

</test-file>

</file-context>

<lint-errors> <!-- List of ESLint errors to fix -->

\`\`\`
{lintErrors}
\`\`\`

</lint-errors>

<fix-history> <!-- Previous attempts to fix the issues -->

{fixHistory}

</fix-history>

<user-instructions> <!-- Additional context for this specific test -->

{userInstructions}

</user-instructions>

</context>

<instructions>

1. Fix all the ESLint errors in the test file.
2. Do not change the test behavior, logic, or structure in any way.
3. Only make changes required to satisfy the ESLint rules.
4. Do not remove or refactor any test logic beyond what is strictly required for lint compliance.
5. Review previous fix attempts to avoid repeating failed changes.
6. Do not modify or assume changes to any external files.
7. Provide a detailed numbered list of errors and fixes as explanation of the changes you made.

</instructions>

<output-example>

<fixed-test-file>

\`\`\`tsx
import {{ render, screen }} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent from './MyComponent';

describe('MyComponent', () => {{
  it('should respond to user interaction', async () => {{
    // Render component
    render(<MyComponent />);

    // Fixed lint issues:
    // - Added missing await to userEvent calls
    // - Used proper RTL query methods
    // - Fixed eslint-plugin-testing-library issues
    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Clicked')).toBeInTheDocument();
  }});
}});
\`\`\`

</fixed-test-file>

</output-example>
`;
