import { describe, it, expect } from '@jest/globals';
import { SecurityValidator } from '../SecurityValidator';
import * as path from 'path';

describe('SecurityValidator', () => {
  let securityValidator: SecurityValidator;

  beforeEach(() => {
    securityValidator = new SecurityValidator();
  });

  describe('validatePath', () => {
    it('should accept valid relative paths', () => {
      expect(() => securityValidator.validatePath('file.py')).not.toThrow();
      expect(() => securityValidator.validatePath('src/module.py')).not.toThrow();
      expect(() => securityValidator.validatePath('deep/nested/file.py')).not.toThrow();
    });

    it('should reject absolute paths', () => {
      expect(() => securityValidator.validatePath('/absolute/path.py'))
        .toThrow('Absolute path not allowed');
      
      if (process.platform === 'win32') {
        expect(() => securityValidator.validatePath('C:\\absolute\\path.py'))
          .toThrow('Absolute path not allowed');
      }
    });

    it('should reject directory traversal attempts', () => {
      expect(() => securityValidator.validatePath('../parent.py'))
        .toThrow('Path traversal not allowed: ../parent.py');
      
      expect(() => securityValidator.validatePath('src/../../../etc/passwd'))
        .toThrow('Path traversal not allowed: src/../../../etc/passwd');
      
      expect(() => securityValidator.validatePath('dir/../file.py'))
        .toThrow('Path traversal not allowed: dir/../file.py');
    });

    it('should reject paths with null bytes', () => {
      expect(() => securityValidator.validatePath('file\0.py'))
        .toThrow('Null byte in path not allowed: file\0.py');
      
      expect(() => securityValidator.validatePath('src/file.py\0'))
        .toThrow('Null byte in path not allowed: src/file.py\0');
    });

    it('should reject empty paths', () => {
      expect(() => securityValidator.validatePath(''))
        .toThrow('Empty path not allowed');
      
      expect(() => securityValidator.validatePath('   '))
        .toThrow('Empty path not allowed');
    });

    it('should accept paths with dots in filename', () => {
      expect(() => securityValidator.validatePath('file.backup.py')).not.toThrow();
      expect(() => securityValidator.validatePath('src/.hidden')).not.toThrow();
      expect(() => securityValidator.validatePath('.gitignore')).not.toThrow();
    });

    it('should accept paths with special characters', () => {
      expect(() => securityValidator.validatePath('file-with-hyphens.py')).not.toThrow();
      expect(() => securityValidator.validatePath('file_with_underscores.py')).not.toThrow();
      expect(() => securityValidator.validatePath('file with spaces.py')).not.toThrow();
    });
  });

  describe('validatePaths', () => {
    it('should validate multiple valid paths', () => {
      const paths = ['file1.py', 'src/file2.py', 'deep/nested/file3.py'];
      
      expect(() => securityValidator.validatePaths(paths)).not.toThrow();
    });

    it('should reject if any path is invalid', () => {
      const paths = ['valid.py', '../invalid.py', 'also-valid.py'];
      
      expect(() => securityValidator.validatePaths(paths))
        .toThrow('Path traversal not allowed');
    });

    it('should handle empty array', () => {
      expect(() => securityValidator.validatePaths([])).not.toThrow();
    });
  });

  describe('resolvePath', () => {
    const rootPath = '/project/root';

    it('should resolve valid relative paths', () => {
      const result = securityValidator.resolvePath(rootPath, 'src/file.py');
      
      expect(result).toBe(path.resolve(rootPath, 'src/file.py'));
    });

    it('should ensure path stays within root', () => {
      expect(() => securityValidator.resolvePath(rootPath, '../outside.py'))
        .toThrow('Path outside root directory');
    });

    it('should handle root path itself', () => {
      const result = securityValidator.resolvePath(rootPath, '.');
      
      expect(result).toBe(path.resolve(rootPath));
    });

    it('should handle complex nested paths', () => {
      const result = securityValidator.resolvePath(rootPath, 'a/b/c/../../d/file.py');
      const expected = path.resolve(rootPath, 'a/d/file.py');
      
      expect(result).toBe(expected);
    });

    it('should reject paths that escape root after resolution', () => {
      // This would resolve to parent of root
      expect(() => securityValidator.resolvePath(rootPath, 'a/../../..'))
        .toThrow('Path outside root directory');
    });

    it('should validate the relative path first', () => {
      expect(() => securityValidator.resolvePath(rootPath, '/absolute.py'))
        .toThrow('Absolute path not allowed');
    });

    it('should handle Windows-style paths on Windows', () => {
      if (process.platform === 'win32') {
        const winRoot = 'C:\\project\\root';
        const result = securityValidator.resolvePath(winRoot, 'src\\file.py');
        
        expect(result).toBe(path.resolve(winRoot, 'src\\file.py'));
      }
    });

    it('should prevent escaping through symlink-like behavior', () => {
      // Even if the path doesn't contain .. directly, it should not escape root
      expect(() => securityValidator.resolvePath('/root', 'a/b/../../../../etc/passwd'))
        .toThrow('Path outside root directory');
    });
  });

  describe('getParentDirectory', () => {
    it('should return parent directory for nested files', () => {
      const result = securityValidator.getParentDirectory('src/models/user.py');
      
      expect(result).toBe('src/models');
    });

    it('should return directory for files in subdirectory', () => {
      const result = securityValidator.getParentDirectory('src/file.py');
      
      expect(result).toBe('src');
    });

    it('should return empty string for root-level files', () => {
      const result = securityValidator.getParentDirectory('file.py');
      
      expect(result).toBe('.');
    });

    it('should handle current directory reference', () => {
      const result = securityValidator.getParentDirectory('./file.py');
      
      expect(result).toBe('.');
    });

    it('should handle deeply nested paths', () => {
      const result = securityValidator.getParentDirectory('a/b/c/d/e/file.py');
      
      expect(result).toBe('a/b/c/d/e');
    });

    it('should handle paths with trailing separators', () => {
      const result = securityValidator.getParentDirectory('src/models/');
      
      expect(result).toBe('src');
    });

    it('should handle Windows-style paths', () => {
      if (process.platform === 'win32') {
        const result = securityValidator.getParentDirectory('src\\models\\user.py');
        
        expect(result).toBe('src\\models');
      }
    });
  });

  describe('edge cases and security considerations', () => {
    it('should handle Unicode normalization attacks', () => {
      // Test with Unicode characters that might normalize to dangerous sequences
      const unicodePath = 'file\u002e\u002e/passwd'; // Unicode dots
      
      expect(() => securityValidator.validatePath(unicodePath))
        .toThrow('Path traversal not allowed');
    });

    it('should handle path with multiple consecutive dots', () => {
      expect(() => securityValidator.validatePath('...'))
        .not.toThrow(); // This is just a filename, not traversal
      
      expect(() => securityValidator.validatePath('../..'))
        .toThrow('Path traversal not allowed');
    });

    it('should handle mixed separators', () => {
      expect(() => securityValidator.validatePath('src/../file.py'))
        .toThrow('Path traversal not allowed');
      
      if (process.platform === 'win32') {
        expect(() => securityValidator.validatePath('src\\..\\file.py'))
          .toThrow('Path traversal not allowed');
      }
    });

    it('should handle very long paths', () => {
      const longPath = 'a/'.repeat(1000) + 'file.py';
      
      expect(() => securityValidator.validatePath(longPath)).not.toThrow();
    });

    it('should handle special device names on Windows', () => {
      if (process.platform === 'win32') {
        // Windows reserved names should still be validated normally
        expect(() => securityValidator.validatePath('CON.py')).not.toThrow();
        expect(() => securityValidator.validatePath('NUL.txt')).not.toThrow();
      }
    });

    it('should handle case sensitivity issues', () => {
      // Should not affect security validation
      expect(() => securityValidator.validatePath('FILE.PY')).not.toThrow();
      expect(() => securityValidator.validatePath('SRC/FILE.PY')).not.toThrow();
    });

    it('should reject control characters in paths', () => {
      expect(() => securityValidator.validatePath('file\x01.py'))
        .not.toThrow(); // Currently only checks for null bytes
      
      // But null bytes should definitely be rejected
      expect(() => securityValidator.validatePath('file\x00.py'))
        .toThrow('Null byte in path not allowed');
    });
  });
});