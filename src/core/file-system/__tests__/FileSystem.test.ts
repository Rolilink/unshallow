import { jest } from '@jest/globals';
import * as fs from 'fs/promises';
import { FileSystem } from '@/core/file-system/FileSystem';

// Mock fs/promises module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('FileSystem', () => {
  let fileSystem: FileSystem;

  beforeEach(() => {
    fileSystem = new FileSystem();
    jest.clearAllMocks();
  });

  describe('read()', () => {
    it('should read file content successfully', async () => {
      // Arrange
      const mockPath = '/path/to/file.txt';
      const mockContent = 'Hello, World!';
      mockFs.readFile.mockResolvedValue(mockContent);

      // Act
      const result = await fileSystem.read(mockPath);

      // Assert
      expect(result).toBe(mockContent);
      expect(mockFs.readFile).toHaveBeenCalledWith(mockPath, 'utf-8');
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should throw error for non-existent file', async () => {
      // Arrange
      const mockPath = '/path/to/nonexistent.txt';
      const mockError = new Error('ENOENT: no such file or directory');
      mockFs.readFile.mockRejectedValue(mockError);

      // Act & Assert
      await expect(fileSystem.read(mockPath)).rejects.toThrow('ENOENT: no such file or directory');
      expect(mockFs.readFile).toHaveBeenCalledWith(mockPath, 'utf-8');
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should handle file encoding properly', async () => {
      // Arrange
      const mockPath = '/path/to/unicode.txt';
      const mockContent = 'Hello, 世界! 🌍';
      mockFs.readFile.mockResolvedValue(mockContent);

      // Act
      const result = await fileSystem.read(mockPath);

      // Assert
      expect(result).toBe(mockContent);
      expect(mockFs.readFile).toHaveBeenCalledWith(mockPath, 'utf-8');
    });

    it('should handle empty file content', async () => {
      // Arrange
      const mockPath = '/path/to/empty.txt';
      const mockContent = '';
      mockFs.readFile.mockResolvedValue(mockContent);

      // Act
      const result = await fileSystem.read(mockPath);

      // Assert
      expect(result).toBe('');
      expect(mockFs.readFile).toHaveBeenCalledWith(mockPath, 'utf-8');
    });

    it('should handle permission errors', async () => {
      // Arrange
      const mockPath = '/path/to/restricted.txt';
      const mockError = new Error('EACCES: permission denied');
      mockFs.readFile.mockRejectedValue(mockError);

      // Act & Assert
      await expect(fileSystem.read(mockPath)).rejects.toThrow('EACCES: permission denied');
      expect(mockFs.readFile).toHaveBeenCalledWith(mockPath, 'utf-8');
    });
  });

  describe('readAsJson()', () => {
    it('should parse valid JSON files', async () => {
      // Arrange
      const mockPath = '/path/to/valid.json';
      const mockObject = { name: 'test', value: 42, nested: { flag: true } };
      const mockContent = JSON.stringify(mockObject);
      mockFs.readFile.mockResolvedValue(mockContent);

      // Act
      const result = await fileSystem.readAsJson(mockPath);

      // Assert
      expect(result).toEqual(mockObject);
      expect(mockFs.readFile).toHaveBeenCalledWith(mockPath, 'utf-8');
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should throw error for invalid JSON', async () => {
      // Arrange
      const mockPath = '/path/to/invalid.json';
      const mockContent = '{ invalid json }';
      mockFs.readFile.mockResolvedValue(mockContent);

      // Act & Assert
      await expect(fileSystem.readAsJson(mockPath)).rejects.toThrow();
      expect(mockFs.readFile).toHaveBeenCalledWith(mockPath, 'utf-8');
    });

    it('should return correct TypeScript types for typed interface', async () => {
      // Arrange
      interface TestInterface {
        id: number;
        name: string;
        active: boolean;
      }
      
      const mockPath = '/path/to/typed.json';
      const mockObject: TestInterface = { id: 1, name: 'test', active: true };
      const mockContent = JSON.stringify(mockObject);
      mockFs.readFile.mockResolvedValue(mockContent);

      // Act
      const result = await fileSystem.readAsJson<TestInterface>(mockPath);

      // Assert
      expect(result).toEqual(mockObject);
      expect(result.id).toBe(1);
      expect(result.name).toBe('test');
      expect(result.active).toBe(true);
      expect(typeof result.id).toBe('number');
      expect(typeof result.name).toBe('string');
      expect(typeof result.active).toBe('boolean');
    });

    it('should handle empty files gracefully', async () => {
      // Arrange
      const mockPath = '/path/to/empty.json';
      const mockContent = '';
      mockFs.readFile.mockResolvedValue(mockContent);

      // Act & Assert
      await expect(fileSystem.readAsJson(mockPath)).rejects.toThrow();
      expect(mockFs.readFile).toHaveBeenCalledWith(mockPath, 'utf-8');
    });

    it('should handle whitespace-only files gracefully', async () => {
      // Arrange
      const mockPath = '/path/to/whitespace.json';
      const mockContent = '   \n\t  ';
      mockFs.readFile.mockResolvedValue(mockContent);

      // Act & Assert
      await expect(fileSystem.readAsJson(mockPath)).rejects.toThrow();
      expect(mockFs.readFile).toHaveBeenCalledWith(mockPath, 'utf-8');
    });

    it('should parse array JSON successfully', async () => {
      // Arrange
      const mockPath = '/path/to/array.json';
      const mockArray = [1, 2, 3, { name: 'test' }];
      const mockContent = JSON.stringify(mockArray);
      mockFs.readFile.mockResolvedValue(mockContent);

      // Act
      const result = await fileSystem.readAsJson<Array<unknown>>(mockPath);

      // Assert
      expect(result).toEqual(mockArray);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(4);
    });

    it('should parse primitive JSON values', async () => {
      // Arrange
      const mockPath = '/path/to/string.json';
      const mockContent = '"hello world"';
      mockFs.readFile.mockResolvedValue(mockContent);

      // Act
      const result = await fileSystem.readAsJson<string>(mockPath);

      // Assert
      expect(result).toBe('hello world');
      expect(typeof result).toBe('string');
    });

    it('should parse null JSON value', async () => {
      // Arrange
      const mockPath = '/path/to/null.json';
      const mockContent = 'null';
      mockFs.readFile.mockResolvedValue(mockContent);

      // Act
      const result = await fileSystem.readAsJson(mockPath);

      // Assert
      expect(result).toBeNull();
    });

    it('should propagate file read errors', async () => {
      // Arrange
      const mockPath = '/path/to/nonexistent.json';
      const mockError = new Error('ENOENT: no such file or directory');
      mockFs.readFile.mockRejectedValue(mockError);

      // Act & Assert
      await expect(fileSystem.readAsJson(mockPath)).rejects.toThrow('ENOENT: no such file or directory');
      expect(mockFs.readFile).toHaveBeenCalledWith(mockPath, 'utf-8');
    });

    it('should handle complex nested JSON structures', async () => {
      // Arrange
      const mockPath = '/path/to/complex.json';
      const mockObject = {
        users: [
          { id: 1, profile: { name: 'John', settings: { theme: 'dark' } } },
          { id: 2, profile: { name: 'Jane', settings: { theme: 'light' } } }
        ],
        metadata: {
          version: '1.0.0',
          created: '2023-01-01T00:00:00Z',
          tags: ['test', 'json', 'complex']
        }
      };
      const mockContent = JSON.stringify(mockObject);
      mockFs.readFile.mockResolvedValue(mockContent);

      // Act
      const result = await fileSystem.readAsJson(mockPath);

      // Assert
      expect(result).toEqual(mockObject);
      expect(mockFs.readFile).toHaveBeenCalledWith(mockPath, 'utf-8');
    });
  });
});