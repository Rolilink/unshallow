import * as path from 'path';
import { SecurityError } from './types';

/**
 * SecurityValidator handles path validation and security checks
 * Based on security restrictions from original implementation
 */
export class SecurityValidator {
  /**
   * Validate that a path is safe for use
   * Prevents directory traversal and absolute path attacks
   */
  validatePath(filePath: string): void {
    // No absolute paths allowed (from original implementation line 730)
    if (path.isAbsolute(filePath)) {
      throw new SecurityError('Absolute path not allowed: ' + filePath);
    }

    // No directory traversal
    if (filePath.includes('../')) {
      throw new SecurityError(`Path traversal not allowed: ${filePath}`);
    }

    // No null bytes
    if (filePath.includes('\0')) {
      throw new SecurityError(`Null byte in path not allowed: ${filePath}`);
    }

    // No empty paths
    if (filePath.trim() === '') {
      throw new SecurityError('Empty path not allowed');
    }
  }

  /**
   * Validate multiple paths at once
   */
  validatePaths(paths: string[]): void {
    for (const filePath of paths) {
      this.validatePath(filePath);
    }
  }

  /**
   * Resolve a relative path against a root directory
   * Ensures the resolved path stays within the root
   */
  resolvePath(rootPath: string, relativePath: string): string {
    // For resolvePath, we validate without allowing traversal initially
    if (path.isAbsolute(relativePath)) {
      throw new SecurityError('Absolute path not allowed: ' + relativePath);
    }
    if (relativePath.includes('\0')) {
      throw new SecurityError(`Null byte in path not allowed: ${relativePath}`);
    }
    if (relativePath.trim() === '') {
      throw new SecurityError('Empty path not allowed');
    }
    
    const resolved = path.resolve(rootPath, relativePath);
    const normalizedRoot = path.resolve(rootPath);
    
    // Ensure the resolved path is within the root directory
    if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) {
      throw new SecurityError(`Path outside root directory: ${relativePath}`);
    }
    
    return resolved;
  }

  /**
   * Ensure parent directory exists for a given path
   * Used when creating new files
   */
  getParentDirectory(filePath: string): string {
    const parentDir = path.dirname(filePath);
    return parentDir === '.' ? '.' : parentDir;
  }
}