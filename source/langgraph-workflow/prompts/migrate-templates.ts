import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from '@langchain/core/prompts';

/**
 * System prompt template for the migration workflow
 */
export const migrateSystemPromptTemplate: SystemMessagePromptTemplate = SystemMessagePromptTemplate.fromTemplate(`
You are an expert in migrating Enzyme tests to React Testing Library.
You will be provided with an Enzyme test file and detailed context about the components being tested.

## Component Context
{componentContext}

## Guidelines for migration:
1. Replace Enzyme's shallow/mount with React Testing Library's render
2. Replace Enzyme selectors with RTL queries
3. Replace Enzyme interactions with RTL's fireEvent or userEvent
4. Update assertions to match RTL's philosophy
5. Maintain the same test coverage and assertions
6. Keep the same test structure and descriptions
7. Be careful to handle async operations properly

Reply with the fully migrated test file only. Do not include any explanations or comments outside of the code.
`);

/**
 * Human message template for the migration workflow
 */
export const migrateHumanPromptTemplate: HumanMessagePromptTemplate = HumanMessagePromptTemplate.fromTemplate(`
Here is the Enzyme test to migrate to React Testing Library:
\`\`\`typescript
{testCode}
\`\`\`

Please convert this test to use React Testing Library, maintaining the same behavior.
`);

/**
 * Combined chat prompt template for the migration workflow
 */
export const migrateChatPromptTemplate: ChatPromptTemplate = ChatPromptTemplate.fromMessages([
  migrateSystemPromptTemplate,
  migrateHumanPromptTemplate
]);

/**
 * Template for formatting component context
 */
export function formatComponentContext(
  componentName: string,
  componentCode: string,
  imports: Record<string, string>,
  examples?: Record<string, string>,
  extraContext?: string
): string {
  let componentContext = '';

  // Add information about the tested component
  componentContext += `\n## Tested Component: ${componentName}\n\n`;
  componentContext += '```typescript\n';
  componentContext += componentCode;
  componentContext += '\n```\n\n';

  // Add information about related imports
  componentContext += `## Related Imports\n\n`;

  for (const [relativePath, content] of Object.entries(imports)) {
    componentContext += `### ${relativePath}\n\n`;
    componentContext += '```typescript\n';
    componentContext += content;
    componentContext += '\n```\n\n';
  }

  // Add example tests if available
  if (examples && Object.keys(examples).length > 0) {
    componentContext += `## Example Migrations\n\n`;
    componentContext += `These are examples of similar tests that have been migrated from Enzyme to RTL:\n\n`;

    for (const [examplePath, exampleContent] of Object.entries(examples)) {
      componentContext += `### ${examplePath}\n\n`;
      componentContext += '```typescript\n';
      componentContext += exampleContent;
      componentContext += '\n```\n\n';
    }
  }

  // Add extra context if available
  if (extraContext && extraContext.trim().length > 0) {
    componentContext += `## Additional Instructions and Context\n\n`;
    componentContext += `These are additional instructions and context that will help you migrate the test file:\n\n`;
    componentContext += extraContext;
    componentContext += '\n\n';
  }

  return componentContext;
}
