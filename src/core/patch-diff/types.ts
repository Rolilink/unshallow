// Core enums and types matching the original implementation

export enum ActionType {
  ADD = 'add',
  DELETE = 'delete',
  UPDATE = 'update',
}

// File change representation for commits
export interface FileChange {
  type: ActionType;
  old_content?: string | null;
  new_content?: string | null;
  move_path?: string | null;
}

// Commit structure containing all file changes
export interface Commit {
  changes: Record<string, FileChange>;
}

// Chunk of changes within a file
export interface Chunk {
  orig_index: number;      // Line index of the first line in the original file
  del_lines: string[];     // Lines to be deleted
  ins_lines: string[];     // Lines to be inserted
}

// Patch action for a specific file
export interface PatchAction {
  type: ActionType;
  new_file?: string | null;
  chunks: Chunk[];
  move_path?: string | null;
}

// Complete patch representation
export interface Patch {
  actions: Record<string, PatchAction>;
}

// Result of patch application
export interface PatchResult {
  success: boolean;
  changes?: FileChange[];
  fuzz?: number;
  error?: Error;
}

// Result of patch validation
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Result of patch preview
export interface PreviewResult {
  files: {
    path: string;
    action: ActionType;
    preview?: string;  // Diff preview
  }[];
}

// Error classes matching original implementation
export class DiffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiffError';
  }
}

export class ContextNotFoundError extends DiffError {
  constructor(message: string) {
    super(message);
    this.name = 'ContextNotFoundError';
  }
}

export class AmbiguousContextError extends DiffError {
  constructor(message: string) {
    super(message);
    this.name = 'AmbiguousContextError';
  }
}

export class FileNotFoundError extends DiffError {
  constructor(message: string) {
    super(message);
    this.name = 'FileNotFoundError';
  }
}

export class FileExistsError extends DiffError {
  constructor(message: string) {
    super(message);
    this.name = 'FileExistsError';
  }
}

export class InvalidPatchError extends DiffError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPatchError';
  }
}

export class SecurityError extends DiffError {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

// Constants from original implementation
export const PATCH_PREFIX = '*** Begin Patch\n';
export const PATCH_SUFFIX = '\n*** End Patch';
export const ADD_FILE_PREFIX = '*** Add File: ';
export const DELETE_FILE_PREFIX = '*** Delete File: ';
export const UPDATE_FILE_PREFIX = '*** Update File: ';
export const MOVE_FILE_TO_PREFIX = '*** Move to: ';
export const END_OF_FILE_PREFIX = '*** End of File';
export const HUNK_ADD_LINE_PREFIX = '+';

// Unicode normalization mapping - exact copy from original
export const PUNCT_EQUIV: Record<string, string> = {
  // Hyphen / dash variants --------------------------------------------------
  /* U+002D HYPHEN-MINUS */ '-': '-',
  /* U+2010 HYPHEN */ '\u2010': '-',
  /* U+2011 NO-BREAK HYPHEN */ '\u2011': '-',
  /* U+2012 FIGURE DASH */ '\u2012': '-',
  /* U+2013 EN DASH */ '\u2013': '-',
  /* U+2014 EM DASH */ '\u2014': '-',
  /* U+2212 MINUS SIGN */ '\u2212': '-',

  // Double quotes -----------------------------------------------------------
  /* U+0022 QUOTATION MARK */ '\u0022': '"',
  /* U+201C LEFT DOUBLE QUOTATION MARK */ '\u201C': '"',
  /* U+201D RIGHT DOUBLE QUOTATION MARK */ '\u201D': '"',
  /* U+201E DOUBLE LOW-9 QUOTATION MARK */ '\u201E': '"',
  /* U+00AB LEFT-POINTING DOUBLE ANGLE QUOTATION MARK */ '\u00AB': '"',
  /* U+00BB RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK */ '\u00BB': '"',

  // Single quotes -----------------------------------------------------------
  /* U+0027 APOSTROPHE */ '\u0027': "'",
  /* U+2018 LEFT SINGLE QUOTATION MARK */ '\u2018': "'",
  /* U+2019 RIGHT SINGLE QUOTATION MARK */ '\u2019': "'",
  /* U+201B SINGLE HIGH-REVERSED-9 QUOTATION MARK */ '\u201B': "'",
  
  // Spaces ------------------------------------------------------------------
  /* U+00A0 NO-BREAK SPACE */ '\u00A0': ' ',
  /* U+202F NARROW NO-BREAK SPACE */ '\u202F': ' ',
};