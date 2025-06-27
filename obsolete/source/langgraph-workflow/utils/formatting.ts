/**
 * Utility functions for formatting data for prompts
 */

/**
 * Formats component imports JSON to be more readable in prompts
 *
 * @param imports The imports object from the context
 * @returns A nicely formatted string representation in XML format
 * @throws Error if formatting fails
 */
export function formatComponentImports(imports: Record<string, string> | undefined): string {
  if (!imports || Object.keys(imports).length === 0) {
    return '<no-imports></no-imports>';
  }

  // Create a more readable format with each import in XML format
  const formattedImports = Object.entries(imports)
    .map(([path, content]) => {
      const filename = path.split('/').pop() || path;
      return `<component-file>
<name>${filename}</name>
<path>${path}</path>
<content>${content}</content>
</component-file>`;
    })
    .join('\n\n');

  return formattedImports;
}

/**
 * Formats examples to be more readable in prompts
 *
 * @param examples The examples object from the context
 * @returns A nicely formatted string representation in XML format
 * @throws Error if formatting fails
 */
export function formatExamples(examples: Record<string, string> | undefined): string {
  if (!examples || Object.keys(examples).length === 0) {
    return '<no-examples></no-examples>';
  }

  // Create a more readable format with each example in XML format
  const formattedExamples = Object.entries(examples)
    .map(([path, content]) => {
      const filename = path.split('/').pop() || path;
      return `<example-file>
<name>${filename}</name>
<path>${path}</path>
<content>${content}</content>
</example-file>`;
    })
    .join('\n\n');

  return formattedExamples;
}
