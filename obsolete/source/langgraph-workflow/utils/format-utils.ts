import path from 'path';
import { ImportInfo } from '../interfaces/index.js';

/**
 * Format imported files with appropriate syntax highlighting
 */
export function formatImports(imports: ImportInfo[] | Record<string, string> | undefined): string {
  // Handle empty or undefined imports
  if (!imports || (Array.isArray(imports) && imports.length === 0) ||
      (!Array.isArray(imports) && Object.keys(imports).length === 0)) {
    return '{}';
  }

  let result = '';

  // Handle ImportInfo[] structure
  if (Array.isArray(imports)) {
    for (const importInfo of imports) {
      const extension = path.extname(importInfo.name).slice(1) || 'tsx';
      result += `\`\`\`${extension}\n// ${importInfo.name}\n`;
      result += `// path relative to test: ${importInfo.pathRelativeToTest}\n`;
      if (importInfo.pathRelativeToComponent) {
        result += `// path relative to tested component: ${importInfo.pathRelativeToComponent}\n`;
      }
      result += `${importInfo.code}\n\`\`\`\n\n`;
    }
  }
  // Handle legacy Record<string, string> structure
  else {
    for (const [importPath, content] of Object.entries(imports)) {
      const extension = path.extname(importPath).slice(1);
      const fileName = path.basename(importPath);
      result += `\`\`\`${extension}\n// ${fileName}\n${content}\n\`\`\`\n\n`;
    }
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

/**
 * Convert old-style Record<string, string> imports to new ImportInfo[] format
 */
export function convertToImportInfoArray(
  imports: Record<string, string> | undefined,
  componentName?: string
): ImportInfo[] {
  if (!imports || Object.keys(imports).length === 0) return [];

  return Object.entries(imports).map(([importPath, code]) => {
    const name = path.basename(importPath);
    // Explicitly type this as boolean to avoid the "" empty string type
    const isComponent: boolean | undefined = componentName && importPath.includes(componentName) ? true : undefined;

    return {
      name,
      code,
      pathRelativeToTest: importPath,
      isComponent
    };
  });
}

// Note: formatTestFile and formatComponentCode functions were deprecated
// as part of simplifying the code formatting approach
