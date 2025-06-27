/**
 * Base File interface to represent any file in the system
 */
export interface File {
  /** Name of the file */
  fileName: string;

  /** Content of the file */
  fileContent: string;

  /** Absolute path to the file */
  fileAbsolutePath: string;

  /** Path relative to the tested file (optional) */
  pathRelativeToTestedFile?: string;

  /** Imports contained within this file, keyed by relative path */
  imports?: Record<string, File>;
}

/**
 * Enriched context containing all information needed for test migration
 */
export interface EnrichedContext {
  /** The primary file being tested */
  testedFile: File;

  /** Example test files for reference, keyed by absolute path */
  exampleTests?: Record<string, File>;

  /** Additional context provided by the user */
  userProvidedContext?: string;
}
