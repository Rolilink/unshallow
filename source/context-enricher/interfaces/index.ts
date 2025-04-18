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

/**
 * Enriched context output
 */
export interface EnrichedContext {
  /** The identified component under test */
  testedComponent: TestedComponent;

  /** Direct component and related imports with structured info */
  imports: ImportInfo[];

  /** Optional example tests */
  exampleTests?: Map<string, string>; // path -> content

  /** Optional extra context */
  extraContext?: string;

  // Keep original Maps for backward compatibility during transition
  /** @deprecated Use imports instead */
  componentImports?: Map<string, string>; // path -> content

  /** @deprecated Use imports instead */
  relatedFiles?: Map<string, string>; // path -> content
}
