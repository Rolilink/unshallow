/**
 * Formats the component context to be used in prompts
 */
export function formatComponentContext(
  componentName: string,
  componentCode: string,
  imports: Record<string, string>,
  examples: Record<string, string> = {},
  extraContext?: string
): string {
  let contextStr = `
# Component: ${componentName}

## Component Code:
\`\`\`tsx
${componentCode}
\`\`\`

## Related Imports:
`;

  // Add imports
  for (const [importName, importCode] of Object.entries(imports)) {
    contextStr += `
### ${importName}:
\`\`\`tsx
${importCode}
\`\`\`
`;
  }

  // Add example tests if available
  if (Object.keys(examples).length > 0) {
    contextStr += `
## Example RTL Tests:
`;

    for (const [exampleName, exampleCode] of Object.entries(examples)) {
      contextStr += `
### ${exampleName}:
\`\`\`tsx
${exampleCode}
\`\`\`
`;
    }
  }

  // Add extra context if provided
  if (extraContext) {
    contextStr += `
## Additional Context:
${extraContext}
`;
  }

  return contextStr;
}
