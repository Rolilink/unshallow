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
  logsPath: string;
  attemptPath: string;
}> {
  const testDir = path.dirname(testFilePath);
  const testBaseName = path.basename(testFilePath, path.extname(testFilePath));
  const testExt = path.extname(testFilePath);

  // Create .unshallow directory path next to the test file
  const unshallowDir = path.join(testDir, '.unshallow');

  // Create paths for logs and attempt file
  const logsPath = path.join(unshallowDir, 'logs.txt');
  const attemptPath = path.join(unshallowDir, `${testBaseName}.attempt${testExt}`);

  // Ensure the directory exists
  await fs.mkdir(unshallowDir, { recursive: true });

  // Initialize logs file if it doesn't exist
  if (!fsSync.existsSync(logsPath)) {
    const timestamp = new Date().toISOString();
    await fs.writeFile(logsPath, `--- Migration started at ${timestamp} ---\n\n`);
  }

  return {
    unshallowDir,
    logsPath,
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
 * Cleans up the .unshallow directory
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
 * Finalizes a successful migration by replacing the original file and cleaning up
 * @param originalFilePath Path to the original test file
 * @param attemptPath Path to the attempt file with the successful migration
 * @param unshallowDir Path to the .unshallow directory
 */
export async function finalizeMigration(
  originalFilePath: string,
  attemptPath: string,
  unshallowDir: string
): Promise<void> {
  try {
    // Read the content of the attempt file
    const content = await fs.readFile(attemptPath, 'utf8');

    // Replace the original file with the content of the attempt file
    await fs.writeFile(originalFilePath, content, 'utf8');

    // Clean up the .unshallow directory
    await cleanupUnshallowDirectory(unshallowDir);
  } catch (error) {
    console.error(`Error finalizing migration: ${error instanceof Error ? error.message : String(error)}`);
  }
}
