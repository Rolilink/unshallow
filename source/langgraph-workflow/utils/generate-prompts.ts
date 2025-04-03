/**
 * Generates a prompt for converting Enzyme tests to RTL
 */
export function generateConversionPrompt(enzymeTest: string, componentContext: string): string {
  return `
# Task: Convert Enzyme Tests to React Testing Library (RTL)

${componentContext}

## Test to Migrate:
\`\`\`tsx
${enzymeTest}
\`\`\`

## Instructions:
1. Convert the Enzyme test to use React Testing Library (RTL).
2. Use modern RTL practices and patterns.
3. Maintain the same test coverage and assertions.
4. Output only the converted code, no explanations.
5. Make sure imports are correct and complete.
6. Use @testing-library/jest-dom for assertions when appropriate.
7. Replace shallow/mount with render from @testing-library/react.
8. Use screen queries (getBy, findBy, queryBy) instead of wrapper.find().
9. Replace .simulate() with fireEvent or userEvent.
10. Replace .prop() or .props() with appropriate RTL alternatives.

Only return the converted code, with no markdown formatting or explanations, don't return the code in \`\`\`tsx\`\`\` tags.
`;
}
