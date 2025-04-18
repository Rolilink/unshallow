import { ImportInfo } from '../interfaces/index.js';

/**
 * Formats the component context to be used in prompts
 */
export function formatComponentContext(
  componentName: string,
  componentCode: string,
  imports: ImportInfo[],
  examples: Record<string, string> = {},
  extraContext?: string
): string {
  // Find the component import info
  const componentImport = imports.find(imp => imp.isComponent);

  let contextStr = `
# Component: ${componentName}`;

  // Add component import path if available
  if (componentImport?.pathRelativeToTest) {
    contextStr += `\n(Import path relative to test: ${componentImport.pathRelativeToTest})`;
  }

  contextStr += `

## Component Code:
\`\`\`tsx
${componentCode}
\`\`\`

## Related Imports:
`;

  // Add all non-component imports
  for (const importInfo of imports.filter(imp => !imp.isComponent)) {
    contextStr += `
### ${importInfo.name} (Import path relative to test: ${importInfo.pathRelativeToTest})`;

    // Add path relative to component if available
    if (importInfo.pathRelativeToComponent) {
      contextStr += ` (Import path relative to component: ${importInfo.pathRelativeToComponent})`;
    }

    contextStr += `:
\`\`\`tsx
// path relative to test: ${importInfo.pathRelativeToTest}${importInfo.pathRelativeToComponent ? ` | path relative to tested component: ${importInfo.pathRelativeToComponent}` : ''}
${importInfo.code}
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
