import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import glob from 'glob';

/**
 * Represents a test file for migration
 */
export interface TestFileItem {
  path: string;             // Absolute path to the test file
  relativePath: string;     // Relative path from cwd for display
  hasTempFile: boolean;     // Whether a temp file exists for retry mode
}

/**
 * Options for test file discovery
 */
export interface DiscoveryOptions {
  pattern?: string;        // Glob pattern for test files
  recursive?: boolean;     // Whether to search subdirectories
  retry?: boolean;         // Whether to check for temp files for retry
}

/**
 * Find test files for migration
 */
export async function discoverTestFiles(
  paths: string[],
  options: DiscoveryOptions
): Promise<TestFileItem[]> {
  const files: TestFileItem[] = [];
  const cwd = process.cwd();

  // Default options
  const pattern = options.pattern || '**/*.{test,spec}.{ts,tsx,js,jsx}';
  const recursive = options.recursive !== false; // Default to true

  for (const inputPath of paths) {
    try {
      const stats = await fs.stat(inputPath);

      if (stats.isDirectory()) {
        // For directories, find all matching files
        const matches = await findMatchingFiles(inputPath, pattern, recursive);

        for (const filePath of matches) {
          // Only include files that import Enzyme
          if (await hasEnzymeImports(filePath)) {
            const hasTempFile = options.retry && checkTempFileExists(filePath);

            files.push({
              path: filePath,
              relativePath: path.relative(cwd, filePath),
              hasTempFile: !!hasTempFile
            });
          }
        }
      } else if (stats.isFile()) {
        // For single files, check if they import Enzyme
        if (await hasEnzymeImports(inputPath)) {
          const hasTempFile = options.retry && checkTempFileExists(inputPath);

          files.push({
            path: inputPath,
            relativePath: path.relative(cwd, inputPath),
            hasTempFile: !!hasTempFile
          });
        }
      }
    } catch (error) {
      console.error(`Error processing path ${inputPath}:`, error);
    }
  }

  return files;
}

/**
 * Find files matching pattern in directory
 */
async function findMatchingFiles(
  directory: string,
  pattern: string,
  recursive: boolean
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    // Use different patterns based on recursive option
    const actualPattern = recursive
      ? pattern
      : pattern.replace(/^\*\*\//, '');

    glob(actualPattern, {
      cwd: directory,
      absolute: true,
      ignore: ['node_modules/**'],
      dot: false,
      nodir: true
    }, (err, matches) => {
      if (err) {
        reject(err);
      } else {
        resolve(matches);
      }
    });
  });
}

/**
 * Check if a file imports Enzyme
 */
async function hasEnzymeImports(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf8');

    // Common Enzyme packages to check for
    const enzymePackages = [
      'enzyme',
      '@wojtekmaj/enzyme-adapter-react-17',
      'enzyme-adapter-react-16'
    ];

    // Check for imports using regex
    for (const pkg of enzymePackages) {
      const importRegex = new RegExp(`(import|require)\\s+.*['"]${pkg}(\\/|['"])`, 'g');
      if (importRegex.test(content)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(`Error checking Enzyme imports in ${filePath}:`, error);
    return false;
  }
}

/**
 * Check if a temp file exists for a test file
 */
function checkTempFileExists(testFilePath: string): boolean {
  const fileExt = path.extname(testFilePath);
  const fileName = path.basename(testFilePath, fileExt);
  const dirName = path.dirname(testFilePath);

  const tempFilePath = path.join(dirName, `${fileName}.temp${fileExt}`);
  return fsSync.existsSync(tempFilePath);
}
