import { describe, it, expect } from '@jest/globals';
import { ChunkApplicator } from '../ChunkApplicator';
import { ActionType, PatchAction } from '../types';

describe('ChunkApplicator', () => {
  let chunkApplicator: ChunkApplicator;

  beforeEach(() => {
    chunkApplicator = new ChunkApplicator();
  });

  describe('getUpdatedFile', () => {
    it('should apply single chunk with additions', () => {
      const text = 'line1\nline2\nline3';
      const action: PatchAction = {
        type: ActionType.UPDATE,
        chunks: [
          {
            orig_index: 1,
            del_lines: [],
            ins_lines: ['new_line'],
          },
        ],
      };

      const result = chunkApplicator.getUpdatedFile(text, action, 'test.py');

      expect(result).toBe('line1\nnew_line\nline2\nline3');
    });

    it('should apply single chunk with deletions', () => {
      const text = 'line1\nline2\nline3';
      const action: PatchAction = {
        type: ActionType.UPDATE,
        chunks: [
          {
            orig_index: 1,
            del_lines: ['line2'],
            ins_lines: [],
          },
        ],
      };

      const result = chunkApplicator.getUpdatedFile(text, action, 'test.py');

      expect(result).toBe('line1\nline3');
    });

    it('should apply single chunk with replacements', () => {
      const text = 'line1\nold_line\nline3';
      const action: PatchAction = {
        type: ActionType.UPDATE,
        chunks: [
          {
            orig_index: 1,
            del_lines: ['old_line'],
            ins_lines: ['new_line'],
          },
        ],
      };

      const result = chunkApplicator.getUpdatedFile(text, action, 'test.py');

      expect(result).toBe('line1\nnew_line\nline3');
    });

    it('should apply multiple chunks in order', () => {
      const text = 'line1\nold1\nline3\nold2\nline5';
      const action: PatchAction = {
        type: ActionType.UPDATE,
        chunks: [
          {
            orig_index: 1,
            del_lines: ['old1'],
            ins_lines: ['new1'],
          },
          {
            orig_index: 3,
            del_lines: ['old2'],
            ins_lines: ['new2'],
          },
        ],
      };

      const result = chunkApplicator.getUpdatedFile(text, action, 'test.py');

      expect(result).toBe('line1\nnew1\nline3\nnew2\nline5');
    });

    it('should handle chunk at beginning of file', () => {
      const text = 'old_first\nline2\nline3';
      const action: PatchAction = {
        type: ActionType.UPDATE,
        chunks: [
          {
            orig_index: 0,
            del_lines: ['old_first'],
            ins_lines: ['new_first'],
          },
        ],
      };

      const result = chunkApplicator.getUpdatedFile(text, action, 'test.py');

      expect(result).toBe('new_first\nline2\nline3');
    });

    it('should handle chunk at end of file', () => {
      const text = 'line1\nline2\nold_last';
      const action: PatchAction = {
        type: ActionType.UPDATE,
        chunks: [
          {
            orig_index: 2,
            del_lines: ['old_last'],
            ins_lines: ['new_last'],
          },
        ],
      };

      const result = chunkApplicator.getUpdatedFile(text, action, 'test.py');

      expect(result).toBe('line1\nline2\nnew_last');
    });

    it('should handle multiple insertions', () => {
      const text = 'line1\nline2';
      const action: PatchAction = {
        type: ActionType.UPDATE,
        chunks: [
          {
            orig_index: 1,
            del_lines: [],
            ins_lines: ['insert1', 'insert2', 'insert3'],
          },
        ],
      };

      const result = chunkApplicator.getUpdatedFile(text, action, 'test.py');

      expect(result).toBe('line1\ninsert1\ninsert2\ninsert3\nline2');
    });

    it('should handle multiple deletions', () => {
      const text = 'line1\ndelete1\ndelete2\ndelete3\nline5';
      const action: PatchAction = {
        type: ActionType.UPDATE,
        chunks: [
          {
            orig_index: 1,
            del_lines: ['delete1', 'delete2', 'delete3'],
            ins_lines: [],
          },
        ],
      };

      const result = chunkApplicator.getUpdatedFile(text, action, 'test.py');

      expect(result).toBe('line1\nline5');
    });

    it('should handle empty file', () => {
      const text = '';
      const action: PatchAction = {
        type: ActionType.UPDATE,
        chunks: [
          {
            orig_index: 0,
            del_lines: [],
            ins_lines: ['new_line'],
          },
        ],
      };

      const result = chunkApplicator.getUpdatedFile(text, action, 'test.py');

      expect(result).toBe('new_line');
    });

    it('should throw error for invalid chunk index', () => {
      const text = 'line1\nline2';
      const action: PatchAction = {
        type: ActionType.UPDATE,
        chunks: [
          {
            orig_index: 5, // Beyond file length
            del_lines: [],
            ins_lines: ['new_line'],
          },
        ],
      };

      expect(() => chunkApplicator.getUpdatedFile(text, action, 'test.py'))
        .toThrow('chunk.orig_index 5 > len(lines) 2');
    });

    it('should throw error for non-sequential chunks', () => {
      const text = 'line1\nline2\nline3';
      const action: PatchAction = {
        type: ActionType.UPDATE,
        chunks: [
          {
            orig_index: 2,
            del_lines: [],
            ins_lines: ['first'],
          },
          {
            orig_index: 1, // Goes backwards
            del_lines: [],
            ins_lines: ['second'],
          },
        ],
      };

      expect(() => chunkApplicator.getUpdatedFile(text, action, 'test.py'))
        .toThrow('orig_index 2 > chunk.orig_index 1');
    });

    it('should throw error for non-UPDATE action', () => {
      const text = 'content';
      const action: PatchAction = {
        type: ActionType.ADD,
        chunks: [],
      };

      expect(() => chunkApplicator.getUpdatedFile(text, action, 'test.py'))
        .toThrow('Expected UPDATE action');
    });
  });

  describe('patchToCommit', () => {
    it('should convert DELETE action', () => {
      const patch = {
        actions: {
          'delete.py': {
            type: ActionType.DELETE,
            chunks: [],
          },
        },
      };
      const orig = { 'delete.py': 'content to delete' };

      const commit = chunkApplicator.patchToCommit(patch, orig);

      expect(commit.changes['delete.py']).toEqual({
        type: ActionType.DELETE,
        old_content: 'content to delete',
      });
    });

    it('should convert ADD action', () => {
      const patch = {
        actions: {
          'new.py': {
            type: ActionType.ADD,
            new_file: 'new content',
            chunks: [],
          },
        },
      };
      const orig = {};

      const commit = chunkApplicator.patchToCommit(patch, orig);

      expect(commit.changes['new.py']).toEqual({
        type: ActionType.ADD,
        new_content: 'new content',
      });
    });

    it('should convert UPDATE action', () => {
      const patch = {
        actions: {
          'update.py': {
            type: ActionType.UPDATE,
            chunks: [
              {
                orig_index: 0,
                del_lines: ['old'],
                ins_lines: ['new'],
              },
            ],
          },
        },
      };
      const orig = { 'update.py': 'old' };

      const commit = chunkApplicator.patchToCommit(patch, orig);

      expect(commit.changes['update.py']).toEqual({
        type: ActionType.UPDATE,
        old_content: 'old',
        new_content: 'new',
        move_path: undefined,
      });
    });

    it('should convert UPDATE action with move', () => {
      const patch = {
        actions: {
          'old.py': {
            type: ActionType.UPDATE,
            move_path: 'new.py',
            chunks: [
              {
                orig_index: 0,
                del_lines: ['old'],
                ins_lines: ['new'],
              },
            ],
          },
        },
      };
      const orig = { 'old.py': 'old' };

      const commit = chunkApplicator.patchToCommit(patch, orig);

      expect(commit.changes['old.py']).toEqual({
        type: ActionType.UPDATE,
        old_content: 'old',
        new_content: 'new',
        move_path: 'new.py',
      });
    });

    it('should handle multiple actions', () => {
      const patch = {
        actions: {
          'delete.py': { type: ActionType.DELETE, chunks: [] },
          'add.py': { type: ActionType.ADD, new_file: 'content', chunks: [] },
          'update.py': {
            type: ActionType.UPDATE,
            chunks: [
              {
                orig_index: 0,
                del_lines: ['old'],
                ins_lines: ['new'],
              },
            ],
          },
        },
      };
      const orig = {
        'delete.py': 'to delete',
        'update.py': 'old',
      };

      const commit = chunkApplicator.patchToCommit(patch, orig);

      expect(Object.keys(commit.changes)).toHaveLength(3);
      expect(commit.changes['delete.py']?.type).toBe(ActionType.DELETE);
      expect(commit.changes['add.py']?.type).toBe(ActionType.ADD);
      expect(commit.changes['update.py']?.type).toBe(ActionType.UPDATE);
    });
  });

  describe('assembleChanges', () => {
    it('should detect UPDATE when content differs', () => {
      const orig = { 'file.py': 'old content' };
      const updated = { 'file.py': 'new content' };

      const commit = chunkApplicator.assembleChanges(orig, updated);

      expect(commit.changes['file.py']).toEqual({
        type: ActionType.UPDATE,
        old_content: 'old content',
        new_content: 'new content',
      });
    });

    it('should detect ADD when file is new', () => {
      const orig = {};
      const updated = { 'new.py': 'new content' };

      const commit = chunkApplicator.assembleChanges(orig, updated);

      expect(commit.changes['new.py']).toEqual({
        type: ActionType.ADD,
        new_content: 'new content',
      });
    });

    it('should detect DELETE when file is removed', () => {
      const orig = { 'delete.py': 'content' };
      const updated = {};

      const commit = chunkApplicator.assembleChanges(orig, updated);

      expect(commit.changes['delete.py']).toEqual({
        type: ActionType.DELETE,
        old_content: 'content',
      });
    });

    it('should ignore unchanged files', () => {
      const orig = { 'unchanged.py': 'same content' };
      const updated = { 'unchanged.py': 'same content' };

      const commit = chunkApplicator.assembleChanges(orig, updated);

      expect(Object.keys(commit.changes)).toHaveLength(0);
    });

    it('should handle mixed changes', () => {
      const orig = {
        'unchanged.py': 'same',
        'update.py': 'old',
        'delete.py': 'content',
      };
      const updated = {
        'unchanged.py': 'same',
        'update.py': 'new',
        'add.py': 'new file',
      };

      const commit = chunkApplicator.assembleChanges(orig, updated);

      expect(Object.keys(commit.changes)).toHaveLength(3);
      expect(commit.changes['update.py']?.type).toBe(ActionType.UPDATE);
      expect(commit.changes['delete.py']?.type).toBe(ActionType.DELETE);
      expect(commit.changes['add.py']?.type).toBe(ActionType.ADD);
    });

    it('should handle null values', () => {
      const orig = { 'file.py': null };
      const updated = { 'file.py': 'content' };

      const commit = chunkApplicator.assembleChanges(orig, updated);

      expect(commit.changes['file.py']).toEqual({
        type: ActionType.ADD,
        new_content: 'content',
      });
    });

    it('should skip unchanged files with undefined values', () => {
      const orig = { 'file.py': undefined as any };
      const updated = { 'file.py': undefined as any };

      const commit = chunkApplicator.assembleChanges(orig, updated);
      
      expect(Object.keys(commit.changes)).toHaveLength(0);
    });
  });
});