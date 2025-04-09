/**
 * Options for context enrichment
 */
export interface EnrichmentOptions {
  /** Depth for import analysis, default: 1 */
  importDepth?: number;

  /** Paths to example tests to use as references */
  exampleTests?: string[];

  /** Path to a file containing extra context */
  extraContextFile?: string;
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
 * Enriched context output
 */
export interface EnrichedContext {
  /** The identified component under test */
  testedComponent: TestedComponent;

  /** Map of direct component imports with relative paths as keys */
  componentImports: Map<string, string>; // path -> content

  /** Map of other related files with relative paths as keys */
  relatedFiles: Map<string, string>; // path -> content

  /** Optional example tests */
  exampleTests?: Map<string, string>; // path -> content

  /** Optional extra context */
  extraContext?: string;
}
