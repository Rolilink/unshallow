// ========================================
// 🔧 fixTsPrompt
// ========================================

export const fixTsPrompt = `
<task>

Fix TypeScript errors in the RTL test while preserving the test's intention, structure, and behavior.

</task>

<persona>

You are a TypeScript expert focusing on React Testing Library tests. Your job is to fix TypeScript errors in test files without changing their behavior.

</persona>

<format>

Return the complete test file with all TypeScript errors fixed while preserving the test's functionality.

</format>

<context>

<file-context>

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

<test-file> <!-- The test file that needs TypeScript fixes -->

\`\`\`tsx
{testFile}
\`\`\`

</test-file>

</file-context>

<typescript-errors> <!-- List of TypeScript errors to fix -->

\`\`\`
{tsErrors}
\`\`\`

</typescript-errors>

<fix-history> <!-- Previous attempts to fix the issues -->

{fixHistory}

</fix-history>

<user-instructions> <!-- Additional context for this specific test -->

{userInstructions}

</user-instructions>

</context>

<instructions>

1. Fix only the TypeScript errors in the RTL test.
2. Do not change the test's behavior, structure, or logic.
3. Do not modify or rely on changes to external files.
4. Use the related imports strictly for type reference and context when fixing issues.
5. Make sure all imports in the test are correct and complete.
6. In the context section, each import has path comments showing the correct path relative to the test file. Use these paths when adding or fixing imports.
7. Add accurate and minimal type annotations where needed. Avoid \`any\` unless strictly necessary.
8. Do not modify test queries, assertions, or rendering logic.
9. Do not introduce or remove any test cases or control flow.
10. Do not make improvements for readability, style, or performance — only address type errors.
11. Review previous fix attempts to avoid repeating unsuccessful approaches.

</instructions>

<output-example>

<fixed-test-file>

\`\`\`tsx
import {{ render, screen }} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent, {{ MyComponentProps }} from '../components/MyComponent';
import {{ ButtonHelper }} from '../utils/ButtonHelper';
import {{ setupTest }} from '../test-utils';

describe('MyComponent', () => {{
  // Fixed by adding proper type annotation for props
  const defaultProps: MyComponentProps = {{
    title: 'Test',
    onClick: jest.fn(),
  }};

  it('should handle click events', async () => {{
    render(<MyComponent {{...defaultProps}} />);

    await userEvent.click(screen.getByRole('button'));

    expect(defaultProps.onClick).toHaveBeenCalled();
  }});
}});
\`\`\`

</fixed-test-file>

</output-example>
`;
