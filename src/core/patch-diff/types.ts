/**
 * Core types and interfaces for the TypeScript patch-diff implementation.
 * 
 * This module provides type definitions for a context-based patching system designed
 * specifically for applying AI-generated code modifications. Unlike traditional diff
 * tools that rely on line numbers, this system uses context-based matching to identify
 * where changes should be applied, making it more robust for AI-assisted coding scenarios.
 */

// ============================================================================
// Core Enums
// ============================================================================

/**
 * The type of action to perform on a file.
 * 
 * @enum {string}
 */
export enum ActionType {
  /** Add a new file */
  ADD = 'add',
  /** Delete an existing file */
  DELETE = 'delete',
  /** Update an existing file */
  UPDATE = 'update'
}

/**
 * Error codes for patch-related errors.
 * 
 * @enum {string}
 */
export enum PatchErrorCode {
  /** Invalid patch format */
  INVALID_FORMAT = 'INVALID_FORMAT',
  /** Missing begin/end patch sentinels */
  MISSING_SENTINELS = 'MISSING_SENTINELS',
  /** File not found when trying to update/delete */
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  /** File already exists when trying to add */
  FILE_ALREADY_EXISTS = 'FILE_ALREADY_EXISTS',
  /** Context lines could not be found in file */
  CONTEXT_NOT_FOUND = 'CONTEXT_NOT_FOUND',
  /** Two or more chunks are trying to modify overlapping lines */
  OVERLAPPING_CHUNKS = 'OVERLAPPING_CHUNKS',
  /** Invalid action line in patch */
  INVALID_ACTION = 'INVALID_ACTION',
  /** File system operation failed */
  FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR',
  /** Validation failed before applying patch */
  VALIDATION_FAILED = 'VALIDATION_FAILED'
}

// ============================================================================
// Permission Model Interfaces
// ============================================================================

/**
 * Permissions configuration for patch operations.
 * Controls what types of operations are allowed during patch application.
 */
export interface PatchPermissions {
  /** Allow creating new files */
  allowFileCreation: boolean;
  /** Allow deleting existing files */
  allowFileDeletion: boolean;
  /** Allow updating existing files */
  allowFileUpdates: boolean;
  /** Allow moving/renaming files */
  allowFileMoving: boolean;
  /** Allow creating new directories when adding files */
  allowDirectoryCreation: boolean;
}

/**
 * File access control configuration.
 * Defines which files and directories can be accessed during patch operations.
 */
export interface FileAccessControl {
  /** List of file patterns that are allowed to be modified */
  allowedPaths: string[];
  /** List of file patterns that are forbidden from modification */
  forbiddenPaths: string[];
  /** Whether to use whitelist mode (only allowedPaths can be modified) */
  whitelistMode: boolean;
  /** Maximum number of files that can be modified in a single patch */
  maxFilesPerPatch: number;
}

// ============================================================================
// Configuration Interfaces
// ============================================================================

/**
 * Configuration for fuzzy matching behavior.
 * Controls how aggressively the parser will try to match context lines.
 */
export interface FuzzyMatchingConfig {
  /** Enable fuzzy matching for whitespace differences */
  enabled: boolean;
  /** Maximum allowed fuzz score (higher = more lenient matching) */
  maxFuzzScore: number;
  /** Whether to ignore trailing whitespace differences */
  ignoreTrailingWhitespace: boolean;
  /** Whether to ignore all whitespace differences */
  ignoreAllWhitespace: boolean;
  /** Whether to handle context at end-of-file specially */
  handleEofContext: boolean;
}

/**
 * Main configuration options for patch operations.
 * Combines all configuration aspects into a single interface.
 */
export interface PatchOptions {
  /** Fuzzy matching configuration */
  fuzzyMatching: FuzzyMatchingConfig;
  /** Permission and access control */
  permissions: PatchPermissions;
  /** File access control */
  fileAccess: FileAccessControl;
  /** Whether to validate patch before applying */
  validateBeforeApply: boolean;
  /** Whether to create backup files before modification */
  createBackups: boolean;
  /** Timeout in milliseconds for patch operations */
  timeoutMs: number;
  /** Whether to stop on first error or collect all errors */
  stopOnFirstError: boolean;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of patch validation operation.
 * Contains validation status and any issues found.
 */
export interface PatchValidationResult {
  /** Whether the patch passed validation */
  isValid: boolean;
  /** List of validation errors that prevent patch application */
  errors: string[];
  /** List of validation warnings (non-blocking) */
  warnings: string[];
  /** Files that would be affected by this patch */
  affectedFiles: string[];
  /** Estimated fuzz score for the patch */
  estimatedFuzzScore: number;
}

/**
 * Result of patch application operation.
 * Contains detailed information about what was changed.
 */
export interface PatchResult {
  /** Whether the patch was applied successfully */
  success: boolean;
  /** Number of files that were modified */
  filesModified: number;
  /** Number of files that were created */
  filesCreated: number;
  /** Number of files that were deleted */
  filesDeleted: number;
  /** Number of files that were moved */
  filesMoved: number;
  /** Final fuzz score achieved during matching */
  fuzzScore: number;
  /** Time taken to apply the patch in milliseconds */
  executionTimeMs: number;
  /** List of files that were modified */
  modifiedFiles: string[];
  /** New content of all modified files */
  fileContents: Map<string, string>;
  /** Any warnings generated during patch application */
  warnings: string[];
  /** Error details if patch failed */
  error?: PatchError;
}

// ============================================================================
// Core Data Models
// ============================================================================

/**
 * Represents a single chunk of changes within a file.
 * Contains the original line index and the lines to delete/insert.
 */
export interface Chunk {
  /** Index in the original file where this chunk applies */
  origIndex: number;
  /** Lines to be deleted from the original file */
  delLines: string[];
  /** Lines to be inserted into the file */
  insLines: string[];
  /** Context lines used to find the location (for debugging) */
  contextLines?: string[];
  /** Fuzz score achieved when finding this chunk's location */
  fuzzScore?: number;
}

/**
 * Represents an action to be performed on a single file.
 * Contains the action type and all associated data.
 */
export interface PatchAction {
  /** The type of action to perform */
  type: ActionType;
  /** For ADD actions: the complete content of the new file */
  newFile?: string;
  /** For UPDATE actions: list of chunks to apply */
  chunks: Chunk[];
  /** For file moves: the new path for the file */
  movePath?: string;
  /** Original file path */
  filePath: string;
}

/**
 * Represents the complete parsed patch with all actions.
 * This is the primary data structure after parsing patch text.
 */
export interface ParsedPatch {
  /** Map of file paths to their associated actions */
  actions: Map<string, PatchAction>;
  /** Overall fuzz score for the entire patch */
  fuzzScore: number;
  /** Metadata about the patch parsing */
  metadata: {
    /** Number of lines in the original patch text */
    totalLines: number;
    /** Time taken to parse the patch */
    parseTimeMs: number;
    /** Number of context searches performed */
    contextSearches: number;
  };
}

/**
 * Represents a change to be applied to a single file.
 * This is the execution plan after parsing and validation.
 */
export interface FileChange {
  /** The type of change to perform */
  type: ActionType;
  /** Original content of the file (for UPDATE/DELETE) */
  oldContent?: string;
  /** New content of the file (for ADD/UPDATE) */
  newContent?: string;
  /** New path if file is being moved */
  movePath?: string;
  /** Whether this change creates a backup */
  hasBackup?: boolean;
  /** Path to backup file if created */
  backupPath?: string;
}

/**
 * Represents a complete commit with all file changes.
 * This is the final execution plan before applying changes to disk.
 */
export interface Commit {
  /** Map of file paths to their changes */
  changes: Map<string, FileChange>;
  /** Metadata about the commit */
  metadata: {
    /** Total number of files affected */
    totalFiles: number;
    /** Timestamp when commit was created */
    createdAt: Date;
    /** Unique identifier for this commit */
    id: string;
  };
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error class for all patch-related errors.
 * Provides structured error information with context.
 */
export class PatchError extends Error {
  public override readonly name = 'PatchError';
  
  /**
   * Creates a new PatchError.
   * 
   * @param message - Human-readable error message
   * @param code - Specific error code for programmatic handling
   * @param context - Additional context about the error
   * @param filePath - File path where the error occurred (if applicable)
   * @param lineNumber - Line number where the error occurred (if applicable)
   */
  constructor(
    message: string,
    public readonly code: PatchErrorCode,
    public readonly context?: Record<string, unknown>,
    public readonly filePath?: string,
    public readonly lineNumber?: number
  ) {
    super(message);
    Object.setPrototypeOf(this, PatchError.prototype);
  }

  /**
   * Creates a formatted error message with all available context.
   */
  public getFullMessage(): string {
    let fullMessage = `${this.code}: ${this.message}`;
    
    if (this.filePath) {
      fullMessage += ` (in ${this.filePath}`;
      if (this.lineNumber !== undefined) {
        fullMessage += `:${this.lineNumber}`;
      }
      fullMessage += ')';
    }
    
    if (this.context && Object.keys(this.context).length > 0) {
      fullMessage += ` - Context: ${JSON.stringify(this.context)}`;
    }
    
    return fullMessage;
  }
}

/**
 * Error thrown when patch format is invalid or malformed.
 */
export class InvalidPatchFormatError extends PatchError {
  constructor(message: string, context?: Record<string, unknown>, lineNumber?: number) {
    super(message, PatchErrorCode.INVALID_FORMAT, context, undefined, lineNumber);
    Object.setPrototypeOf(this, InvalidPatchFormatError.prototype);
  }
}

/**
 * Error thrown when required files are not found.
 */
export class FileNotFoundError extends PatchError {
  constructor(filePath: string, context?: Record<string, unknown>) {
    super(`File not found: ${filePath}`, PatchErrorCode.FILE_NOT_FOUND, context, filePath);
    Object.setPrototypeOf(this, FileNotFoundError.prototype);
  }
}

/**
 * Error thrown when trying to add a file that already exists.
 */
export class FileAlreadyExistsError extends PatchError {
  constructor(filePath: string, context?: Record<string, unknown>) {
    super(`File already exists: ${filePath}`, PatchErrorCode.FILE_ALREADY_EXISTS, context, filePath);
    Object.setPrototypeOf(this, FileAlreadyExistsError.prototype);
  }
}

/**
 * Error thrown when context lines cannot be found in a file.
 */
export class ContextNotFoundError extends PatchError {
  constructor(
    filePath: string, 
    contextLines: string[], 
    context?: Record<string, unknown>
  ) {
    const message = `Context not found in ${filePath}: ${contextLines.slice(0, 2).join(' | ')}${contextLines.length > 2 ? '...' : ''}`;
    super(message, PatchErrorCode.CONTEXT_NOT_FOUND, { ...context, contextLines }, filePath);
    Object.setPrototypeOf(this, ContextNotFoundError.prototype);
  }
}

/**
 * Error thrown when file system operations fail.
 */
export class FileSystemError extends PatchError {
  constructor(
    operation: string, 
    filePath: string, 
    originalError: Error, 
    context?: Record<string, unknown>
  ) {
    super(
      `File system operation failed: ${operation} on ${filePath} - ${originalError.message}`, 
      PatchErrorCode.FILE_SYSTEM_ERROR, 
      { ...context, operation, originalError: originalError.message }, 
      filePath
    );
    Object.setPrototypeOf(this, FileSystemError.prototype);
  }
}

// ============================================================================
// Function Type Definitions
// ============================================================================

/**
 * Type for progress callback function.
 * Called periodically during patch application to report progress.
 */
export type ProgressCallback = (progress: {
  /** Current step being executed */
  currentStep: string;
  /** Number of steps completed */
  completedSteps: number;
  /** Total number of steps */
  totalSteps: number;
  /** Percentage complete (0-100) */
  percentComplete: number;
  /** Current file being processed (if applicable) */
  currentFile?: string;
}) => void;

/**
 * Type for context finder function.
 * Finds the location of context lines in a file with fuzzy matching.
 */
export type ContextFinder = (
  fileContent: string,
  contextLines: string[],
  options: FuzzyMatchingConfig
) => Promise<{
  /** Index where context was found (-1 if not found) */
  index: number;
  /** Fuzz score achieved during matching */
  fuzzScore: number;
  /** Whether the match was found at end-of-file */
  isEofMatch: boolean;
}>;

/**
 * Type for file validator function.
 * Validates that a file can be safely modified.
 */
export type FileValidator = (
  filePath: string,
  action: PatchAction,
  options: PatchOptions
) => Promise<{
  /** Whether the file can be modified */
  canModify: boolean;
  /** Reason if file cannot be modified */
  reason?: string;
  /** Any warnings about modifying this file */
  warnings: string[];
}>;

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Default fuzzy matching configuration.
 * Provides reasonable defaults for most use cases.
 */
export const DEFAULT_FUZZY_MATCHING: FuzzyMatchingConfig = {
  enabled: true,
  maxFuzzScore: 100,
  ignoreTrailingWhitespace: true,
  ignoreAllWhitespace: false,
  handleEofContext: true
};

/**
 * Default permissions configuration.
 * Allows all operations by default.
 */
export const DEFAULT_PERMISSIONS: PatchPermissions = {
  allowFileCreation: true,
  allowFileDeletion: true,
  allowFileUpdates: true,
  allowFileMoving: true,
  allowDirectoryCreation: true
};

/**
 * Default file access control configuration.
 * No restrictions by default.
 */
export const DEFAULT_FILE_ACCESS: FileAccessControl = {
  allowedPaths: ['**/*'],
  forbiddenPaths: [],
  whitelistMode: false,
  maxFilesPerPatch: 100
};

/**
 * Default patch options.
 * Combines all default configurations.
 */
export const DEFAULT_PATCH_OPTIONS: PatchOptions = {
  fuzzyMatching: DEFAULT_FUZZY_MATCHING,
  permissions: DEFAULT_PERMISSIONS,
  fileAccess: DEFAULT_FILE_ACCESS,
  validateBeforeApply: true,
  createBackups: false,
  timeoutMs: 30000, // 30 seconds
  stopOnFirstError: true
};