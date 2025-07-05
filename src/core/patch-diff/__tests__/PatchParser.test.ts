import { describe, it, expect } from '@jest/globals';
import { textToPatch, identifyFilesNeeded, identifyFilesAdded } from '../PatchParser';
import { ActionType, DiffError } from '../types';

describe('PatchParser', () => {
  describe('identifyFilesNeeded', () => {
    it('should identify files for UPDATE operations', () => {
      const patch = `*** Begin Patch
*** Update File: test.py
*** Update File: another.py
*** End Patch`;
      
      const files = identifyFilesNeeded(patch);
      expect(files).toEqual(['test.py', 'another.py']);
    });

    it('should identify files for DELETE operations', () => {
      const patch = `*** Begin Patch
*** Delete File: old.py
*** End Patch`;
      
      const files = identifyFilesNeeded(patch);
      expect(files).toEqual(['old.py']);
    });

    it('should not identify files for ADD operations', () => {
      const patch = `*** Begin Patch
*** Add File: new.py
+content
*** End Patch`;
      
      const files = identifyFilesNeeded(patch);
      expect(files).toEqual([]);
    });

    it('should handle mixed operations', () => {
      const patch = `*** Begin Patch
*** Update File: update.py
*** Delete File: delete.py
*** Add File: add.py
*** End Patch`;
      
      const files = identifyFilesNeeded(patch);
      expect(files).toEqual(['update.py', 'delete.py']);
    });

    it('should remove duplicates', () => {
      const patch = `*** Begin Patch
*** Update File: test.py
*** Update File: test.py
*** End Patch`;
      
      const files = identifyFilesNeeded(patch);
      expect(files).toEqual(['test.py']);
    });
  });

  describe('identifyFilesAdded', () => {
    it('should identify files for ADD operations', () => {
      const patch = `*** Begin Patch
*** Add File: new1.py
+content1
*** Add File: new2.py
+content2
*** End Patch`;
      
      const files = identifyFilesAdded(patch);
      expect(files).toEqual(['new1.py', 'new2.py']);
    });

    it('should not identify UPDATE or DELETE files', () => {
      const patch = `*** Begin Patch
*** Update File: update.py
*** Delete File: delete.py
*** End Patch`;
      
      const files = identifyFilesAdded(patch);
      expect(files).toEqual([]);
    });
  });

  describe('textToPatch', () => {
    it('should parse simple UPDATE patch', () => {
      const patchText = `*** Begin Patch
*** Update File: test.py
 def hello():
-    print("old")
+    print("new")
*** End Patch`;

      const currentFiles = { 'test.py': 'def hello():\n    print("old")' };
      const [patch, fuzz] = textToPatch(patchText, currentFiles);

      expect(patch.actions['test.py']).toBeDefined();
      expect(patch.actions['test.py']?.type).toBe(ActionType.UPDATE);
      expect(patch.actions['test.py']?.chunks).toHaveLength(1);
      expect(fuzz).toBeGreaterThanOrEqual(0);
    });

    it('should parse ADD patch', () => {
      const patchText = `*** Begin Patch
*** Add File: new.py
+def new_function():
+    return "hello"
*** End Patch`;

      const [patch, fuzz] = textToPatch(patchText, {});

      expect(patch.actions['new.py']).toBeDefined();
      expect(patch.actions['new.py']?.type).toBe(ActionType.ADD);
      expect(patch.actions['new.py']?.new_file).toBe('def new_function():\n    return "hello"');
      expect(fuzz).toBe(0);
    });

    it('should parse DELETE patch', () => {
      const patchText = `*** Begin Patch
*** Delete File: old.py
*** End Patch`;

      const currentFiles = { 'old.py': 'content' };
      const [patch, fuzz] = textToPatch(patchText, currentFiles);

      expect(patch.actions['old.py']).toBeDefined();
      expect(patch.actions['old.py']?.type).toBe(ActionType.DELETE);
      expect(fuzz).toBe(0);
    });

    it('should parse MOVE operation', () => {
      const patchText = `*** Begin Patch
*** Update File: old.py
*** Move to: new.py
 def function():
-    old_logic()
+    new_logic()
*** End Patch`;

      const currentFiles = { 'old.py': 'def function():\n    old_logic()' };
      const [patch] = textToPatch(patchText, currentFiles);

      expect(patch.actions['old.py']).toBeDefined();
      expect(patch.actions['old.py']?.type).toBe(ActionType.UPDATE);
      expect(patch.actions['old.py']?.move_path).toBe('new.py');
    });

    it('should throw error for invalid patch format', () => {
      const invalidPatch = 'Not a valid patch';
      
      expect(() => textToPatch(invalidPatch, {})).toThrow(DiffError);
    });

    it('should throw error for missing begin marker', () => {
      const invalidPatch = `*** Update File: test.py
*** End Patch`;
      
      expect(() => textToPatch(invalidPatch, {})).toThrow('Patch text must start with the correct patch prefix');
    });

    it('should throw error for missing end marker', () => {
      const invalidPatch = `*** Begin Patch
*** Update File: test.py`;
      
      expect(() => textToPatch(invalidPatch, {})).toThrow('Patch text must end with the correct patch suffix');
    });

    it('should throw error for duplicate file paths', () => {
      const patchText = `*** Begin Patch
*** Update File: test.py
-old
+new
*** Update File: test.py
-old2
+new2
*** End Patch`;

      const currentFiles = { 'test.py': 'old\nold2' };
      
      expect(() => textToPatch(patchText, currentFiles)).toThrow('Duplicate Path');
    });

    it('should throw error for missing file in UPDATE', () => {
      const patchText = `*** Begin Patch
*** Update File: missing.py
-old
+new
*** End Patch`;

      const currentFiles = {};
      
      expect(() => textToPatch(patchText, currentFiles)).toThrow('Missing File');
    });

    it('should throw error for existing file in ADD', () => {
      const patchText = `*** Begin Patch
*** Add File: existing.py
+content
*** End Patch`;

      const currentFiles = { 'existing.py': 'existing content' };
      
      expect(() => textToPatch(patchText, currentFiles)).toThrow('File already exists');
    });
  });

  describe('PatchParser class', () => {
    it('should handle hierarchical context markers', () => {
      const patchText = `*** Begin Patch
*** Update File: test.py
@@ class TestClass
 def method():
-    old_code
+    new_code
*** End Patch`;

      const currentFiles = {
        'test.py': 'class TestClass:\n    def method():\n        old_code'
      };
      
      const [patch] = textToPatch(patchText, currentFiles);
      expect(patch.actions['test.py']).toBeDefined();
      expect(patch.actions['test.py']?.chunks).toHaveLength(1);
    });

    it('should handle multiple chunks in single file', () => {
      const patchText = `*** Begin Patch
*** Update File: test.py
 line1
-old1
+new1
 line2
-old2
+new2
 line3
*** End Patch`;

      const currentFiles = {
        'test.py': 'line1\nold1\nline2\nold2\nline3'
      };
      
      const [patch] = textToPatch(patchText, currentFiles);
      expect(patch.actions['test.py']?.chunks).toHaveLength(2);
    });

    it('should handle EOF marker', () => {
      const patchText = `*** Begin Patch
*** Update File: test.py
 last_line
+new_line
*** End of File
*** End Patch`;

      const currentFiles = { 'test.py': 'last_line' };
      
      const [patch] = textToPatch(patchText, currentFiles);
      expect(patch.actions['test.py']).toBeDefined();
    });

    it('should tolerate missing leading spaces in context', () => {
      const patchText = `*** Begin Patch
*** Update File: test.py
context_line
-old_line
+new_line
*** End Patch`;

      const currentFiles = { 'test.py': 'context_line\nold_line' };
      
      const [patch] = textToPatch(patchText, currentFiles);
      expect(patch.actions['test.py']).toBeDefined();
    });

    it('should handle mixed add/delete operations in chunks', () => {
      const patchText = `*** Begin Patch
*** Update File: test.py
 context
-delete_this
-and_this
+add_this
+and_this
 more_context
*** End Patch`;

      const currentFiles = {
        'test.py': 'context\ndelete_this\nand_this\nmore_context'
      };
      
      const [patch] = textToPatch(patchText, currentFiles);
      const chunk = patch.actions['test.py']?.chunks[0];
      expect(chunk?.del_lines).toEqual(['delete_this', 'and_this']);
      expect(chunk?.ins_lines).toEqual(['add_this', 'and_this']);
    });

    it('should throw error for invalid ADD file line', () => {
      const patchText = `*** Begin Patch
*** Add File: test.py
invalid_line_without_plus
*** End Patch`;

      expect(() => textToPatch(patchText, {})).toThrow('Invalid Add File Line');
    });

    it('should throw error for unknown line', () => {
      const patchText = `*** Begin Patch
*** Unknown Command: test.py
*** End Patch`;

      expect(() => textToPatch(patchText, {})).toThrow('Unknown Line');
    });

    it('should handle Unicode normalization in context matching', () => {
      const patchText = `*** Begin Patch
*** Update File: test.py
@@ def calculate():
 value = x - 1
-    return value
+    return value * 2
*** End Patch`;

      // File contains EN DASH, patch contains ASCII hyphen
      const currentFiles = {
        'test.py': 'def calculate():\n    value = x – 1\n    return value'
      };
      
      const [patch, fuzz] = textToPatch(patchText, currentFiles);
      expect(patch.actions['test.py']).toBeDefined();
      expect(fuzz).toBeGreaterThanOrEqual(0); // Should find match despite Unicode difference
    });
  });
});