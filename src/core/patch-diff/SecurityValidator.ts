/**
 * SecurityValidator component for enforcing permission and file access control.
 * 
 * Provides security-first validation of patch operations to prevent unauthorized
 * actions and file access. Supports both whitelist and blacklist modes with
 * glob pattern matching for fine-grained control.
 */

import minimatch from 'minimatch';
import {
  ActionType,
  PatchAction,
  PatchOptions,
  PatchPermissions,
  FileAccessControl,
  PatchError,
  PatchErrorCode
} from './types';

/**
 * Result of validation operation
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** List of validation errors */
  errors: string[];
  /** List of warnings (non-blocking) */
  warnings: string[];
  /** Additional context for debugging */
  context?: Record<string, unknown>;
}

/**
 * Specific error for permission violations
 */
export class PermissionDeniedError extends PatchError {
  constructor(
    operation: string,
    filePath: string,
    context?: Record<string, unknown>
  ) {
    super(
      `Permission denied: ${operation} operation not allowed on ${filePath}`,
      PatchErrorCode.VALIDATION_FAILED,
      { ...context, operation },
      filePath
    );
    Object.setPrototypeOf(this, PermissionDeniedError.prototype);
  }
}

/**
 * Specific error for file access violations
 */
export class FileAccessDeniedError extends PatchError {
  constructor(
    filePath: string,
    reason: string,
    context?: Record<string, unknown>
  ) {
    super(
      `File access denied: ${filePath} - ${reason}`,
      PatchErrorCode.VALIDATION_FAILED,
      { ...context, reason },
      filePath
    );
    Object.setPrototypeOf(this, FileAccessDeniedError.prototype);
  }
}

/**
 * SecurityValidator component for enforcing patch operation security.
 * Uses composition to access configuration and provides validation methods.
 */
export class SecurityValidator {
  private readonly permissions: PatchPermissions;
  private readonly fileAccess: FileAccessControl;

  constructor(options: PatchOptions) {
    this.permissions = options.permissions;
    this.fileAccess = options.fileAccess;
  }

  /**
   * Validate that all actions are permitted by the permission model
   */
  async validatePermissions(
    actions: Map<string, PatchAction>
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const violatedActions: Array<{ action: PatchAction; reason: string }> = [];

    for (const [filePath, action] of actions) {
      const violation = this.checkOperationPermission(action);
      if (violation) {
        errors.push(`${filePath}: ${violation}`);
        violatedActions.push({ action, reason: violation });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      context: {
        totalActions: actions.size,
        violatedActions: violatedActions.length,
        permissions: this.permissions
      }
    };
  }

  /**
   * Validate that all file paths are allowed by the access control rules
   */
  async validateFileAccess(filePaths: string[]): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const violatedPaths: Array<{ path: string; reason: string }> = [];

    // Check file count limit
    if (filePaths.length > this.fileAccess.maxFilesPerPatch) {
      errors.push(
        `Too many files in patch: ${filePaths.length} exceeds limit of ${this.fileAccess.maxFilesPerPatch}`
      );
    }

    // Check each file path against access rules
    for (const filePath of filePaths) {
      const violation = this.checkFileAccess(filePath);
      if (violation) {
        errors.push(`${filePath}: ${violation}`);
        violatedPaths.push({ path: filePath, reason: violation });
      }
    }

    // Generate warnings for potentially risky files
    const riskyPaths = this.identifyRiskyPaths(filePaths);
    for (const { path, reason } of riskyPaths) {
      warnings.push(`${path}: ${reason}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      context: {
        totalPaths: filePaths.length,
        violatedPaths: violatedPaths.length,
        riskyPaths: riskyPaths.length,
        fileAccess: this.fileAccess
      }
    };
  }

  /**
   * Validate both permissions and file access for a complete patch
   */
  async validatePatch(
    actions: Map<string, PatchAction>
  ): Promise<ValidationResult> {
    const permissionResult = await this.validatePermissions(actions);
    const filePaths = Array.from(actions.keys());
    const accessResult = await this.validateFileAccess(filePaths);

    return {
      isValid: permissionResult.isValid && accessResult.isValid,
      errors: [...permissionResult.errors, ...accessResult.errors],
      warnings: [...permissionResult.warnings, ...accessResult.warnings],
      context: {
        permissionValidation: permissionResult.context,
        accessValidation: accessResult.context,
        totalActions: actions.size
      }
    };
  }

  /**
   * Check if a specific operation is permitted
   */
  private checkOperationPermission(action: PatchAction): string | null {
    switch (action.type) {
      case ActionType.ADD:
        if (!this.permissions.allowFileCreation) {
          return 'File creation is not permitted';
        }
        // Check if adding a file to a new directory
        if (action.filePath.includes('/') && !this.permissions.allowDirectoryCreation) {
          const dir = action.filePath.substring(0, action.filePath.lastIndexOf('/'));
          return `Directory creation is not permitted: ${dir}`;
        }
        break;

      case ActionType.DELETE:
        if (!this.permissions.allowFileDeletion) {
          return 'File deletion is not permitted';
        }
        break;

      case ActionType.UPDATE:
        if (!this.permissions.allowFileUpdates) {
          return 'File updates are not permitted';
        }
        // Check for file moving
        if (action.movePath && !this.permissions.allowFileMoving) {
          return `File moving is not permitted: ${action.filePath} -> ${action.movePath}`;
        }
        break;

      default:
        return `Unknown operation type: ${action.type}`;
    }

    return null;
  }

  /**
   * Check if a file path is allowed by access control rules
   */
  private checkFileAccess(filePath: string): string | null {
    // Normalize path for consistent matching
    const normalizedPath = this.normalizePath(filePath);

    // Check forbidden paths first (always enforced)
    for (const forbiddenPattern of this.fileAccess.forbiddenPaths) {
      if (this.matchesPattern(normalizedPath, forbiddenPattern)) {
        return `File is forbidden by pattern: ${forbiddenPattern}`;
      }
    }

    // In whitelist mode, only allowed paths are permitted
    if (this.fileAccess.whitelistMode) {
      let isAllowed = false;
      
      for (const allowedPattern of this.fileAccess.allowedPaths) {
        if (this.matchesPattern(normalizedPath, allowedPattern)) {
          isAllowed = true;
          break;
        }
      }

      if (!isAllowed) {
        return 'File is not in whitelist';
      }
    }

    return null;
  }

  /**
   * Identify potentially risky file paths that should generate warnings
   */
  private identifyRiskyPaths(filePaths: string[]): Array<{ path: string; reason: string }> {
    const riskyPaths: Array<{ path: string; reason: string }> = [];

    const riskyPatterns = [
      { pattern: '*.env', reason: 'Environment file - may contain secrets' },
      { pattern: '.env*', reason: 'Environment file - may contain secrets' },
      { pattern: '**/secrets/**', reason: 'Secrets directory' },
      { pattern: '**/config/**/*.key', reason: 'Key file in config directory' },
      { pattern: '**/config/**/*.pem', reason: 'Certificate file in config directory' },
      { pattern: 'package.json', reason: 'Package configuration file' },
      { pattern: 'package-lock.json', reason: 'Package lock file' },
      { pattern: 'yarn.lock', reason: 'Yarn lock file' },
      { pattern: '.git/**', reason: 'Git internal file' },
      { pattern: 'node_modules/**', reason: 'Dependency file' },
      { pattern: '**/*.log', reason: 'Log file' },
      { pattern: '**/build/**', reason: 'Build artifact' },
      { pattern: '**/dist/**', reason: 'Distribution artifact' }
    ];

    for (const filePath of filePaths) {
      const normalizedPath = this.normalizePath(filePath);
      
      for (const { pattern, reason } of riskyPatterns) {
        if (this.matchesPattern(normalizedPath, pattern)) {
          riskyPaths.push({ path: filePath, reason });
          break; // Only report first match per file
        }
      }
    }

    return riskyPaths;
  }

  /**
   * Check if a file path matches a glob pattern
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    try {
      return minimatch(filePath, pattern, {
        dot: true,        // Match dotfiles
        nocase: false,    // Case sensitive
        matchBase: false  // Don't match basename only
      });
    } catch (error) {
      // If pattern is invalid, treat as literal string match
      return filePath === pattern;
    }
  }

  /**
   * Normalize file path for consistent pattern matching
   */
  private normalizePath(filePath: string): string {
    // Convert Windows-style paths to Unix-style
    let normalized = filePath.replace(/\\/g, '/');
    
    // Remove leading ./ if present
    if (normalized.startsWith('./')) {
      normalized = normalized.substring(2);
    }
    
    // Remove leading / if present (for relative path matching)
    if (normalized.startsWith('/')) {
      normalized = normalized.substring(1);
    }
    
    return normalized;
  }

  /**
   * Get a summary of current security configuration
   */
  getSecuritySummary(): {
    permissions: PatchPermissions;
    fileAccess: Omit<FileAccessControl, 'allowedPaths' | 'forbiddenPaths'> & {
      allowedPatternCount: number;
      forbiddenPatternCount: number;
    };
  } {
    return {
      permissions: { ...this.permissions },
      fileAccess: {
        whitelistMode: this.fileAccess.whitelistMode,
        maxFilesPerPatch: this.fileAccess.maxFilesPerPatch,
        allowedPatternCount: this.fileAccess.allowedPaths.length,
        forbiddenPatternCount: this.fileAccess.forbiddenPaths.length
      }
    };
  }

  /**
   * Test if a specific file would be allowed (for debugging/testing)
   */
  async testFileAccess(filePath: string): Promise<{
    allowed: boolean;
    reason?: string;
    matchedPatterns: {
      allowed: string[];
      forbidden: string[];
    };
  }> {
    const normalizedPath = this.normalizePath(filePath);
    const matchedAllowed: string[] = [];
    const matchedForbidden: string[] = [];

    // Check which patterns match
    for (const pattern of this.fileAccess.allowedPaths) {
      if (this.matchesPattern(normalizedPath, pattern)) {
        matchedAllowed.push(pattern);
      }
    }

    for (const pattern of this.fileAccess.forbiddenPaths) {
      if (this.matchesPattern(normalizedPath, pattern)) {
        matchedForbidden.push(pattern);
      }
    }

    // Apply access logic
    const violation = this.checkFileAccess(filePath);
    
    return {
      allowed: violation === null,
      reason: violation || undefined,
      matchedPatterns: {
        allowed: matchedAllowed,
        forbidden: matchedForbidden
      }
    };
  }
}