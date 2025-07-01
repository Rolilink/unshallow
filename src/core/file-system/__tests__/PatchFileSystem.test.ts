import { jest } from '@jest/globals';
import * as fs from 'fs/promises';
import { FileSystem } from '@/core/file-system/FileSystem';

// Mock fs/promises module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('IPatchFileSystem Implementation', () => {
  describe('FileSystem (Real Implementation)', () => {
    let fileSystem: FileSystem;

    beforeEach(() => {
      fileSystem = new FileSystem();
      jest.clearAllMocks();
    });

    describe('write()', () => {
      it('should write content to file successfully', async () => {
        // Arrange
        const mockPath = '/path/to/file.txt';
        const mockContent = 'Hello, World!';
        mockFs.writeFile.mockResolvedValue(undefined);

        // Act
        await fileSystem.write(mockPath, mockContent);

        // Assert
        expect(mockFs.writeFile).toHaveBeenCalledWith(mockPath, mockContent, 'utf-8');
        expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
      });

      it('should handle write errors', async () => {
        // Arrange
        const mockPath = '/path/to/readonly.txt';
        const mockContent = 'Content';
        const mockError = new Error('EACCES: permission denied');
        mockFs.writeFile.mockRejectedValue(mockError);

        // Act & Assert
        await expect(fileSystem.write(mockPath, mockContent)).rejects.toThrow('EACCES: permission denied');
        expect(mockFs.writeFile).toHaveBeenCalledWith(mockPath, mockContent, 'utf-8');
      });

      it('should handle empty content', async () => {
        // Arrange
        const mockPath = '/path/to/empty.txt';
        const mockContent = '';
        mockFs.writeFile.mockResolvedValue(undefined);

        // Act
        await fileSystem.write(mockPath, mockContent);

        // Assert
        expect(mockFs.writeFile).toHaveBeenCalledWith(mockPath, mockContent, 'utf-8');
      });

      it('should handle unicode content', async () => {
        // Arrange
        const mockPath = '/path/to/unicode.txt';
        const mockContent = 'Hello, 世界! 🌍';
        mockFs.writeFile.mockResolvedValue(undefined);

        // Act
        await fileSystem.write(mockPath, mockContent);

        // Assert
        expect(mockFs.writeFile).toHaveBeenCalledWith(mockPath, mockContent, 'utf-8');
      });
    });

    describe('delete()', () => {
      it('should delete file successfully', async () => {
        // Arrange
        const mockPath = '/path/to/file.txt';
        mockFs.unlink.mockResolvedValue(undefined);

        // Act
        await fileSystem.delete(mockPath);

        // Assert
        expect(mockFs.unlink).toHaveBeenCalledWith(mockPath);
        expect(mockFs.unlink).toHaveBeenCalledTimes(1);
      });

      it('should handle delete errors for non-existent files', async () => {
        // Arrange
        const mockPath = '/path/to/nonexistent.txt';
        const mockError = new Error('ENOENT: no such file or directory');
        mockFs.unlink.mockRejectedValue(mockError);

        // Act & Assert
        await expect(fileSystem.delete(mockPath)).rejects.toThrow('ENOENT: no such file or directory');
        expect(mockFs.unlink).toHaveBeenCalledWith(mockPath);
      });

      it('should handle permission errors', async () => {
        // Arrange
        const mockPath = '/path/to/protected.txt';
        const mockError = new Error('EACCES: permission denied');
        mockFs.unlink.mockRejectedValue(mockError);

        // Act & Assert
        await expect(fileSystem.delete(mockPath)).rejects.toThrow('EACCES: permission denied');
        expect(mockFs.unlink).toHaveBeenCalledWith(mockPath);
      });
    });

    describe('exists()', () => {
      it('should return true for existing files', async () => {
        // Arrange
        const mockPath = '/path/to/existing.txt';
        mockFs.access.mockResolvedValue(undefined);

        // Act
        const result = await fileSystem.exists(mockPath);

        // Assert
        expect(result).toBe(true);
        expect(mockFs.access).toHaveBeenCalledWith(mockPath);
        expect(mockFs.access).toHaveBeenCalledTimes(1);
      });

      it('should return false for non-existent files', async () => {
        // Arrange
        const mockPath = '/path/to/nonexistent.txt';
        const mockError = new Error('ENOENT: no such file or directory');
        mockFs.access.mockRejectedValue(mockError);

        // Act
        const result = await fileSystem.exists(mockPath);

        // Assert
        expect(result).toBe(false);
        expect(mockFs.access).toHaveBeenCalledWith(mockPath);
      });

      it('should return false for permission denied', async () => {
        // Arrange
        const mockPath = '/path/to/protected.txt';
        const mockError = new Error('EACCES: permission denied');
        mockFs.access.mockRejectedValue(mockError);

        // Act
        const result = await fileSystem.exists(mockPath);

        // Assert
        expect(result).toBe(false);
        expect(mockFs.access).toHaveBeenCalledWith(mockPath);
      });
    });

    describe('mkdir()', () => {
      it('should create directory successfully', async () => {
        // Arrange
        const mockPath = '/path/to/newdir';
        mockFs.mkdir.mockResolvedValue(undefined);

        // Act
        await fileSystem.mkdir(mockPath);

        // Assert
        expect(mockFs.mkdir).toHaveBeenCalledWith(mockPath, undefined);
        expect(mockFs.mkdir).toHaveBeenCalledTimes(1);
      });

      it('should create directory with recursive option', async () => {
        // Arrange
        const mockPath = '/path/to/deep/newdir';
        const options = { recursive: true };
        mockFs.mkdir.mockResolvedValue(undefined);

        // Act
        await fileSystem.mkdir(mockPath, options);

        // Assert
        expect(mockFs.mkdir).toHaveBeenCalledWith(mockPath, options);
      });

      it('should handle mkdir errors', async () => {
        // Arrange
        const mockPath = '/path/to/existing';
        const mockError = new Error('EEXIST: file already exists');
        mockFs.mkdir.mockRejectedValue(mockError);

        // Act & Assert
        await expect(fileSystem.mkdir(mockPath)).rejects.toThrow('EEXIST: file already exists');
        expect(mockFs.mkdir).toHaveBeenCalledWith(mockPath, undefined);
      });

      it('should handle permission errors', async () => {
        // Arrange
        const mockPath = '/root/newdir';
        const mockError = new Error('EACCES: permission denied');
        mockFs.mkdir.mockRejectedValue(mockError);

        // Act & Assert
        await expect(fileSystem.mkdir(mockPath)).rejects.toThrow('EACCES: permission denied');
        expect(mockFs.mkdir).toHaveBeenCalledWith(mockPath, undefined);
      });
    });
  });
});