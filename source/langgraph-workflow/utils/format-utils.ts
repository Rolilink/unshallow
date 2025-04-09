import path from 'path';

/**
 * Format imported files with appropriate syntax highlighting
 */
export function formatImports(imports: Record<string, string> | undefined): string {
  if (!imports || Object.keys(imports).length === 0) return '{}';

  let result = '';
  for (const [importPath, content] of Object.entries(imports)) {
    const extension = path.extname(importPath).slice(1);
    const fileName = path.basename(importPath);
    result += `\`\`\`${extension}\n// ${fileName}\n${content}\n\`\`\`\n\n`;
  }
  return result;
}

/**
 * Filter out the component's own file from imports
 *
 * @param imports The original imports record
 * @param componentName The name of the component to filter out
 * @returns A new imports record without the component file
 */
export function filterComponentImports(
  imports: Record<string, string> | undefined,
  componentName: string
): Record<string, string> {
  if (!imports || Object.keys(imports).length === 0) return {};

  return Object.fromEntries(
    Object.entries(imports)
      .filter(([importPath]) => !importPath.includes(componentName))
  );
}

// Note: formatTestFile and formatComponentCode functions were deprecated
// as part of simplifying the code formatting approach
