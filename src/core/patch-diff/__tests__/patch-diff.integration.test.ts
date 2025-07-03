import { describe, it, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FileSystem } from '../../file-system/FileSystem/FileSystem';
import { PatchDiff } from '../PatchDiff';

describe('[integration]: PatchDiff End-to-End Tests', () => {
  let tempDir: string;
  let patchDiff: PatchDiff;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'patch-diff-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // Helper function to copy directory recursively
  async function copyDirectory(source: string, destination: string): Promise<void> {
    await fs.mkdir(destination, { recursive: true });
    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  // Helper function to compare directories
  async function compareDirectories(actualDir: string, expectedDir: string): Promise<boolean> {
    const actualFiles = await getAllFiles(actualDir);
    const expectedFiles = await getAllFiles(expectedDir);

    // Check if same number of files
    if (actualFiles.length !== expectedFiles.length) {
      console.error(`File count mismatch: actual=${actualFiles.length}, expected=${expectedFiles.length}`);
      console.error('Actual files:', actualFiles);
      console.error('Expected files:', expectedFiles);
      return false;
    }

    // Compare each file
    for (const relPath of expectedFiles) {
      const actualPath = path.join(actualDir, relPath);
      const expectedPath = path.join(expectedDir, relPath);

      try {
        const actualContent = await fs.readFile(actualPath, 'utf-8');
        const expectedContent = await fs.readFile(expectedPath, 'utf-8');

        if (actualContent !== expectedContent) {
          console.error(`Content mismatch in ${relPath}`);
          console.error('Actual:', actualContent);
          console.error('Expected:', expectedContent);
          return false;
        }
      } catch (error) {
        console.error(`Failed to read file ${relPath}:`, error);
        return false;
      }
    }

    return true;
  }

  // Helper to get all files in a directory recursively
  async function getAllFiles(dir: string, base: string = ''): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(base, entry.name);

      if (entry.isDirectory()) {
        files.push(...await getAllFiles(fullPath, relPath));
      } else {
        files.push(relPath);
      }
    }

    return files.sort();
  }

  // Helper function to run a fixture test
  async function runFixtureTest(fixtureName: string): Promise<void> {
    const fixtureDir = path.join(__dirname, 'fixtures', fixtureName);
    const templateDir = path.join(fixtureDir, 'template');
    const expectedDir = path.join(fixtureDir, 'expected');
    const patchPath = path.join(fixtureDir, 'patch.txt');

    // Copy template files to temp directory (if template exists)
    try {
      await fs.access(templateDir);
      await copyDirectory(templateDir, tempDir);
    } catch {
      // No template directory - that's ok for add-file tests
    }

    // Create PatchDiff instance with tempDir as root
    const fileSystem = new FileSystem();
    patchDiff = new PatchDiff(fileSystem, tempDir);

    // Read and apply patch
    const patchContent = await fs.readFile(patchPath, 'utf-8');
    const result = await patchDiff.apply(patchContent);

    // Check if patch application was successful
    if (!result.success) {
      throw new Error(`Patch application failed: ${result.error?.message || 'Unknown error'}`);
    }

    // Compare results with expected
    const matches = await compareDirectories(tempDir, expectedDir);
    if (!matches) {
      throw new Error('Output does not match expected results');
    }
  }

  // Test cases for all fixtures
  it('should apply simple-update patch correctly', async () => {
    await runFixtureTest('simple-update');
  });

  it('should apply multiple-updates-single-file patch correctly', async () => {
    await runFixtureTest('multiple-updates-single-file');
  });

  it('should apply complex-update patch correctly', async () => {
    await runFixtureTest('complex-update');
  });

  it('should apply add-at-beginning patch correctly', async () => {
    await runFixtureTest('add-at-beginning');
  });

  it('should apply whitespace-fuzzy patch correctly', async () => {
    await runFixtureTest('whitespace-fuzzy');
  });

  it('should apply move-file patch correctly', async () => {
    await runFixtureTest('move-file');
  });

  it('should apply add-file patch correctly (multi-file)', async () => {
    await runFixtureTest('add-file');
  });

  it('should apply delete-file patch correctly (multi-file)', async () => {
    await runFixtureTest('delete-file');
  });
});