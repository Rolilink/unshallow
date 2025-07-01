/**
 * ChunkApplicator component for applying patch chunks to generate new file content.
 * 
 * Handles the transformation of original file content by applying parsed chunks
 * in the correct order. Validates chunk integrity and generates the final
 * commit structure with all file changes.
 */

import {
  ActionType,
  Chunk,
  PatchAction,
  ParsedPatch,
  FileChange,
  Commit,
  PatchOptions,
  PatchError,
  PatchErrorCode
} from './types';
import { ContextFinder } from './ContextFinder';

/**
 * Result of chunk validation
 */
interface ChunkValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  overlappingChunks?: Array<{ chunk1: number; chunk2: number }>;
}

/**
 * ChunkApplicator component for transforming file content using patch chunks.
 * Uses ContextFinder to verify chunk locations and applies changes atomically.
 */
export class ChunkApplicator {
  private readonly contextFinder: ContextFinder;

  constructor(private readonly options: PatchOptions) {
    this.contextFinder = new ContextFinder(options);
  }

  /**
   * Generate commit from parsed patch and current file contents
   */
  async generateCommit(
    patch: ParsedPatch,
    currentFiles: Map<string, string>
  ): Promise<Commit> {
    const changes = new Map<string, FileChange>();
    const commitId = this.generateCommitId();

    for (const [filePath, action] of patch.actions) {
      const change = await this.processAction(action, currentFiles);
      changes.set(filePath, change);
    }

    return {
      changes,
      metadata: {
        totalFiles: changes.size,
        createdAt: new Date(),
        id: commitId
      }
    };
  }

  /**
   * Apply chunks to original content and return new content
   */
  applyChunks(originalContent: string, chunks: Chunk[]): string {
    if (chunks.length === 0) {
      return originalContent;
    }

    // Validate chunks before applying
    const validation = this.validateChunks(chunks, originalContent);
    if (!validation.isValid) {
      throw new PatchError(
        `Chunk validation failed: ${validation.errors.join(', ')}`,
        PatchErrorCode.OVERLAPPING_CHUNKS,
        { 
          errors: validation.errors,
          overlappingChunks: validation.overlappingChunks 
        }
      );
    }

    const originalLines = originalContent.split('\n');
    const resultLines: string[] = [];
    let originalIndex = 0;

    // Sort chunks by original index to ensure correct application order
    const sortedChunks = [...chunks].sort((a, b) => a.origIndex - b.origIndex);

    for (const chunk of sortedChunks) {
      // Validate chunk index bounds
      if (chunk.origIndex > originalLines.length) {
        throw new PatchError(
          `Chunk original index ${chunk.origIndex} exceeds file length ${originalLines.length}`,
          PatchErrorCode.OVERLAPPING_CHUNKS,
          { chunkIndex: chunk.origIndex, fileLength: originalLines.length }
        );
      }

      // Copy unchanged lines before this chunk
      if (originalIndex < chunk.origIndex) {
        resultLines.push(...originalLines.slice(originalIndex, chunk.origIndex));
      }

      // Apply the chunk changes
      resultLines.push(...chunk.insLines);

      // Update position after deleted lines
      originalIndex = chunk.origIndex + chunk.delLines.length;
    }

    // Copy remaining unchanged lines
    if (originalIndex < originalLines.length) {
      resultLines.push(...originalLines.slice(originalIndex));
    }

    return resultLines.join('\n');
  }

  /**
   * Process a single patch action into a file change
   */
  private async processAction(
    action: PatchAction,
    currentFiles: Map<string, string>
  ): Promise<FileChange> {
    switch (action.type) {
      case ActionType.ADD:
        return this.processAddAction(action);

      case ActionType.DELETE:
        return this.processDeleteAction(action, currentFiles);

      case ActionType.UPDATE:
        return this.processUpdateAction(action, currentFiles);

      default:
        throw new PatchError(
          `Unknown action type: ${(action as any).type}`,
          PatchErrorCode.INVALID_ACTION,
          { action }
        );
    }
  }

  /**
   * Process ADD action
   */
  private processAddAction(action: PatchAction): FileChange {
    if (!action.newFile) {
      throw new PatchError(
        `ADD action missing file content for ${action.filePath}`,
        PatchErrorCode.INVALID_ACTION,
        { filePath: action.filePath }
      );
    }

    return {
      type: ActionType.ADD,
      newContent: action.newFile,
      hasBackup: false
    };
  }

  /**
   * Process DELETE action
   */
  private processDeleteAction(
    action: PatchAction,
    currentFiles: Map<string, string>
  ): FileChange {
    const oldContent = currentFiles.get(action.filePath);
    if (oldContent === undefined) {
      throw new PatchError(
        `Cannot delete non-existent file: ${action.filePath}`,
        PatchErrorCode.FILE_NOT_FOUND,
        { filePath: action.filePath },
        action.filePath
      );
    }

    return {
      type: ActionType.DELETE,
      oldContent,
      hasBackup: this.options.createBackups
    };
  }

  /**
   * Process UPDATE action
   */
  private async processUpdateAction(
    action: PatchAction,
    currentFiles: Map<string, string>
  ): Promise<FileChange> {
    const oldContent = currentFiles.get(action.filePath);
    if (oldContent === undefined) {
      throw new PatchError(
        `Cannot update non-existent file: ${action.filePath}`,
        PatchErrorCode.FILE_NOT_FOUND,
        { filePath: action.filePath },
        action.filePath
      );
    }

    // Verify chunks can be applied
    await this.verifyChunksInContent(action.chunks, oldContent, action.filePath);

    // Apply chunks to generate new content
    const newContent = this.applyChunks(oldContent, action.chunks);

    return {
      type: ActionType.UPDATE,
      oldContent,
      newContent,
      movePath: action.movePath,
      hasBackup: this.options.createBackups
    };
  }

  /**
   * Verify that chunks can be correctly applied to the content
   */
  private async verifyChunksInContent(
    chunks: Chunk[],
    content: string,
    filePath: string
  ): Promise<void> {
    const contentLines = content.split('\n');

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;

      // Verify chunk bounds
      if (chunk.origIndex < 0 || chunk.origIndex > contentLines.length) {
        throw new PatchError(
          `Chunk ${i} has invalid original index ${chunk.origIndex}`,
          PatchErrorCode.OVERLAPPING_CHUNKS,
          { chunkIndex: i, origIndex: chunk.origIndex, fileLength: contentLines.length },
          filePath
        );
      }

      // Verify deleted lines match original content
      const endIndex = chunk.origIndex + chunk.delLines.length;
      if (endIndex > contentLines.length) {
        throw new PatchError(
          `Chunk ${i} deletion extends beyond file end`,
          PatchErrorCode.OVERLAPPING_CHUNKS,
          { chunkIndex: i, endIndex, fileLength: contentLines.length },
          filePath
        );
      }

      const originalSlice = contentLines.slice(chunk.origIndex, endIndex);
      if (!this.arraysEqual(originalSlice, chunk.delLines)) {
        // Try fuzzy matching if enabled
        if (this.options.fuzzyMatching.enabled) {
          const contextMatch = await this.contextFinder.findContext(
            content,
            chunk.delLines
          );
          
          if (contextMatch.index !== chunk.origIndex) {
            throw new PatchError(
              `Chunk ${i} deleted lines don't match original content at index ${chunk.origIndex}`,
              PatchErrorCode.CONTEXT_NOT_FOUND,
              {
                chunkIndex: i,
                expectedLines: chunk.delLines,
                actualLines: originalSlice,
                suggestedIndex: contextMatch.index
              },
              filePath
            );
          }
        } else {
          throw new PatchError(
            `Chunk ${i} deleted lines don't match original content`,
            PatchErrorCode.CONTEXT_NOT_FOUND,
            {
              chunkIndex: i,
              expectedLines: chunk.delLines,
              actualLines: originalSlice
            },
            filePath
          );
        }
      }
    }
  }

  /**
   * Validate chunks for overlaps and ordering issues
   */
  private validateChunks(chunks: Chunk[], originalContent: string): ChunkValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const overlappingChunks: Array<{ chunk1: number; chunk2: number }> = [];

    if (chunks.length === 0) {
      return { isValid: true, errors, warnings };
    }

    const originalLines = originalContent.split('\n');

    // Sort chunks by original index for validation
    const indexedChunks = chunks.map((chunk, index) => ({ chunk, index }))
      .sort((a, b) => a.chunk.origIndex - b.chunk.origIndex);

    // Check for overlapping chunks
    for (let i = 0; i < indexedChunks.length - 1; i++) {
      const current = indexedChunks[i];
      const next = indexedChunks[i + 1];
      if (!current || !next) continue;

      const currentEnd = current.chunk.origIndex + current.chunk.delLines.length;
      const nextStart = next.chunk.origIndex;

      if (currentEnd > nextStart) {
        errors.push(
          `Chunks ${current.index} and ${next.index} overlap: ` +
          `chunk ${current.index} ends at ${currentEnd}, chunk ${next.index} starts at ${nextStart}`
        );
        overlappingChunks.push({ chunk1: current.index, chunk2: next.index });
      }
    }

    // Check chunk bounds
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;

      if (chunk.origIndex < 0) {
        errors.push(`Chunk ${i} has negative original index: ${chunk.origIndex}`);
      }

      if (chunk.origIndex > originalLines.length) {
        errors.push(
          `Chunk ${i} original index ${chunk.origIndex} exceeds file length ${originalLines.length}`
        );
      }

      const chunkEnd = chunk.origIndex + chunk.delLines.length;
      if (chunkEnd > originalLines.length) {
        errors.push(
          `Chunk ${i} extends beyond file end: ends at ${chunkEnd}, file has ${originalLines.length} lines`
        );
      }

      // Warn about empty chunks
      if (chunk.delLines.length === 0 && chunk.insLines.length === 0) {
        warnings.push(`Chunk ${i} is empty (no deletions or insertions)`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      overlappingChunks: overlappingChunks.length > 0 ? overlappingChunks : undefined
    };
  }

  /**
   * Generate unique commit ID
   */
  private generateCommitId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `patch-${timestamp}-${random}`;
  }

  /**
   * Check if two string arrays are equal
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }

  /**
   * Get statistics about chunk application
   */
  getChunkStatistics(chunks: Chunk[]): {
    totalChunks: number;
    totalDeletions: number;
    totalInsertions: number;
    averageChunkSize: number;
    netChange: number;
  } {
    if (chunks.length === 0) {
      return {
        totalChunks: 0,
        totalDeletions: 0,
        totalInsertions: 0,
        averageChunkSize: 0,
        netChange: 0
      };
    }

    const totalDeletions = chunks.reduce((sum, chunk) => sum + chunk.delLines.length, 0);
    const totalInsertions = chunks.reduce((sum, chunk) => sum + chunk.insLines.length, 0);
    const averageChunkSize = (totalDeletions + totalInsertions) / chunks.length;
    const netChange = totalInsertions - totalDeletions;

    return {
      totalChunks: chunks.length,
      totalDeletions,
      totalInsertions,
      averageChunkSize: Math.round(averageChunkSize * 100) / 100,
      netChange
    };
  }

  /**
   * Preview what changes would be made without applying them
   */
  previewChanges(originalContent: string, chunks: Chunk[]): {
    preview: string;
    statistics: {
      totalChunks: number;
      totalDeletions: number;
      totalInsertions: number;
      averageChunkSize: number;
      netChange: number;
    };
    validation: ChunkValidationResult;
  } {
    const validation = this.validateChunks(chunks, originalContent);
    const statistics = this.getChunkStatistics(chunks);

    let preview: string;
    try {
      preview = this.applyChunks(originalContent, chunks);
    } catch (error) {
      preview = `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    return {
      preview,
      statistics,
      validation
    };
  }
}