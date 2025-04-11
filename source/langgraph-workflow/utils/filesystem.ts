import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

/**
 * Gets the component test directory path for a test file without setting up the directory
 * @param testFilePath Path to the original test file
 * @returns Path to the component's directory in .unshallow
 */
export function getTestDirectoryPath(testFilePath: string): string {
	const folderDir = path.dirname(testFilePath);
	// Get file name without extension
	const fileNameWithoutExt = path.basename(
		testFilePath,
		path.extname(testFilePath),
	);

	// Extract component name by removing .test or .spec suffix
	const componentName = fileNameWithoutExt.replace(/\.(test|spec)$/, '');

	// Create .unshallow directory path in the test's folder
	const unshallowDir = path.join(folderDir, '.unshallow');

	// Create a subfolder for this specific component (without test/spec suffix)
	const testDir = path.join(unshallowDir, componentName);

	return testDir;
}

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
	// Get file name without extension
	const fileNameWithoutExt = path.basename(
		testFilePath,
		path.extname(testFilePath),
	);
	const testExt = path.extname(testFilePath);

	// Extract component name by removing .test or .spec suffix
	const componentName = fileNameWithoutExt.replace(/\.(test|spec)$/, '');

	// Create temporary file path in the same directory as the test
	const tempPath = path.join(folderDir, `${fileNameWithoutExt}.temp${testExt}`);

	// Create .unshallow directory path in the test's folder
	const unshallowDir = path.join(folderDir, '.unshallow');

	// Create a subfolder for this specific component (without test/spec suffix)
	const testDir = path.join(unshallowDir, componentName);

	// Create paths for logs and attempt file
	const logsPath = path.join(testDir, 'logs.txt');
	// Save attempt path for failed cases in the unshallow directory
	const attemptPath = path.join(
		testDir,
		`${fileNameWithoutExt}.attempt${testExt}`,
	);

	// Ensure the directories exist
	await fs.mkdir(unshallowDir, {recursive: true});
	await fs.mkdir(testDir, {recursive: true});

	// Initialize logs file if it doesn't exist
	if (!fsSync.existsSync(logsPath)) {
		const timestamp = new Date().toISOString();
		await fs.writeFile(
			logsPath,
			`--- Migration started at ${timestamp} ---\n\n`,
		);
	}

	return {
		unshallowDir,
		testDir,
		logsPath,
		tempPath,
		attemptPath,
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
	type: 'info' | 'error' | 'success' = 'info',
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
		await fs.rm(testDir, {recursive: true, force: true});

		// Get the unshallow directory (parent of test directory)
		const unshallowDir = path.dirname(testDir);

		// Check if unshallow directory is empty and clean it up if it is
		await safelyCleanupUnshallowDirectory(unshallowDir);
	} catch (error) {
		console.error(
			`Error cleaning up test directory: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

/**
 * Checks if the .unshallow directory is empty and safe to delete
 * @param unshallowDir Path to the .unshallow directory
 * @returns Boolean indicating if the directory is empty
 */
export async function isUnshallowDirectoryEmpty(
	unshallowDir: string,
): Promise<boolean> {
	try {
		if (!fsSync.existsSync(unshallowDir)) {
			return true;
		}
		const contents = await fs.readdir(unshallowDir);
		// Filter out system files like .DS_Store on macOS
		const filteredContents = contents.filter(item => !item.startsWith('.'));
		return filteredContents.length === 0;
	} catch (error) {
		console.error(
			`Error checking if .unshallow directory is empty: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return false;
	}
}

/**
 * Safely cleans up the .unshallow directory only if it's empty
 * @param unshallowDir Path to the .unshallow directory
 */
export async function safelyCleanupUnshallowDirectory(
	unshallowDir: string,
): Promise<void> {
	try {
		const isEmpty = await isUnshallowDirectoryEmpty(unshallowDir);
		if (isEmpty) {
			await fs.rm(unshallowDir, {recursive: true, force: true});
			console.log(`Cleaned up empty .unshallow directory: ${unshallowDir}`);
		}
	} catch (error) {
		console.error(
			`Error cleaning up .unshallow directory: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
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
		console.error(
			`Error cleaning up temporary file: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

/**
 * Saves a file to the test directory inside .unshallow
 * @param testDir Path to the test directory
 * @param filename Name of the file to save
 * @param content Content to write to the file
 * @returns Path to the saved file
 */
export async function saveFileToTestDirectory(
	testDir: string,
	filename: string,
	content: string,
): Promise<string> {
	try {
		// Verify the test directory exists
		if (!fsSync.existsSync(testDir)) {
			console.error(`Test directory doesn't exist: ${testDir}`);
			await fs.mkdir(testDir, {recursive: true});
			console.log(`Created test directory: ${testDir}`);
		}

		const filePath = path.join(testDir, filename);
		await fs.writeFile(filePath, content, 'utf8');

		// Verify file was created
		if (fsSync.existsSync(filePath)) {
			console.log(`Successfully wrote file to: ${filePath}`);
		} else {
			console.error(
				`File was not created even though no error was thrown: ${filePath}`,
			);
		}

		return filePath;
	} catch (error) {
		console.error(
			`Error saving file to test directory: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		throw error;
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
	testDir: string,
): Promise<void> {
	try {
		// Read the content of the temporary file
		const content = await fs.readFile(tempPath, 'utf8');

		// Replace the original file with the content of the temporary file
		await fs.writeFile(originalFilePath, content, 'utf8');

		// Clean up the temporary file
		await cleanupTempFile(tempPath);

		// Clean up just this test's directory
		// Note: cleanupTestDirectory also checks if the .unshallow directory is empty
		// and will clean it up if necessary
		await cleanupTestDirectory(testDir);
	} catch (error) {
		console.error(
			`Error finalizing migration: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}
