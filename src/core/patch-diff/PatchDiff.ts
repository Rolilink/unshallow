import { IFileSystem } from '../file-system/types';
import {
  PatchResult,
  ValidationResult,
  PreviewResult,
  FileChange,
  ActionType,
  FileNotFoundError,
  FileExistsError,
  InvalidPatchError,
  PATCH_PREFIX,
} from './types';
import { textToPatch, identifyFilesNeeded, identifyFilesAdded, identifyFilesUpdated } from './PatchParser';
import { ChunkApplicator } from './ChunkApplicator';
import { SecurityValidator } from './SecurityValidator';

/**
 * Main PatchDiff class that orchestrates the patch application process
 * Integrates with IFileSystem interface for file operations
 */
export class PatchDiff {
  private chunkApplicator: ChunkApplicator;
  private securityValidator: SecurityValidator;

  constructor(
    private fileSystem: IFileSystem,
    private rootPath: string
  ) {
    this.chunkApplicator = new ChunkApplicator();
    this.securityValidator = new SecurityValidator();
  }

  /**
   * Apply a V4A format patch to the file system
   * Main entry point that replicates process_patch functionality
   */
  async apply(patchText: string): Promise<PatchResult> {
    try {
      // Step 1: Validate patch format (from process_patch line 709)
      if (!patchText.startsWith(PATCH_PREFIX)) {
        throw new InvalidPatchError('Patch must start with *** Begin Patch\\n');
      }

      // Step 2: Parse to identify files that need to be loaded
      const filesNeeded = identifyFilesNeeded(patchText);
      const filesAdded = identifyFilesAdded(patchText);

      // Step 3: Security validation
      this.securityValidator.validatePaths([...filesNeeded, ...filesAdded]);

      // Step 4: Load existing files (from load_files function)
      const fileContents: Record<string, string> = {};
      for (const relativePath of filesNeeded) {
        try {
          const fullPath = this.securityValidator.resolvePath(this.rootPath, relativePath);
          const content = await this.fileSystem.read(fullPath);
          fileContents[relativePath] = content;
        } catch (error) {
          // Convert any file read error into a DiffError (from original line 674-677)
          throw new FileNotFoundError(`File not found: ${relativePath}`);
        }
      }

      // Step 5: Check for conflicts with ADD operations
      for (const relativePath of filesAdded) {
        const fullPath = this.securityValidator.resolvePath(this.rootPath, relativePath);
        const exists = await this.fileSystem.exists(fullPath);
        if (exists) {
          throw new FileExistsError(`Add File Error: File already exists: ${relativePath}`);
        }
      }

      // Step 6: Parse patch with file contents (from text_to_patch)
      const [patch, fuzz] = textToPatch(patchText, fileContents);

      // Step 7: Generate commit (from patch_to_commit)
      const commit = this.chunkApplicator.patchToCommit(patch, fileContents);

      // Step 8: Apply changes to file system (from apply_commit)
      const changes: FileChange[] = [];
      for (const [relativePath, change] of Object.entries(commit.changes)) {
        await this.applyChange(relativePath, change);
        changes.push(change);
      }

      return {
        success: true,
        changes,
        fuzz,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Validate patch without applying it
   */
  validate(patchText: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic format validation
      if (!patchText.startsWith(PATCH_PREFIX)) {
        errors.push('Patch must start with *** Begin Patch');
      }

      // Try to identify files
      const filesNeeded = identifyFilesNeeded(patchText);
      const filesAdded = identifyFilesAdded(patchText);

      // Security validation
      try {
        this.securityValidator.validatePaths([...filesNeeded, ...filesAdded]);
      } catch (error) {
        errors.push((error as Error).message);
      }

      // Try to parse (without file contents for basic syntax check)
      try {
        textToPatch(patchText, {});
      } catch (error) {
        const message = (error as Error).message;
        if (!message.includes('Missing File')) {
          errors.push(message);
        }
      }

    } catch (error) {
      errors.push((error as Error).message);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Preview changes without applying them
   */
  async preview(patchText: string): Promise<PreviewResult> {
    const filesUpdated = identifyFilesUpdated(patchText);
    const filesAdded = identifyFilesAdded(patchText);

    const files = [];

    // Add preview for files that will be updated
    for (const path of filesUpdated) {
      files.push({
        path,
        action: ActionType.UPDATE,
        preview: 'File will be updated',
      });
    }

    // Add preview for files that will be added
    for (const path of filesAdded) {
      files.push({
        path,
        action: ActionType.ADD,
        preview: 'File will be created',
      });
    }

    return { files };
  }

  /**
   * Apply a single file change to the file system
   * Based on apply_commit function from original implementation
   */
  private async applyChange(
    relativePath: string,
    change: FileChange
  ): Promise<void> {
    const fullPath = this.securityValidator.resolvePath(this.rootPath, relativePath);

    switch (change.type) {
      case ActionType.DELETE:
        await this.fileSystem.delete(fullPath);
        break;

      case ActionType.ADD:
        // Ensure parent directory exists (from write_file function line 732-735)
        const parentDir = this.securityValidator.getParentDirectory(relativePath);
        if (parentDir) {
          const parentFullPath = this.securityValidator.resolvePath(this.rootPath, parentDir);
          await this.fileSystem.mkdir(parentFullPath, { recursive: true });
        }
        await this.fileSystem.write(fullPath, change.new_content || '');
        break;

      case ActionType.UPDATE:
        if (change.move_path) {
          // Move operation: write to new location, delete old
          const newFullPath = this.securityValidator.resolvePath(this.rootPath, change.move_path);
          
          // Ensure parent directory exists for new location
          const newParentDir = this.securityValidator.getParentDirectory(change.move_path);
          if (newParentDir) {
            const newParentFullPath = this.securityValidator.resolvePath(this.rootPath, newParentDir);
            await this.fileSystem.mkdir(newParentFullPath, { recursive: true });
          }
          
          await this.fileSystem.write(newFullPath, change.new_content || '');
          await this.fileSystem.delete(fullPath);
        } else {
          // Update in place
          await this.fileSystem.write(fullPath, change.new_content || '');
        }
        break;
    }
  }
}