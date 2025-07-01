/**
 * Patch-diff module exports.
 * 
 * This module provides a context-based patching system for applying
 * AI-generated code modifications.
 */

// Export all types and interfaces
export * from './types';

// Export main class and components
export { PatchDiff } from './PatchDiff';
export { PatchParser } from './PatchParser';
export { SecurityValidator, ValidationResult, PermissionDeniedError, FileAccessDeniedError } from './SecurityValidator';
export { ContextFinder, ContextMatch } from './ContextFinder';
export { ChunkApplicator } from './ChunkApplicator';

// Re-export commonly used items for convenience
export {
  ActionType,
  PatchErrorCode,
  PatchError,
  InvalidPatchFormatError,
  FileNotFoundError,
  FileAlreadyExistsError,
  ContextNotFoundError,
  FileSystemError,
  DEFAULT_PATCH_OPTIONS,
  DEFAULT_FUZZY_MATCHING,
  DEFAULT_PERMISSIONS,
  DEFAULT_FILE_ACCESS
} from './types';