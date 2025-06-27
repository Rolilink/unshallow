import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolves an import path to an absolute file path
 */
export function resolveImportPath(
  importPath: string,
  basePath: string,
  projectRoot: string
): string {
  // If it's a relative path, resolve it relative to base path
  if (importPath.startsWith('.')) {
    const resolved = path.resolve(basePath, importPath);

    // Try with different extensions if needed
    for (const ext of ['', '.ts', '.tsx', '.js', '.jsx']) {
      const fullPath = resolved + ext;
      if (fileExists(fullPath)) {
        return fullPath;
      }
    }

    // Try with /index files
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const indexPath = path.join(resolved, `index${ext}`);
      if (fileExists(indexPath)) {
        return indexPath;
      }
    }
  }

  // For non-relative imports, try to resolve within project
  try {
    return require.resolve(importPath, { paths: [projectRoot] });
  } catch (e) {
    throw new Error(`Could not resolve import path: ${importPath}`);
  }
}

/**
 * Checks if a file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}
