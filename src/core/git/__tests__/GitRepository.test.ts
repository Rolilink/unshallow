import { jest, beforeEach, describe, it, expect } from '@jest/globals';

// Define types for exec result
interface ExecResult {
  stdout: string;
  stderr: string;
}

// Create mock functions
const mockExecAsync = jest.fn<() => Promise<ExecResult>>();

// Mock child_process.exec and util.promisify before any imports
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

jest.mock('util', () => ({
  promisify: jest.fn(() => mockExecAsync),
}));

// Now import the class we want to test
import { GitRepository } from '../GitRepository.js';

describe('GitRepository', () => {
  let gitRepository: GitRepository;

  beforeEach(() => {
    gitRepository = new GitRepository();
    jest.clearAllMocks();
  });

  describe('getRoot()', () => {
    it('should return git repository root when in git repo', async () => {
      const expectedRoot = '/Users/test/my-project';
      const mockStdout = `${expectedRoot}\n`;
      
      // Mock successful git command
      mockExecAsync.mockResolvedValue({ stdout: mockStdout, stderr: '' });

      const result = await gitRepository.getRoot();

      expect(result).toBe(expectedRoot);
      expect(mockExecAsync).toHaveBeenCalledWith('git rev-parse --show-toplevel');
    });

    it('should return current working directory when not in git repo', async () => {
      const expectedCwd = process.cwd();
      
      // Mock git command failure (not in git repo)
      const error = new Error('fatal: not a git repository');
      mockExecAsync.mockRejectedValue(error);

      const result = await gitRepository.getRoot();

      expect(result).toBe(expectedCwd);
      expect(mockExecAsync).toHaveBeenCalledWith('git rev-parse --show-toplevel');
    });

    it('should handle git command errors gracefully', async () => {
      const expectedCwd = process.cwd();
      
      // Mock git command error (e.g., git not installed)
      const error = new Error('git: command not found');
      mockExecAsync.mockRejectedValue(error);

      const result = await gitRepository.getRoot();

      expect(result).toBe(expectedCwd);
      expect(mockExecAsync).toHaveBeenCalledWith('git rev-parse --show-toplevel');
    });

    it('should trim whitespace from git output', async () => {
      const expectedRoot = '/Users/test/my-project';
      const mockStdoutWithWhitespace = `  ${expectedRoot}  \n\t`;
      
      // Mock successful git command with extra whitespace
      mockExecAsync.mockResolvedValue({ stdout: mockStdoutWithWhitespace, stderr: '' });

      const result = await gitRepository.getRoot();

      expect(result).toBe(expectedRoot);
      expect(mockExecAsync).toHaveBeenCalledWith('git rev-parse --show-toplevel');
    });

    it('should handle empty git output gracefully', async () => {
      // Mock git command with empty output
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await gitRepository.getRoot();

      // Empty string after trim should still be returned
      expect(result).toBe('');
      expect(mockExecAsync).toHaveBeenCalledWith('git rev-parse --show-toplevel');
    });

    it('should handle git output with only whitespace', async () => {
      const mockStdoutOnlyWhitespace = '   \n\t  ';
      
      // Mock git command with only whitespace
      mockExecAsync.mockResolvedValue({ stdout: mockStdoutOnlyWhitespace, stderr: '' });

      const result = await gitRepository.getRoot();

      // Whitespace-only string should be trimmed to empty string
      expect(result).toBe('');
      expect(mockExecAsync).toHaveBeenCalledWith('git rev-parse --show-toplevel');
    });

    it('should handle different git repository paths correctly', async () => {
      const testCases = [
        '/home/user/projects/frontend',
        '/var/www/html/my-app',
        'C:\\Users\\dev\\projects\\backend',
        '/Users/developer/work/mobile-app',
      ];

      for (const expectedPath of testCases) {
        // Reset mocks for each test case
        jest.clearAllMocks();
        
        const mockStdout = `${expectedPath}\n`;
        
        mockExecAsync.mockResolvedValue({ stdout: mockStdout, stderr: '' });

        const result = await gitRepository.getRoot();

        expect(result).toBe(expectedPath);
        expect(mockExecAsync).toHaveBeenCalledWith('git rev-parse --show-toplevel');
      }
    });

    it('should handle git command timeout errors', async () => {
      const expectedCwd = process.cwd();
      
      // Mock git command timeout
      const error = new Error('Command timed out');
      (error as Error & { name: string }).name = 'TimeoutError';
      mockExecAsync.mockRejectedValue(error);

      const result = await gitRepository.getRoot();

      expect(result).toBe(expectedCwd);
      expect(mockExecAsync).toHaveBeenCalledWith('git rev-parse --show-toplevel');
    });

    it('should handle permission denied errors', async () => {
      const expectedCwd = process.cwd();
      
      // Mock permission denied error
      const error = new Error('Permission denied');
      mockExecAsync.mockRejectedValue(error);

      const result = await gitRepository.getRoot();

      expect(result).toBe(expectedCwd);
      expect(mockExecAsync).toHaveBeenCalledWith('git rev-parse --show-toplevel');
    });

    it('should handle corrupted git repository errors', async () => {
      const expectedCwd = process.cwd();
      
      // Mock corrupted git repository error
      const error = new Error('fatal: not a git repository (or any of the parent directories): .git');
      mockExecAsync.mockRejectedValue(error);

      const result = await gitRepository.getRoot();

      expect(result).toBe(expectedCwd);
      expect(mockExecAsync).toHaveBeenCalledWith('git rev-parse --show-toplevel');
    });
  });
});