/**
 * Options for context enrichment
 */
export interface EnrichmentOptions {
  /** Depth for import analysis, default: 1 */
  importDepth?: number;

  /** Paths to example tests to use as references */
  exampleTests?: string[];
}

/**
 * Component information extracted from test
 * @deprecated Use File interface from types.ts instead
 */
export interface TestedComponent {
  /** Component name */
  name: string;

  /** Path to the component file */
  filePath: string;

  /** Component source code */
  content: string;
}

/**
 * Import information structure
 * @deprecated Use File interface from types.ts instead
 */
export interface ImportInfo {
  /** Name of the import */
  name: string;

  /** Import content */
  code: string;

  /** Path relative to the test file */
  pathRelativeToTest: string;

  /** Path relative to the tested component (optional) */
  pathRelativeToComponent?: string;

  /** Whether this import is the component being tested */
  isComponent?: boolean;
}

// Original interface is now deprecated - use types.ts version instead
// @ts-ignore - keeping for backward compatibility
export type { EnrichedContext } from '../../types.js';
