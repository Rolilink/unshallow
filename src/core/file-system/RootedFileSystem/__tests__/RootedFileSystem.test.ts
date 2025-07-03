import * as path from 'path';
import { RootedFileSystem } from '../RootedFileSystem';
import { IFileSystem } from '../../types';

// Mock the IFileSystem
const mockFileSystem: jest.Mocked<IFileSystem> = {
  read: jest.fn(),
  readAsJson: jest.fn(),
  write: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
  mkdir: jest.fn(),
};

describe('RootedFileSystem', () => {
  let rootedFs: RootedFileSystem;
  const rootPath = '/test/root';
  const normalizedRoot = path.resolve(rootPath);

  beforeEach(() => {
    jest.clearAllMocks();
    rootedFs = new RootedFileSystem(mockFileSystem, rootPath);
  });

  describe('getRoot', () => {
    it('should return the normalized root path', () => {
      expect(rootedFs.getRoot()).toBe(normalizedRoot);
    });

    it('should normalize relative root paths', () => {
      const relativeRootFs = new RootedFileSystem(mockFileSystem, './relative/path');
      expect(relativeRootFs.getRoot()).toBe(path.resolve('./relative/path'));
    });
  });

  describe('getRelativePath', () => {
    it('should convert absolute paths within root to relative paths', () => {
      const absolutePath = path.join(normalizedRoot, 'subdir', 'file.txt');
      expect(rootedFs.getRelativePath(absolutePath)).toBe(path.join('subdir', 'file.txt'));
    });

    it('should return "." for the root directory itself', () => {
      expect(rootedFs.getRelativePath(normalizedRoot)).toBe('.');
    });

    it('should throw error for paths outside root', () => {
      expect(() => rootedFs.getRelativePath('/outside/root/file.txt')).toThrow(
        `Path '/outside/root/file.txt' is outside root directory '${normalizedRoot}'`
      );
    });

    it('should handle paths with different separators', () => {
      const mixedPath = normalizedRoot + '/subdir\\file.txt';
      const result = rootedFs.getRelativePath(mixedPath);
      // The result should contain the directory and filename, regardless of separator
      expect(result).toContain('subdir');
      expect(result).toContain('file.txt');
      // And should not contain the root path
      expect(result).not.toContain(normalizedRoot);
    });
  });

  describe('read', () => {
    it('should read files within root directory', async () => {
      const content = 'file content';
      mockFileSystem.read.mockResolvedValue(content);

      const result = await rootedFs.read('file.txt');

      expect(mockFileSystem.read).toHaveBeenCalledWith(path.join(normalizedRoot, 'file.txt'));
      expect(result).toBe(content);
    });

    it('should read files in subdirectories', async () => {
      const content = 'nested content';
      mockFileSystem.read.mockResolvedValue(content);

      const result = await rootedFs.read('subdir/nested.txt');

      expect(mockFileSystem.read).toHaveBeenCalledWith(path.join(normalizedRoot, 'subdir', 'nested.txt'));
      expect(result).toBe(content);
    });

    it('should reject empty paths', async () => {
      await expect(rootedFs.read('')).rejects.toThrow('Path cannot be empty');
      await expect(rootedFs.read('  ')).rejects.toThrow('Path cannot be empty');
    });

    it('should reject path traversal attempts', async () => {
      await expect(rootedFs.read('../outside.txt')).rejects.toThrow(
        `Path '../outside.txt' resolves outside root directory '${normalizedRoot}'`
      );
      await expect(rootedFs.read('../../etc/passwd')).rejects.toThrow(
        `Path '../../etc/passwd' resolves outside root directory '${normalizedRoot}'`
      );
    });

    it('should reject absolute paths outside root', async () => {
      await expect(rootedFs.read('/etc/passwd')).rejects.toThrow(
        `Absolute path '/etc/passwd' is outside root directory '${normalizedRoot}'`
      );
    });

    it('should allow absolute paths within root', async () => {
      const absolutePath = path.join(normalizedRoot, 'file.txt');
      const content = 'absolute file content';
      mockFileSystem.read.mockResolvedValue(content);

      const result = await rootedFs.read(absolutePath);

      expect(mockFileSystem.read).toHaveBeenCalledWith(absolutePath);
      expect(result).toBe(content);
    });
  });

  describe('readAsJson', () => {
    it('should read and parse JSON files within root', async () => {
      const jsonData = { key: 'value', number: 42 };
      mockFileSystem.readAsJson.mockResolvedValue(jsonData);

      const result = await rootedFs.readAsJson('data.json');

      expect(mockFileSystem.readAsJson).toHaveBeenCalledWith(path.join(normalizedRoot, 'data.json'));
      expect(result).toEqual(jsonData);
    });

    it('should handle typed JSON reads', async () => {
      interface TestData {
        name: string;
        age: number;
      }
      const typedData: TestData = { name: 'Test', age: 30 };
      mockFileSystem.readAsJson.mockResolvedValue(typedData);

      const result = await rootedFs.readAsJson<TestData>('typed.json');

      expect(result).toEqual(typedData);
      expect(result.name).toBe('Test');
      expect(result.age).toBe(30);
    });

    it('should reject paths outside root', async () => {
      await expect(rootedFs.readAsJson('../../../sensitive.json')).rejects.toThrow(
        `Path '../../../sensitive.json' resolves outside root directory '${normalizedRoot}'`
      );
    });
  });

  describe('write', () => {
    it('should write files within root directory', async () => {
      const content = 'new content';
      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.write.mockResolvedValue(undefined);

      await rootedFs.write('newfile.txt', content);

      expect(mockFileSystem.mkdir).toHaveBeenCalledWith(normalizedRoot, { recursive: true });
      expect(mockFileSystem.write).toHaveBeenCalledWith(path.join(normalizedRoot, 'newfile.txt'), content);
    });

    it('should create parent directories when writing nested files', async () => {
      const content = 'nested content';
      const filePath = 'deep/nested/file.txt';
      const resolvedPath = path.join(normalizedRoot, filePath);
      const parentDir = path.dirname(resolvedPath);

      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.write.mockResolvedValue(undefined);

      await rootedFs.write(filePath, content);

      expect(mockFileSystem.mkdir).toHaveBeenCalledWith(parentDir, { recursive: true });
      expect(mockFileSystem.write).toHaveBeenCalledWith(resolvedPath, content);
    });

    it('should reject writing files outside root', async () => {
      await expect(rootedFs.write('../outside.txt', 'content')).rejects.toThrow(
        `Path '../outside.txt' resolves outside root directory '${normalizedRoot}'`
      );
    });

    it('should handle write errors from underlying filesystem', async () => {
      const error = new Error('Disk full');
      mockFileSystem.write.mockRejectedValue(error);
      mockFileSystem.mkdir.mockResolvedValue(undefined);

      await expect(rootedFs.write('file.txt', 'content')).rejects.toThrow('Disk full');
    });
  });

  describe('delete', () => {
    it('should delete files within root', async () => {
      mockFileSystem.delete.mockResolvedValue(undefined);

      await rootedFs.delete('removeme.txt');

      expect(mockFileSystem.delete).toHaveBeenCalledWith(path.join(normalizedRoot, 'removeme.txt'));
    });

    it('should delete files in subdirectories', async () => {
      mockFileSystem.delete.mockResolvedValue(undefined);

      await rootedFs.delete('subdir/removeme.txt');

      expect(mockFileSystem.delete).toHaveBeenCalledWith(path.join(normalizedRoot, 'subdir', 'removeme.txt'));
    });

    it('should reject deleting files outside root', async () => {
      await expect(rootedFs.delete('../../important.txt')).rejects.toThrow(
        `Path '../../important.txt' resolves outside root directory '${normalizedRoot}'`
      );
    });
  });

  describe('exists', () => {
    it('should check file existence within root', async () => {
      mockFileSystem.exists.mockResolvedValue(true);

      const result = await rootedFs.exists('checkme.txt');

      expect(mockFileSystem.exists).toHaveBeenCalledWith(path.join(normalizedRoot, 'checkme.txt'));
      expect(result).toBe(true);
    });

    it('should return false for non-existent files', async () => {
      mockFileSystem.exists.mockResolvedValue(false);

      const result = await rootedFs.exists('nothere.txt');

      expect(result).toBe(false);
    });

    it('should return false for paths outside root instead of throwing', async () => {
      const result = await rootedFs.exists('../../../etc/passwd');

      expect(result).toBe(false);
      expect(mockFileSystem.exists).not.toHaveBeenCalled();
    });

    it('should return false for empty paths', async () => {
      const result = await rootedFs.exists('');

      expect(result).toBe(false);
      expect(mockFileSystem.exists).not.toHaveBeenCalled();
    });
  });

  describe('mkdir', () => {
    it('should create directories within root', async () => {
      mockFileSystem.mkdir.mockResolvedValue(undefined);

      await rootedFs.mkdir('newdir');

      expect(mockFileSystem.mkdir).toHaveBeenCalledWith(path.join(normalizedRoot, 'newdir'), undefined);
    });

    it('should create nested directories with recursive option', async () => {
      mockFileSystem.mkdir.mockResolvedValue(undefined);

      await rootedFs.mkdir('deep/nested/dir', { recursive: true });

      expect(mockFileSystem.mkdir).toHaveBeenCalledWith(
        path.join(normalizedRoot, 'deep', 'nested', 'dir'),
        { recursive: true }
      );
    });

    it('should reject creating directories outside root', async () => {
      await expect(rootedFs.mkdir('../outside')).rejects.toThrow(
        `Path '../outside' resolves outside root directory '${normalizedRoot}'`
      );
    });

    it('should reject empty directory paths', async () => {
      await expect(rootedFs.mkdir('')).rejects.toThrow('Path cannot be empty');
      await expect(rootedFs.mkdir('   ')).rejects.toThrow('Path cannot be empty');
    });
  });

  describe('security boundaries', () => {
    it('should prevent various path traversal attempts', async () => {
      const maliciousPaths = [
        '..',
        '../..',
        '../../..',
        'subdir/../../..',
        'subdir/../../../etc/passwd',
        './../../',
        'subdir/./../../',
        'subdir/./../..',
      ];

      for (const maliciousPath of maliciousPaths) {
        await expect(rootedFs.read(maliciousPath)).rejects.toThrow(/outside root directory/);
      }
    });

    it('should handle paths with special characters', async () => {
      const specialPaths = [
        'file with spaces.txt',
        'file-with-dashes.txt',
        'file_with_underscores.txt',
        'file.multiple.dots.txt',
      ];

      mockFileSystem.read.mockResolvedValue('content');

      for (const specialPath of specialPaths) {
        await rootedFs.read(specialPath);
        expect(mockFileSystem.read).toHaveBeenCalledWith(path.join(normalizedRoot, specialPath));
      }
    });

    it('should normalize paths with redundant separators', async () => {
      mockFileSystem.read.mockResolvedValue('content');

      await rootedFs.read('subdir//file.txt');
      await rootedFs.read('subdir/./file.txt');
      await rootedFs.read('./subdir/file.txt');

      // All should resolve to the same normalized path
      const expectedPath = path.join(normalizedRoot, 'subdir', 'file.txt');
      expect(mockFileSystem.read).toHaveBeenCalledWith(expectedPath);
    });
  });

  describe('edge cases', () => {
    it('should handle root directory operations', async () => {
      mockFileSystem.exists.mockResolvedValue(true);

      // Check if we can query the root itself using '.'
      const result = await rootedFs.exists('.');

      expect(mockFileSystem.exists).toHaveBeenCalledWith(normalizedRoot);
      expect(result).toBe(true);
    });

    it('should handle very long paths within root', async () => {
      const longPath = 'a/'.repeat(50) + 'file.txt';
      mockFileSystem.read.mockResolvedValue('content');

      await rootedFs.read(longPath);

      expect(mockFileSystem.read).toHaveBeenCalledWith(path.join(normalizedRoot, ...longPath.split('/')));
    });

    it('should handle paths with backslashes on any platform', async () => {
      mockFileSystem.read.mockResolvedValue('content');

      await rootedFs.read('subdir\\file.txt');

      // The exact path format depends on the platform, so we check if the call was made
      expect(mockFileSystem.read).toHaveBeenCalled();
      const calledPath = mockFileSystem.read.mock.calls[0]?.[0];
      expect(calledPath).toBeDefined();
      // Verify it's within root and has the right components
      expect(calledPath).toContain(normalizedRoot);
      expect(calledPath).toMatch(/subdir.*file\.txt/);
    });
  });
});