/**
 * Main PatchDiff class that orchestrates all components for patch application.
 * 
 * Provides the primary API for the TypeScript patch diff system. Combines
 * parsing, security validation, context finding, and chunk application into
 * a cohesive interface with comprehensive error handling and result reporting.
 */

import { IFileSystem, RootedFileSystem } from '../file-system';
import {
  PatchOptions,
  PatchResult,
  PatchValidationResult,
  ParsedPatch,
  ActionType,
  DEFAULT_PATCH_OPTIONS,
  PatchError,
  PatchErrorCode,
  PatchPermissions,
  FileAccessControl,
  FuzzyMatchingConfig
} from './types';
import { PatchParser } from './PatchParser';
import { SecurityValidator, ValidationResult } from './SecurityValidator';
import { ContextFinder } from './ContextFinder';
import { ChunkApplicator } from './ChunkApplicator';

/**
 * Main PatchDiff class for applying context-based patches with security controls.
 * Uses composition to combine all specialized components into a unified interface.
 * 
 * All file operations are constrained to the specified root directory for security
 * and isolation. This supports testing scenarios and future git worktree integration.
 */
export class PatchDiff {
  private readonly parser: PatchParser;
  private readonly validator: SecurityValidator;
  private readonly contextFinder: ContextFinder;
  private readonly applicator: ChunkApplicator;
  private readonly rootedFileSystem: RootedFileSystem;

  constructor(
    baseFileSystem: IFileSystem,
    rootPath: string,
    private readonly options: PatchOptions = DEFAULT_PATCH_OPTIONS
  ) {
    // Create a rooted filesystem to constrain all operations to the specified root
    this.rootedFileSystem = new RootedFileSystem(baseFileSystem, rootPath);
    
    // Initialize all components with the same options
    this.parser = new PatchParser(options);
    this.validator = new SecurityValidator(options);
    this.contextFinder = new ContextFinder(options);
    this.applicator = new ChunkApplicator(options);
  }

  /**
   * Apply a patch and return detailed results
   */
  async apply(patchText: string): Promise<PatchResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Step 1: Validate patch format and parse
      const parsedPatch = await this.parse(patchText);
      
      // Step 2: Security validation
      const securityResult = await this.validator.validatePatch(parsedPatch.actions);
      if (!securityResult.isValid) {
        return this.createFailureResult(
          new PatchError(
            `Security validation failed: ${securityResult.errors.join(', ')}`,
            PatchErrorCode.VALIDATION_FAILED,
            { securityErrors: securityResult.errors }
          ),
          startTime,
          securityResult.warnings
        );
      }
      warnings.push(...securityResult.warnings);

      // Step 3: Load required files
      const filePaths = this.identifyFilesNeeded(patchText);
      const currentFiles = await this.loadFiles(filePaths);

      // Step 4: Generate commit with file changes
      const commit = await this.applicator.generateCommit(parsedPatch, currentFiles);

      // Step 5: Apply changes to file system if not in validation-only mode
      if (this.options.validateBeforeApply) {
        // Perform final validation
        const finalValidation = await this.validateCommit(commit, currentFiles);
        if (!finalValidation.isValid) {
          return this.createFailureResult(
            new PatchError(
              `Final validation failed: ${finalValidation.errors.join(', ')}`,
              PatchErrorCode.VALIDATION_FAILED,
              { validationErrors: finalValidation.errors }
            ),
            startTime,
            [...warnings, ...finalValidation.warnings]
          );
        }
        warnings.push(...finalValidation.warnings);
      }

      await this.applyCommit(commit);

      // Step 6: Collect file contents for result
      const fileContents = new Map<string, string>();
      for (const [filePath, change] of commit.changes) {
        if (change.type === ActionType.DELETE) {
          // Don't include deleted files in contents
          continue;
        }
        
        const finalPath = change.movePath || filePath;
        if (change.newContent !== undefined) {
          fileContents.set(finalPath, change.newContent);
        }
      }

      const executionTimeMs = Date.now() - startTime;

      return {
        success: true,
        filesModified: this.countFilesByType(commit, ActionType.UPDATE),
        filesCreated: this.countFilesByType(commit, ActionType.ADD),
        filesDeleted: this.countFilesByType(commit, ActionType.DELETE),
        filesMoved: this.countMovedFiles(commit),
        fuzzScore: parsedPatch.fuzzScore,
        executionTimeMs,
        modifiedFiles: Array.from(commit.changes.keys()),
        fileContents,
        warnings
      };

    } catch (error) {
      return this.createFailureResult(
        error instanceof PatchError ? error : new PatchError(
          error instanceof Error ? error.message : 'Unknown error',
          PatchErrorCode.VALIDATION_FAILED,
          { originalError: error }
        ),
        startTime,
        warnings
      );
    }
  }

  /**
   * Validate a patch without applying it
   */
  async validate(patchText: string): Promise<PatchValidationResult> {
    // Extract affected files even if parsing fails
    const affectedFiles = this.identifyFilesNeeded(patchText);
    
    try {
      // Parse the patch
      const parsedPatch = await this.parse(patchText);
      
      // Security validation
      const securityResult = await this.validator.validatePatch(parsedPatch.actions);
      
      // Load files for content validation
      const filePaths = this.identifyFilesNeeded(patchText);
      const currentFiles = await this.loadFiles(filePaths);
      
      // Generate commit to validate chunk application
      const commit = await this.applicator.generateCommit(parsedPatch, currentFiles);
      
      // Final validation
      const finalValidation = await this.validateCommit(commit, currentFiles);
      
      const allErrors = [...securityResult.errors, ...finalValidation.errors];
      const allWarnings = [...securityResult.warnings, ...finalValidation.warnings];

      return {
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings,
        affectedFiles,
        estimatedFuzzScore: parsedPatch.fuzzScore
      };

    } catch (error) {
      const errorMessage = error instanceof PatchError 
        ? error.message 
        : error instanceof Error 
          ? error.message 
          : 'Unknown validation error';

      return {
        isValid: false,
        errors: [errorMessage],
        warnings: [],
        affectedFiles,
        estimatedFuzzScore: 0
      };
    }
  }

  /**
   * Parse patch text and return structured representation
   */
  async parse(patchText: string): Promise<ParsedPatch> {
    // Quick format validation
    if (!patchText.trim()) {
      throw new PatchError(
        'Empty patch text',
        PatchErrorCode.INVALID_FORMAT
      );
    }

    // Identify and load required files for parsing
    const filePaths = this.identifyFilesNeeded(patchText);
    const currentFiles = await this.loadFiles(filePaths);
    
    // Parse using the PatchParser component
    return this.parser.parse(patchText, currentFiles);
  }

  /**
   * Identify files that need to be loaded for patch processing
   */
  private identifyFilesNeeded(patchText: string): string[] {
    const lines = patchText.split('\n');
    const updateFiles: string[] = [];
    const deleteFiles: string[] = [];
    const addFiles: string[] = [];

    for (const line of lines) {
      const updateMatch = line.match(/^\*\*\* Update File: (.+)$/);
      if (updateMatch && updateMatch[1]) {
        updateFiles.push(updateMatch[1].trim());
        continue;
      }

      const deleteMatch = line.match(/^\*\*\* Delete File: (.+)$/);
      if (deleteMatch && deleteMatch[1]) {
        deleteFiles.push(deleteMatch[1].trim());
        continue;
      }

      const addMatch = line.match(/^\*\*\* Add File: (.+)$/);
      if (addMatch && addMatch[1]) {
        addFiles.push(addMatch[1].trim());
        continue;
      }
    }

    return [...updateFiles, ...deleteFiles, ...addFiles];
  }

  /**
   * Load files from file system
   */
  private async loadFiles(filePaths: string[]): Promise<Map<string, string>> {
    const files = new Map<string, string>();
    const errors: string[] = [];

    for (const filePath of filePaths) {
      try {
        const content = await this.rootedFileSystem.read(filePath);
        files.set(filePath, content);
      } catch (error) {
        // Check if this is expected (file might not exist for ADD operations)
        if (await this.rootedFileSystem.exists(filePath)) {
          errors.push(`Failed to read ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        // For non-existent files, we'll let the parser handle the validation
      }
    }

    if (errors.length > 0) {
      throw new PatchError(
        `Failed to load required files: ${errors.join(', ')}`,
        PatchErrorCode.FILE_SYSTEM_ERROR,
        { errors, requestedFiles: filePaths }
      );
    }

    return files;
  }

  /**
   * Apply commit changes to file system
   */
  private async applyCommit(commit: ReturnType<typeof this.applicator.generateCommit> extends Promise<infer T> ? T : never): Promise<void> {
    const errors: string[] = [];

    for (const [filePath, change] of commit.changes) {
      try {
        switch (change.type) {
          case ActionType.ADD:
            if (change.newContent === undefined) {
              throw new Error('ADD change missing new content');
            }
            await this.rootedFileSystem.write(filePath, change.newContent);
            break;

          case ActionType.DELETE:
            if (change.movePath) {
              // This is a move operation, file already written to new location
              await this.rootedFileSystem.delete(filePath);
            } else {
              await this.rootedFileSystem.delete(filePath);
            }
            break;

          case ActionType.UPDATE:
            if (change.newContent === undefined) {
              throw new Error('UPDATE change missing new content');
            }
            
            if (change.movePath) {
              // Move operation: write to new location and delete old
              await this.rootedFileSystem.write(change.movePath, change.newContent);
              await this.rootedFileSystem.delete(filePath);
            } else {
              // Regular update
              await this.rootedFileSystem.write(filePath, change.newContent);
            }
            break;

          default:
            throw new Error(`Unknown change type: ${(change as any).type}`);
        }
      } catch (error) {
        errors.push(`Failed to apply change to ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        if (this.options.stopOnFirstError) {
          break;
        }
      }
    }

    if (errors.length > 0) {
      throw new PatchError(
        `Failed to apply commit: ${errors.join(', ')}`,
        PatchErrorCode.FILE_SYSTEM_ERROR,
        { errors, commitId: commit.metadata.id }
      );
    }
  }

  /**
   * Validate commit before applying
   */
  private async validateCommit(
    commit: ReturnType<typeof this.applicator.generateCommit> extends Promise<infer T> ? T : never,
    currentFiles: Map<string, string>
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate that all changes are consistent
    for (const [filePath, change] of commit.changes) {
      switch (change.type) {
        case ActionType.ADD:
          if (currentFiles.has(filePath)) {
            errors.push(`Cannot add file that already exists: ${filePath}`);
          }
          if (change.newContent === undefined) {
            errors.push(`ADD change for ${filePath} missing new content`);
          }
          break;

        case ActionType.DELETE:
          if (!currentFiles.has(filePath)) {
            errors.push(`Cannot delete file that doesn't exist: ${filePath}`);
          }
          break;

        case ActionType.UPDATE:
          if (!currentFiles.has(filePath)) {
            errors.push(`Cannot update file that doesn't exist: ${filePath}`);
          }
          if (change.newContent === undefined) {
            errors.push(`UPDATE change for ${filePath} missing new content`);
          }
          
          // Validate move destination doesn't conflict
          if (change.movePath && currentFiles.has(change.movePath)) {
            errors.push(`Cannot move ${filePath} to ${change.movePath}: destination already exists`);
          }
          break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create failure result with consistent structure
   */
  private createFailureResult(
    error: PatchError, 
    startTime: number, 
    warnings: string[] = []
  ): PatchResult {
    return {
      success: false,
      filesModified: 0,
      filesCreated: 0,
      filesDeleted: 0,
      filesMoved: 0,
      fuzzScore: 0,
      executionTimeMs: Date.now() - startTime,
      modifiedFiles: [],
      fileContents: new Map(),
      warnings,
      error
    };
  }

  /**
   * Count files by operation type
   */
  private countFilesByType(
    commit: ReturnType<typeof this.applicator.generateCommit> extends Promise<infer T> ? T : never,
    type: ActionType
  ): number {
    let count = 0;
    for (const change of commit.changes.values()) {
      if (change.type === type) {
        count++;
      }
    }
    return count;
  }

  /**
   * Count files that were moved (UPDATE with movePath)
   */
  private countMovedFiles(
    commit: ReturnType<typeof this.applicator.generateCommit> extends Promise<infer T> ? T : never
  ): number {
    let count = 0;
    for (const change of commit.changes.values()) {
      if (change.type === ActionType.UPDATE && change.movePath) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get current configuration summary
   */
  getConfiguration(): PatchOptions {
    return { ...this.options };
  }

  /**
   * Get the root directory for patch operations
   */
  getRoot(): string {
    return this.rootedFileSystem.getRoot();
  }

  /**
   * Get component status and health information
   */
  async getStatus(): Promise<{
    configuration: PatchOptions;
    security: {
      permissions: PatchPermissions;
      fileAccess: Omit<FileAccessControl, 'allowedPaths' | 'forbiddenPaths'> & {
        allowedPatternCount: number;
        forbiddenPatternCount: number;
      };
    };
    contextFinder: {
      config: FuzzyMatchingConfig;
      strategies: string[];
      maxAttempts: number;
    };
    fileSystem: {
      available: boolean;
      error?: string;
    };
  }> {
    // Test file system availability
    let fileSystemStatus: { available: boolean; error?: string };
    try {
      await this.rootedFileSystem.exists(''); // Test basic operation
      fileSystemStatus = { available: true };
    } catch (error) {
      fileSystemStatus = { 
        available: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return {
      configuration: this.getConfiguration(),
      security: this.validator.getSecuritySummary(),
      contextFinder: this.contextFinder.getDebugInfo(),
      fileSystem: fileSystemStatus
    };
  }
}