import * as path from 'path';
import { IFileSystem } from '../types';

/**
 * A filesystem proxy that constrains all operations to a specified root directory.
 * 
 * This class acts as a security boundary and provides isolation for patch operations.
 * All relative paths are resolved within the root directory, and absolute paths
 * or paths that attempt to escape the root are rejected.
 * 
 * This design supports:
 * - Security: Prevents path traversal attacks
 * - Testing: Isolates operations to temp directories
 * - Git worktrees: Future support for isolated workspaces
 */
export class RootedFileSystem implements IFileSystem {
  private readonly normalizedRoot: string;

  constructor(
    private readonly fileSystem: IFileSystem,
    rootPath: string
  ) {
    // Normalize and resolve the root path to an absolute path
    this.normalizedRoot = path.resolve(rootPath);
  }

  /**
   * Resolves a relative path to an absolute path within the root directory.
   * Validates that the resolved path doesn't escape the root.
   */
  private resolvePath(relativePath: string): string {
    // Handle empty or just whitespace paths
    if (!relativePath.trim()) {
      throw new Error('Path cannot be empty');
    }

    // Reject absolute paths that don't start with our root
    if (path.isAbsolute(relativePath)) {
      const normalizedPath = path.normalize(relativePath);
      if (!normalizedPath.startsWith(this.normalizedRoot)) {
        throw new Error(`Absolute path '${relativePath}' is outside root directory '${this.normalizedRoot}'`);
      }
      return normalizedPath;
    }

    // Resolve relative path within root
    const resolvedPath = path.resolve(this.normalizedRoot, relativePath);
    
    // Ensure the resolved path is still within the root
    if (!resolvedPath.startsWith(this.normalizedRoot)) {
      throw new Error(`Path '${relativePath}' resolves outside root directory '${this.normalizedRoot}'`);
    }

    return resolvedPath;
  }

  async read(filePath: string): Promise<string> {
    const resolvedPath = this.resolvePath(filePath);
    return await this.fileSystem.read(resolvedPath);
  }

  async readAsJson<T = unknown>(filePath: string): Promise<T> {
    const resolvedPath = this.resolvePath(filePath);
    return await this.fileSystem.readAsJson<T>(resolvedPath);
  }

  async write(filePath: string, content: string): Promise<void> {
    const resolvedPath = this.resolvePath(filePath);
    
    // Ensure parent directory exists
    const parentDir = path.dirname(resolvedPath);
    await this.fileSystem.mkdir(parentDir, { recursive: true });
    
    return await this.fileSystem.write(resolvedPath, content);
  }

  async delete(filePath: string): Promise<void> {
    const resolvedPath = this.resolvePath(filePath);
    return await this.fileSystem.delete(resolvedPath);
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const resolvedPath = this.resolvePath(filePath);
      return await this.fileSystem.exists(resolvedPath);
    } catch {
      // If path resolution fails, the file doesn't exist within our root
      return false;
    }
  }

  async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
    const resolvedPath = this.resolvePath(dirPath);
    return await this.fileSystem.mkdir(resolvedPath, options);
  }

  /**
   * Get the root directory for this filesystem
   */
  getRoot(): string {
    return this.normalizedRoot;
  }

  /**
   * Convert an absolute path back to a relative path within this root.
   * Useful for displaying paths to users or in error messages.
   */
  getRelativePath(absolutePath: string): string {
    const normalizedPath = path.normalize(absolutePath);
    if (!normalizedPath.startsWith(this.normalizedRoot)) {
      throw new Error(`Path '${absolutePath}' is outside root directory '${this.normalizedRoot}'`);
    }
    
    const relativePath = path.relative(this.normalizedRoot, normalizedPath);
    return relativePath || '.';
  }
}