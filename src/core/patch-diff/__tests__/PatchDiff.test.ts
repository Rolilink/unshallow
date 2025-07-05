import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PatchDiff } from '../PatchDiff';
import { IFileSystem } from '../../file-system/types';
import { ActionType } from '../types';

// Mock implementation of IFileSystem
class MockFileSystem implements IFileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  // Public methods for test setup
  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  fileExists(path: string): boolean {
    return this.files.has(path);
  }

  getFile(path: string): string | undefined {
    return this.files.get(path);
  }

  clear(): void {
    this.files.clear();
    this.directories.clear();
  }

  // IFileSystem implementation
  async read(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async readAsJson<T = unknown>(path: string): Promise<T> {
    const content = await this.read(path);
    return JSON.parse(content);
  }

  async write(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async delete(path: string): Promise<void> {
    if (!this.files.has(path)) {
      throw new Error(`File not found: ${path}`);
    }
    this.files.delete(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async mkdir(path: string, _options?: { recursive?: boolean }): Promise<void> {
    this.directories.add(path);
  }
}

describe('PatchDiff', () => {
  let mockFileSystem: MockFileSystem;
  let patchDiff: PatchDiff;
  const rootPath = '/project/root';

  beforeEach(() => {
    mockFileSystem = new MockFileSystem();
    patchDiff = new PatchDiff(mockFileSystem, rootPath);
  });

  describe('apply', () => {
    it('should apply simple UPDATE patch', async () => {
      const patchText = `*** Begin Patch
*** Update File: test.py
 def hello():
-    print("old")
+    print("new")
*** End Patch`;

      mockFileSystem.setFile(`${rootPath}/test.py`, 'def hello():\n    print("old")');

      const result = await patchDiff.apply(patchText);

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes?.[0]?.type).toBe(ActionType.UPDATE);
      expect(mockFileSystem.getFile(`${rootPath}/test.py`)).toBe('def hello():\n    print("new")');
    });

    it('should apply ADD patch', async () => {
      const patchText = `*** Begin Patch
*** Add File: new.py
+def new_function():
+    return "hello"
*** End Patch`;

      const result = await patchDiff.apply(patchText);

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes?.[0]?.type).toBe(ActionType.ADD);
      expect(mockFileSystem.getFile(`${rootPath}/new.py`)).toBe('def new_function():\n    return "hello"');
    });

    it('should apply DELETE patch', async () => {
      const patchText = `*** Begin Patch
*** Delete File: old.py
*** End Patch`;

      mockFileSystem.setFile(`${rootPath}/old.py`, 'content to delete');

      const result = await patchDiff.apply(patchText);

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes?.[0]?.type).toBe(ActionType.DELETE);
      expect(mockFileSystem.fileExists(`${rootPath}/old.py`)).toBe(false);
    });

    it('should apply MOVE patch', async () => {
      const patchText = `*** Begin Patch
*** Update File: old.py
*** Move to: new.py
 def function():
-    old_logic()
+    new_logic()
*** End Patch`;

      mockFileSystem.setFile(`${rootPath}/old.py`, 'def function():\n    old_logic()');

      const result = await patchDiff.apply(patchText);

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes?.[0]?.move_path).toBe('new.py');
      expect(mockFileSystem.fileExists(`${rootPath}/old.py`)).toBe(false);
      expect(mockFileSystem.getFile(`${rootPath}/new.py`)).toBe('def function():\n    new_logic()');
    });

    it('should apply multi-file patch', async () => {
      const patchText = `*** Begin Patch
*** Update File: update.py
-old_line
+new_line
*** Add File: add.py
+new_content
*** Delete File: delete.py
*** End Patch`;

      mockFileSystem.setFile(`${rootPath}/update.py`, 'old_line');
      mockFileSystem.setFile(`${rootPath}/delete.py`, 'content');

      const result = await patchDiff.apply(patchText);

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(3);
      expect(mockFileSystem.getFile(`${rootPath}/update.py`)).toBe('new_line');
      expect(mockFileSystem.getFile(`${rootPath}/add.py`)).toBe('new_content');
      expect(mockFileSystem.fileExists(`${rootPath}/delete.py`)).toBe(false);
    });

    it('should create parent directories for ADD operations', async () => {
      const patchText = `*** Begin Patch
*** Add File: deep/nested/new.py
+content
*** End Patch`;

      const result = await patchDiff.apply(patchText);

      expect(result.success).toBe(true);
      expect(mockFileSystem.getFile(`${rootPath}/deep/nested/new.py`)).toBe('content');
    });

    it('should create parent directories for MOVE operations', async () => {
      const patchText = `*** Begin Patch
*** Update File: old.py
*** Move to: deep/nested/new.py
-old
+new
*** End Patch`;

      mockFileSystem.setFile(`${rootPath}/old.py`, 'old');

      const result = await patchDiff.apply(patchText);

      expect(result.success).toBe(true);
      expect(mockFileSystem.fileExists(`${rootPath}/old.py`)).toBe(false);
      expect(mockFileSystem.getFile(`${rootPath}/deep/nested/new.py`)).toBe('new');
    });

    it('should return fuzz score', async () => {
      const patchText = `*** Begin Patch
*** Update File: test.py
 def hello():
-    print("old")  
+    print("new")
*** End Patch`;

      // File has trailing spaces, patch doesn't - should cause fuzz
      mockFileSystem.setFile(`${rootPath}/test.py`, 'def hello():\n    print("old")   ');

      const result = await patchDiff.apply(patchText);

      expect(result.success).toBe(true);
      expect(result.fuzz).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      const patchText = `*** Begin Patch
*** Update File: missing.py
-old
+new
*** End Patch`;

      // File doesn't exist

      const result = await patchDiff.apply(patchText);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('File not found');
    });

    it('should reject invalid patch format', async () => {
      const patchText = 'Not a valid patch';

      const result = await patchDiff.apply(patchText);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Patch must start with *** Begin Patch');
    });

    it('should reject ADD operation for existing file', async () => {
      const patchText = `*** Begin Patch
*** Add File: existing.py
+content
*** End Patch`;

      mockFileSystem.setFile(`${rootPath}/existing.py`, 'already exists');

      const result = await patchDiff.apply(patchText);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('File already exists');
    });

    it('should reject security violations', async () => {
      const patchText = `*** Begin Patch
*** Add File: ../outside.py
+content
*** End Patch`;

      const result = await patchDiff.apply(patchText);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Path traversal not allowed');
    });
  });

  describe('validate', () => {
    it('should validate correct patch format', () => {
      const patchText = `*** Begin Patch
*** Update File: test.py
-old
+new
*** End Patch`;

      const result = patchDiff.validate(patchText);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing begin marker', () => {
      const patchText = `*** Update File: test.py
-old
+new
*** End Patch`;

      const result = patchDiff.validate(patchText);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Patch must start with *** Begin Patch');
    });

    it('should detect security violations', () => {
      const patchText = `*** Begin Patch
*** Add File: ../dangerous.py
+content
*** End Patch`;

      const result = patchDiff.validate(patchText);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Path traversal not allowed'))).toBe(true);
    });

    it('should detect absolute paths', () => {
      const patchText = `*** Begin Patch
*** Add File: /absolute/path.py
+content
*** End Patch`;

      const result = patchDiff.validate(patchText);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Absolute path not allowed'))).toBe(true);
    });

    it('should validate syntax without file contents', () => {
      const patchText = `*** Begin Patch
*** Update File: non-existent.py
-old
+new
*** End Patch`;

      const result = patchDiff.validate(patchText);

      // Should pass validation even though file doesn't exist
      // (that's checked during apply, not validate)
      expect(result.valid).toBe(true);
    });

    it('should detect malformed patch syntax', () => {
      const patchText = `*** Begin Patch
*** Invalid Command: test.py
*** End Patch`;

      const result = patchDiff.validate(patchText);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Unknown Line'))).toBe(true);
    });
  });

  describe('preview', () => {
    it('should preview UPDATE operations', async () => {
      const patchText = `*** Begin Patch
*** Update File: update.py
-old
+new
*** End Patch`;

      const result = await patchDiff.preview(patchText);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toEqual({
        path: 'update.py',
        action: ActionType.UPDATE,
        preview: 'File will be updated',
      });
    });

    it('should preview ADD operations', async () => {
      const patchText = `*** Begin Patch
*** Add File: new.py
+content
*** End Patch`;

      const result = await patchDiff.preview(patchText);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toEqual({
        path: 'new.py',
        action: ActionType.ADD,
        preview: 'File will be created',
      });
    });

    it('should preview mixed operations', async () => {
      const patchText = `*** Begin Patch
*** Update File: update.py
-old
+new

*** Add File: add.py
+content

*** Delete File: delete.py
*** End Patch`;

      const result = await patchDiff.preview(patchText);

      expect(result.files).toHaveLength(2); // UPDATE and ADD (DELETE doesn't show in preview)
      expect(result.files.some(f => f.action === ActionType.UPDATE)).toBe(true);
      expect(result.files.some(f => f.action === ActionType.ADD)).toBe(true);
    });
  });

  describe('error handling edge cases', () => {
    it('should handle file system errors during write', async () => {
      const patchText = `*** Begin Patch
*** Add File: test.py
+content
*** End Patch`;

      // Mock filesystem to throw error on write
      jest.spyOn(mockFileSystem, 'write').mockRejectedValue(new Error('Disk full'));

      const result = await patchDiff.apply(patchText);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Disk full');
    });

    it('should handle file system errors during read', async () => {
      const patchText = `*** Begin Patch
*** Update File: test.py
-old
+new
*** End Patch`;

      // Mock filesystem to throw error on read
      jest.spyOn(mockFileSystem, 'read').mockRejectedValue(new Error('Permission denied'));

      const result = await patchDiff.apply(patchText);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('File not found');
    });

    it('should handle file system errors during delete', async () => {
      const patchText = `*** Begin Patch
*** Delete File: test.py
*** End Patch`;

      mockFileSystem.setFile(`${rootPath}/test.py`, 'content');
      
      // Mock filesystem to throw error on delete
      jest.spyOn(mockFileSystem, 'delete').mockRejectedValue(new Error('File locked'));

      const result = await patchDiff.apply(patchText);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('File locked');
    });

    it('should handle mkdir errors for nested paths', async () => {
      const patchText = `*** Begin Patch
*** Add File: deep/nested/file.py
+content
*** End Patch`;

      // Mock filesystem to throw error on mkdir
      jest.spyOn(mockFileSystem, 'mkdir').mockRejectedValue(new Error('Permission denied'));

      const result = await patchDiff.apply(patchText);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Permission denied');
    });
  });
});