import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

/**
 * Creates the .unshallow directory for a test file
 * @param testFilePath Path to the original test file
 * @returns Object with paths for the .unshallow directory, logs file, and attempt file
 */
export async function setupUnshallowDirectory(testFilePath: string): Promise<{
  unshallowDir: string;
  testDir: string;
  logsPath: string;
  tempPath: string;
  attemptPath: string;
}> {
  const folderDir = path.dirname(testFilePath);
  const testBaseName = path.basename(testFilePath, path.extname(testFilePath));
  const testExt = path.extname(testFilePath);

  // Create temporary file path in the same directory as the test
  const tempPath = path.join(folderDir, `${testBaseName}.temp${testExt}`);

  // Create .unshallow directory path in the test's folder
  const unshallowDir = path.join(folderDir, '.unshallow');

  // Create a subfolder for this specific test (without extension)
  const testDir = path.join(unshallowDir, testBaseName);

  // Create paths for logs and attempt file
  const logsPath = path.join(testDir, 'logs.txt');
  // Save attempt path for failed cases in the unshallow directory
  const attemptPath = path.join(testDir, `${testBaseName}.attempt${testExt}`);

  // Ensure the directories exist
  await fs.mkdir(unshallowDir, { recursive: true });
  await fs.mkdir(testDir, { recursive: true });

  // Initialize logs file if it doesn't exist
  if (!fsSync.existsSync(logsPath)) {
    const timestamp = new Date().toISOString();
    await fs.writeFile(logsPath, `--- Migration started at ${timestamp} ---\n\n`);
  }

  return {
    unshallowDir,
    testDir,
    logsPath,
    tempPath,
    attemptPath
  };
}

/**
 * Appends a log message to the logs file
 * @param logsPath Path to the logs file
 * @param message Message to log
 * @param type Type of log (info, error, success)
 */
export async function appendLog(
  logsPath: string,
  message: string,
  type: 'info' | 'error' | 'success' = 'info'
): Promise<void> {
  const timestamp = new Date().toISOString();
  let prefix: string;

  switch (type) {
    case 'error':
      prefix = '[ERROR]';
      break;
    case 'success':
      prefix = '[SUCCESS]';
      break;
    default:
      prefix = '[INFO]';
  }

  const logLine = `${timestamp} ${prefix} ${message}\n`;
  await fs.appendFile(logsPath, logLine);
}

/**
 * Cleans up the test directory inside .unshallow
 * @param testDir Path to the test directory
 */
export async function cleanupTestDirectory(testDir: string): Promise<void> {
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (error) {
    console.error(`Error cleaning up test directory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Cleans up the entire .unshallow directory
 * @param unshallowDir Path to the .unshallow directory
 */
export async function cleanupUnshallowDirectory(unshallowDir: string): Promise<void> {
  try {
    await fs.rm(unshallowDir, { recursive: true, force: true });
  } catch (error) {
    console.error(`Error cleaning up .unshallow directory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Cleans up the temporary file
 * @param tempPath Path to the temporary file
 */
export async function cleanupTempFile(tempPath: string): Promise<void> {
  try {
    if (fsSync.existsSync(tempPath)) {
      await fs.unlink(tempPath);
    }
  } catch (error) {
    console.error(`Error cleaning up temporary file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Finalizes a successful migration by replacing the original file and cleaning up
 * @param originalFilePath Path to the original test file
 * @param tempPath Path to the temporary file with the successful migration
 * @param testDir Path to the test's directory in .unshallow
 */
export async function finalizeMigration(
  originalFilePath: string,
  tempPath: string,
  testDir: string
): Promise<void> {
  try {
    // Read the content of the temporary file
    const content = await fs.readFile(tempPath, 'utf8');

    // Replace the original file with the content of the temporary file
    await fs.writeFile(originalFilePath, content, 'utf8');

    // Clean up the temporary file
    await cleanupTempFile(tempPath);

    // Clean up just this test's directory
    await cleanupTestDirectory(testDir);
  } catch (error) {
    console.error(`Error finalizing migration: ${error instanceof Error ? error.message : String(error)}`);
  }
}
