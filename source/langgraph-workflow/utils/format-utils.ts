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

// Note: formatTestFile and formatComponentCode functions were deprecated
// as part of simplifying the code formatting approach
