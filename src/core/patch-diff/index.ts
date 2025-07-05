// Main exports for the patch-diff system
export { PatchDiff } from './PatchDiff';

// Types and interfaces
export type {
  PatchResult,
  ValidationResult,
  PreviewResult,
  FileChange,
  Chunk,
  PatchAction,
  Patch,
  Commit,
} from './types';

export {
  ActionType,
  DiffError,
  ContextNotFoundError,
  AmbiguousContextError,
  FileNotFoundError,
  FileExistsError,
  InvalidPatchError,
  SecurityError,
} from './types';

// Utility functions
export {
  textToPatch,
  identifyFilesNeeded,
  identifyFilesAdded,
  identifyFilesDeleted,
  identifyFilesUpdated,
} from './PatchParser';

// Core components (for advanced usage)
export { ContextFinder } from './ContextFinder';
export { ChunkApplicator } from './ChunkApplicator';
export { SecurityValidator } from './SecurityValidator';