import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('[integration]: patch_diff.py Integration Tests', () => {
  let tempDir: string;
  const patchDiffPath = path.join(__dirname, '..', 'patch_diff.py');
  
  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'patch-diff-test-'));
  });
  
  afterEach(async () => {
    // Clean up temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  /**
   * Execute patch_diff.py with given patch content
   */
  async function applyPatch(patchContent: string, workingDir: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('python3', [patchDiffPath], {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(stderr || `Process exited with code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Send patch content to stdin
      child.stdin?.write(patchContent);
      child.stdin?.end();
    });
  }

  /**
   * Copy fixture template files to temp directory
   */
  async function setupTestCase(fixtureName: string): Promise<void> {
    const fixtureDir = path.join(__dirname, '../../__tests__/fixtures', fixtureName);
    const templateDir = path.join(fixtureDir, 'template');
    
    try {
      await fs.access(templateDir);
      await copyDir(templateDir, tempDir);
    } catch (error) {
      // Template directory doesn't exist, skip setup
    }
  }

  /**
   * Recursively copy directory
   */
  async function copyDir(src: string, dest: string): Promise<void> {
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    await fs.mkdir(dest, { recursive: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
  
  /**
   * Compare actual files with expected files
   */
  async function assertFilesMatch(fixtureName: string): Promise<void> {
    const expectedDir = path.join(__dirname, '../../__tests__/fixtures', fixtureName, 'expected');
    
    // Get all files in expected directory
    const expectedFiles = await getAllFiles(expectedDir);
    
    for (const relativePath of expectedFiles) {
      const expectedPath = path.join(expectedDir, relativePath);
      const actualPath = path.join(tempDir, relativePath);
      
      // Check file exists
      try {
        await fs.access(actualPath);
      } catch {
        throw new Error(`Expected file ${actualPath} to exist`);
      }
      
      // Compare content
      const expectedContent = await fs.readFile(expectedPath, 'utf-8');
      const actualContent = await fs.readFile(actualPath, 'utf-8');
      expect(actualContent).toBe(expectedContent);
    }
    
    // Also check that no extra files exist
    const actualFiles = await getAllFiles(tempDir);
    const expectedSet = new Set(expectedFiles);
    const unexpectedFiles = actualFiles.filter(f => !expectedSet.has(f));
    expect(unexpectedFiles).toEqual([]);
  }
  
  /**
   * Get all files in a directory recursively
   */
  async function getAllFiles(dir: string, base: string = ''): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(base, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...await getAllFiles(fullPath, relativePath));
      } else {
        files.push(relativePath);
      }
    }
    
    return files;
  }

  describe('Simple Update', () => {
    it('should update a single file with basic changes', async () => {
      await setupTestCase('simple-update');
      const patch = await fs.readFile(
        path.join(__dirname, '../../__tests__/fixtures', 'simple-update', 'patch.txt'), 
        'utf-8'
      );
      
      const result = await applyPatch(patch, tempDir);
      expect(result).toBe('Done!');
      
      await assertFilesMatch('simple-update');
    });
  });

  describe('Multiple Updates in Single File', () => {
    it('should apply multiple changes to one file', async () => {
      await setupTestCase('multiple-updates-single-file');
      const patch = await fs.readFile(
        path.join(__dirname, '../../__tests__/fixtures', 'multiple-updates-single-file', 'patch.txt'), 
        'utf-8'
      );
      
      const result = await applyPatch(patch, tempDir);
      expect(result).toBe('Done!');
      
      await assertFilesMatch('multiple-updates-single-file');
    });
  });


  describe('Add File', () => {
    it('should create new files', async () => {
      await setupTestCase('add-file');
      const patch = await fs.readFile(
        path.join(__dirname, '../../__tests__/fixtures', 'add-file', 'patch.txt'), 
        'utf-8'
      );
      
      const result = await applyPatch(patch, tempDir);
      expect(result).toBe('Done!');
      
      await assertFilesMatch('add-file');
    });

    it('should create nested directories when adding files', async () => {
      const patch = `*** Begin Patch
*** Add File: src/utils/helpers.py
+def format_date(date):
+    return date.strftime('%Y-%m-%d')
*** End Patch`;
      
      const result = await applyPatch(patch, tempDir);
      expect(result).toBe('Done!');
      
      const filePath = path.join(tempDir, 'src', 'utils', 'helpers.py');
      try {
        await fs.access(filePath);
      } catch {
        throw new Error(`Expected file ${filePath} to exist`);
      }
      
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe(`def format_date(date):
    return date.strftime('%Y-%m-%d')`);
    });
  });

  describe('Delete File', () => {
    it('should delete existing files', async () => {
      await setupTestCase('delete-file');
      const patch = await fs.readFile(
        path.join(__dirname, '../../__tests__/fixtures', 'delete-file', 'patch.txt'), 
        'utf-8'
      );
      
      const result = await applyPatch(patch, tempDir);
      expect(result).toBe('Done!');
      
      await assertFilesMatch('delete-file');
    });
  });

  describe('Move File', () => {
    it('should move file to new location with content update', async () => {
      await setupTestCase('move-file');
      const patch = await fs.readFile(
        path.join(__dirname, '../../__tests__/fixtures', 'move-file', 'patch.txt'), 
        'utf-8'
      );
      
      const result = await applyPatch(patch, tempDir);
      expect(result).toBe('Done!');
      
      await assertFilesMatch('move-file');
    });
  });

  describe('Complex Update', () => {
    it('should handle multiple chunks in the same file', async () => {
      await setupTestCase('complex-update');
      const patch = await fs.readFile(
        path.join(__dirname, '../../__tests__/fixtures', 'complex-update', 'patch.txt'), 
        'utf-8'
      );
      
      const result = await applyPatch(patch, tempDir);
      expect(result).toBe('Done!');
      
      await assertFilesMatch('complex-update');
    });
  });

  describe('Context and Line Matching', () => {
    it('should handle adding lines at the beginning of a file', async () => {
      await setupTestCase('add-at-beginning');
      const patch = await fs.readFile(
        path.join(__dirname, '../../__tests__/fixtures', 'add-at-beginning', 'patch.txt'), 
        'utf-8'
      );
      
      const result = await applyPatch(patch, tempDir);
      expect(result).toBe('Done!');
      
      await assertFilesMatch('add-at-beginning');
    });
  });

});