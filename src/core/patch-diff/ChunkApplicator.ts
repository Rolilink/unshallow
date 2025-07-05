import { PatchAction, ActionType, Commit, DiffError } from './types';

/**
 * ChunkApplicator handles applying patches to file content and generating commits
 * Direct adaptation of functions from original implementation
 */
export class ChunkApplicator {
  /**
   * Apply chunks to a file to generate new content
   * Direct adaptation of _get_updated_file from original implementation
   */
  getUpdatedFile(
    text: string,
    action: PatchAction,
    path: string
  ): string {
    if (action.type !== ActionType.UPDATE) {
      throw new Error('Expected UPDATE action');
    }
    
    const origLines = text.split('\n');
    const destLines: string[] = [];
    let origIndex = 0;
    
    for (const chunk of action.chunks) {
      if (chunk.orig_index > origLines.length) {
        throw new DiffError(
          `${path}: chunk.orig_index ${chunk.orig_index} > len(lines) ${origLines.length}`
        );
      }
      if (origIndex > chunk.orig_index) {
        throw new DiffError(
          `${path}: orig_index ${origIndex} > chunk.orig_index ${chunk.orig_index}`
        );
      }
      
      // Copy unchanged lines before chunk
      destLines.push(...origLines.slice(origIndex, chunk.orig_index));
      const delta = chunk.orig_index - origIndex;
      origIndex += delta;

      // Insert new lines
      if (chunk.ins_lines.length) {
        for (const l of chunk.ins_lines) {
          destLines.push(l);
        }
      }
      
      // Skip deleted lines
      origIndex += chunk.del_lines.length;
    }
    
    // Copy remaining lines after last chunk
    destLines.push(...origLines.slice(origIndex));
    
    const result = destLines.join('\n');
    
    // Handle empty file case
    if (text === '') {
      return result.replace(/\n$/, ''); // Remove trailing newline for empty files
    }
    
    return result;
  }

  /**
   * Convert a Patch object to a Commit with file changes
   * Direct adaptation of patch_to_commit from original implementation
   */
  patchToCommit(
    patch: import('./types').Patch,
    orig: Record<string, string>
  ): Commit {
    const commit: Commit = { changes: {} };
    
    for (const [pathKey, action] of Object.entries(patch.actions)) {
      if (action.type === ActionType.DELETE) {
        commit.changes[pathKey] = {
          type: ActionType.DELETE,
          old_content: orig[pathKey],
        };
      } else if (action.type === ActionType.ADD) {
        commit.changes[pathKey] = {
          type: ActionType.ADD,
          new_content: action.new_file ?? '',
        };
      } else if (action.type === ActionType.UPDATE) {
        const newContent = this.getUpdatedFile(orig[pathKey]!, action, pathKey);
        commit.changes[pathKey] = {
          type: ActionType.UPDATE,
          old_content: orig[pathKey],
          new_content: newContent,
          move_path: action.move_path ?? undefined,
        };
      }
    }
    
    return commit;
  }

  /**
   * Assemble changes by comparing original and updated file states
   * Direct adaptation of assemble_changes from original implementation
   */
  assembleChanges(
    orig: Record<string, string | null>,
    updatedFiles: Record<string, string | null>
  ): Commit {
    const commit: Commit = { changes: {} };
    
    // Check for files in updated that changed
    for (const [p, newContent] of Object.entries(updatedFiles)) {
      const oldContent = orig[p];
      if (oldContent === newContent) {
        continue;
      }
      if (oldContent !== undefined && oldContent !== null && newContent !== undefined && newContent !== null) {
        commit.changes[p] = {
          type: ActionType.UPDATE,
          old_content: oldContent,
          new_content: newContent,
        };
      } else if ((oldContent === null || oldContent === undefined) && newContent !== undefined && newContent !== null) {
        commit.changes[p] = {
          type: ActionType.ADD,
          new_content: newContent,
        };
      } else if (oldContent !== undefined && oldContent !== null && (newContent === null || newContent === undefined)) {
        commit.changes[p] = {
          type: ActionType.DELETE,
          old_content: oldContent,
        };
      } else if (oldContent === null && newContent !== null) {
        commit.changes[p] = {
          type: ActionType.UPDATE,
          old_content: oldContent,
          new_content: newContent,
        };
      } else if (oldContent === undefined && newContent === undefined) {
        throw new Error('Unexpected state in assemble_changes');
      } else {
        // Catch any other unexpected combinations
        throw new Error('Unexpected state in assemble_changes');
      }
    }
    
    // Check for files that were deleted (exist in orig but not in updated)
    for (const [p, oldContent] of Object.entries(orig)) {
      if (!(p in updatedFiles) && oldContent !== undefined && oldContent !== null) {
        commit.changes[p] = {
          type: ActionType.DELETE,
          old_content: oldContent,
        };
      }
    }
    
    return commit;
  }
}