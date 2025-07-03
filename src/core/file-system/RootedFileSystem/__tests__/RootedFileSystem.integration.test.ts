import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { RootedFileSystem } from '../RootedFileSystem';
import { FileSystem } from '../../FileSystem/FileSystem';

describe('[integration]: RootedFileSystem Integration Tests', () => {
  let tempDir: string;
  let rootedFileSystem: RootedFileSystem;
  let realFileSystem: FileSystem;

  beforeEach(async () => {
    // Create a real temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rooted-fs-test-'));
    realFileSystem = new FileSystem();
    rootedFileSystem = new RootedFileSystem(realFileSystem, tempDir);
  });

  afterEach(async () => {
    // Clean up the temporary directory after each test
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
      console.warn(`Failed to clean up temp directory ${tempDir}:`, error);
    }
  });

  describe('Operations within root boundary', () => {
    it('should successfully read and write files in root directory', async () => {
      const testContent = 'Hello, World!';
      const fileName = 'test.txt';

      // Write file
      await rootedFileSystem.write(fileName, testContent);

      // Verify file exists on real filesystem
      const realPath = path.join(tempDir, fileName);
      expect(await fs.access(realPath).then(() => true, () => false)).toBe(true);

      // Read file through rooted filesystem
      const readContent = await rootedFileSystem.read(fileName);
      expect(readContent).toBe(testContent);

      // Verify file content on real filesystem
      const realContent = await fs.readFile(realPath, 'utf-8');
      expect(realContent).toBe(testContent);
    });

    it('should successfully create and operate on subdirectories', async () => {
      const subDir = 'subdir';
      const fileName = 'nested.txt';
      const filePath = path.join(subDir, fileName);
      const testContent = 'Nested content';

      // Create subdirectory
      await rootedFileSystem.mkdir(subDir);

      // Write file in subdirectory
      await rootedFileSystem.write(filePath, testContent);

      // Verify directory exists on real filesystem
      const realDirPath = path.join(tempDir, subDir);
      const dirStats = await fs.stat(realDirPath);
      expect(dirStats.isDirectory()).toBe(true);

      // Read file from subdirectory
      const readContent = await rootedFileSystem.read(filePath);
      expect(readContent).toBe(testContent);

      // Verify file exists through rooted filesystem
      expect(await rootedFileSystem.exists(filePath)).toBe(true);
    });

    it('should handle deep nesting within root', async () => {
      const deepPath = 'level1/level2/level3/deep.txt';
      const testContent = 'Deep content';

      // Write to deep path (should auto-create directories)
      await rootedFileSystem.write(deepPath, testContent);

      // Verify deep directory structure exists
      const realPath = path.join(tempDir, deepPath);
      const realContent = await fs.readFile(realPath, 'utf-8');
      expect(realContent).toBe(testContent);

      // Read through rooted filesystem
      const readContent = await rootedFileSystem.read(deepPath);
      expect(readContent).toBe(testContent);
    });

    it('should successfully work with JSON files', async () => {
      const jsonData = { name: 'test', value: 42, nested: { array: [1, 2, 3] } };
      const fileName = 'data.json';

      // Write JSON file
      await rootedFileSystem.write(fileName, JSON.stringify(jsonData, null, 2));

      // Read as JSON
      const readData = await rootedFileSystem.readAsJson<typeof jsonData>(fileName);
      expect(readData).toEqual(jsonData);

      // Verify on real filesystem
      const realPath = path.join(tempDir, fileName);
      const realData = JSON.parse(await fs.readFile(realPath, 'utf-8'));
      expect(realData).toEqual(jsonData);
    });

    it('should successfully delete files within root', async () => {
      const fileName = 'to-delete.txt';
      const testContent = 'Delete me';

      // Create file
      await rootedFileSystem.write(fileName, testContent);
      expect(await rootedFileSystem.exists(fileName)).toBe(true);

      // Delete file
      await rootedFileSystem.delete(fileName);
      expect(await rootedFileSystem.exists(fileName)).toBe(false);

      // Verify deletion on real filesystem
      const realPath = path.join(tempDir, fileName);
      expect(await fs.access(realPath).then(() => true, () => false)).toBe(false);
    });

    it('should handle operations at the root directory itself', async () => {
      const fileName = './root-file.txt';
      const testContent = 'Root file content';

      // Write file with ./ prefix
      await rootedFileSystem.write(fileName, testContent);

      // Read without ./ prefix
      const readContent = await rootedFileSystem.read('root-file.txt');
      expect(readContent).toBe(testContent);

      // Verify file exists at root
      expect(await rootedFileSystem.exists('root-file.txt')).toBe(true);
    });
  });

  describe('Operations outside root boundary', () => {
    it('should reject parent directory access attempts', async () => {
      const parentPath = '../outside.txt';

      await expect(rootedFileSystem.write(parentPath, 'content')).rejects.toThrow(
        /Path.*resolves outside root directory/
      );

      await expect(rootedFileSystem.read(parentPath)).rejects.toThrow(
        /Path.*resolves outside root directory/
      );

      await expect(rootedFileSystem.mkdir(parentPath)).rejects.toThrow(
        /Path.*resolves outside root directory/
      );
    });

    it('should reject complex path traversal attacks', async () => {
      const traversalPaths = [
        '../../etc/passwd',
        '../../../secrets.txt',
        'subdir/../../outside.txt',
        'deep/nested/../../../escape.txt',
        './subdir/../../../malicious.txt'
      ];

      for (const maliciousPath of traversalPaths) {
        await expect(rootedFileSystem.write(maliciousPath, 'content')).rejects.toThrow(
          /Path.*resolves outside root directory/
        );

        await expect(rootedFileSystem.read(maliciousPath)).rejects.toThrow(
          /Path.*resolves outside root directory/
        );
      }
    });

    it('should reject absolute paths outside root', async () => {
      const outsidePaths = [
        '/etc/passwd',
        '/tmp/outside.txt',
        '/home/user/document.txt',
        path.join(os.homedir(), 'outside.txt')
      ];

      for (const outsidePath of outsidePaths) {
        await expect(rootedFileSystem.write(outsidePath, 'content')).rejects.toThrow(
          /Absolute path.*is outside root directory/
        );

        await expect(rootedFileSystem.read(outsidePath)).rejects.toThrow(
          /Absolute path.*is outside root directory/
        );
      }
    });

    it('should allow absolute paths within root', async () => {
      const fileName = 'absolute-test.txt';
      const testContent = 'Absolute path content';
      const absolutePath = path.join(tempDir, fileName);

      // Write using absolute path within root
      await rootedFileSystem.write(absolutePath, testContent);

      // Read using relative path
      const readContent = await rootedFileSystem.read(fileName);
      expect(readContent).toBe(testContent);

      // Read using absolute path
      const readContentAbs = await rootedFileSystem.read(absolutePath);
      expect(readContentAbs).toBe(testContent);
    });

    it('should handle exists() gracefully for invalid paths', async () => {
      const invalidPaths = [
        '../outside.txt',
        '/etc/passwd',
        '../../secrets.txt'
      ];

      for (const invalidPath of invalidPaths) {
        // exists() should return false for paths outside root (not throw)
        expect(await rootedFileSystem.exists(invalidPath)).toBe(false);
      }
    });

    it('should prevent directory traversal through mkdir', async () => {
      const maliciousPaths = [
        '../outside-dir',
        '../../malicious-dir',
        'subdir/../../../escape-dir'
      ];

      for (const maliciousPath of maliciousPaths) {
        await expect(rootedFileSystem.mkdir(maliciousPath)).rejects.toThrow(
          /Path.*resolves outside root directory/
        );
      }
    });
  });

  describe('Edge cases and security validation', () => {
    it('should reject empty paths', async () => {
      const emptyPaths = ['', '   ', '\t', '\n'];

      for (const emptyPath of emptyPaths) {
        await expect(rootedFileSystem.write(emptyPath, 'content')).rejects.toThrow(
          /Path cannot be empty/
        );

        await expect(rootedFileSystem.read(emptyPath)).rejects.toThrow(
          /Path cannot be empty/
        );
      }
    });

    it('should handle unicode and special characters safely', async () => {
      const specialNames = [
        'test-file.txt',
        'test_file.txt',
        'test file.txt',
        'test.file.txt',
        'файл.txt', // Cyrillic
        '测试.txt', // Chinese
        'test@file.txt',
        'test#file.txt'
      ];

      for (const fileName of specialNames) {
        const testContent = `Content for ${fileName}`;
        
        // Write file with special characters
        await rootedFileSystem.write(fileName, testContent);
        
        // Read file back
        const readContent = await rootedFileSystem.read(fileName);
        expect(readContent).toBe(testContent);
        
        // Verify file exists
        expect(await rootedFileSystem.exists(fileName)).toBe(true);
      }
    });

    it('should provide correct root directory information', async () => {
      const root = rootedFileSystem.getRoot();
      expect(root).toBe(path.resolve(tempDir));
      expect(path.isAbsolute(root)).toBe(true);
    });

    it('should convert absolute paths to relative paths correctly', async () => {
      const fileName = 'relative-test.txt';
      const absolutePath = path.join(tempDir, fileName);
      
      // Write file
      await rootedFileSystem.write(fileName, 'test content');
      
      // Convert absolute path to relative
      const relativePath = rootedFileSystem.getRelativePath(absolutePath);
      expect(relativePath).toBe(fileName);
      
      // Test with root directory itself
      const rootRelative = rootedFileSystem.getRelativePath(tempDir);
      expect(rootRelative).toBe('.');
    });

    it('should reject getRelativePath for paths outside root', async () => {
      const outsidePaths = [
        '/etc/passwd',
        path.join(os.tmpdir(), 'outside.txt'),
        path.dirname(tempDir) // Parent of temp directory
      ];

      for (const outsidePath of outsidePaths) {
        expect(() => rootedFileSystem.getRelativePath(outsidePath)).toThrow(
          /Path.*is outside root directory/
        );
      }
    });

    it('should handle nested directory creation with security boundaries', async () => {
      // Create legitimate nested structure
      const legitimatePath = 'project/src/components/Button.tsx';
      await rootedFileSystem.write(legitimatePath, 'export const Button = () => null;');
      
      // Verify deep structure exists
      expect(await rootedFileSystem.exists(legitimatePath)).toBe(true);
      
      // Try to escape through the nested structure
      const maliciousPath = 'project/src/components/../../../../../../../etc/passwd';
      await expect(rootedFileSystem.write(maliciousPath, 'content')).rejects.toThrow(
        /Path.*resolves outside root directory/
      );
    });

    it('should handle concurrent file operations safely', async () => {
      const filePromises = Array.from({ length: 10 }, (_, i) => {
        const fileName = `concurrent-${i}.txt`;
        const content = `Content for file ${i}`;
        return rootedFileSystem.write(fileName, content);
      });

      // Wait for all writes to complete
      await Promise.all(filePromises);

      // Verify all files exist and have correct content
      const readPromises = Array.from({ length: 10 }, async (_, i) => {
        const fileName = `concurrent-${i}.txt`;
        const content = await rootedFileSystem.read(fileName);
        expect(content).toBe(`Content for file ${i}`);
      });

      await Promise.all(readPromises);
    });

    it('should handle file operation errors gracefully', async () => {
      // Try to read non-existent file
      await expect(rootedFileSystem.read('non-existent.txt')).rejects.toThrow();

      // Try to read invalid JSON
      await rootedFileSystem.write('invalid.json', 'not json');
      await expect(rootedFileSystem.readAsJson('invalid.json')).rejects.toThrow();

      // Try to delete non-existent file
      await expect(rootedFileSystem.delete('non-existent.txt')).rejects.toThrow();
    });

    it('should maintain security boundaries even with normalized paths', async () => {
      // These paths should all resolve to the same location but outside root
      const normalizedPaths = [
        '../outside.txt',
        './../outside.txt',
        './/../outside.txt',
        'subdir/../../outside.txt',
        'subdir/..//../outside.txt'
      ];

      for (const normalizedPath of normalizedPaths) {
        await expect(rootedFileSystem.write(normalizedPath, 'content')).rejects.toThrow(
          /Path.*resolves outside root directory/
        );
      }
    });
  });
});