import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

/**
 * Paths for a test directory setup
 */
export interface TestDirectoryPaths {
	unshallowDir: string;
	testDir: string;
	logsPath: string;
	attemptPath: string;
}

/**
 * Handles operations on the .unshallow directories in test folders
 */
export class TestFileSystem {
	/**
	 * Gets the path to the .unshallow directory for a test file
	 */
	getUnshallowDirPath(testFilePath: string): string {
		const folderDir = path.dirname(testFilePath);
		return path.join(folderDir, '.unshallow');
	}

	/**
	 * Extracts the component name from a test file path
	 */
	getTestComponentName(testFilePath: string): string {
		// Get file name without extension
		const fileNameWithoutExt = path.basename(
			testFilePath,
			path.extname(testFilePath),
		);

		// Extract component name by removing .test or .spec suffix
		return fileNameWithoutExt.replace(/\.(test|spec)$/, '');
	}

	/**
	 * Gets the component-specific test directory path
	 */
	getTestDirectoryPath(testFilePath: string): string {
		const unshallowDir = this.getUnshallowDirPath(testFilePath);
		const componentName = this.getTestComponentName(testFilePath);

		return path.join(unshallowDir, componentName);
	}

	/**
	 * Creates the path for the attempt file in .unshallow directory
	 */
	getAttemptFilePath(testFilePath: string, testDir: string): string {
		const fileName = path.basename(testFilePath);
		return path.join(testDir, fileName);
	}

	/**
	 * Creates the .unshallow directory and its subdirectories for a test file
	 */
	async setupTestDirectory(testFilePath: string): Promise<TestDirectoryPaths> {
		const componentName = this.getTestComponentName(testFilePath);

		// Get the .unshallow directory path
		const unshallowDir = this.getUnshallowDirPath(testFilePath);

		// Get the component-specific test directory
		const testDir = path.join(unshallowDir, componentName);

		// Create paths for logs and attempt file (now same name as original file)
		const logsPath = path.join(testDir, 'logs.txt');
		const attemptPath = this.getAttemptFilePath(testFilePath, testDir);

		// Ensure the directories exist
		await fs.mkdir(unshallowDir, {recursive: true});
		await fs.mkdir(testDir, {recursive: true});

		return {
			unshallowDir,
			testDir,
			logsPath,
			attemptPath,
		};
	}

	/**
	 * Checks if an attempt file exists for a test
	 */
	attemptFileExists(testFilePath: string): boolean {
		const testDir = this.getTestDirectoryPath(testFilePath);
		const attemptPath = this.getAttemptFilePath(testFilePath, testDir);
		return fsSync.existsSync(attemptPath);
	}

	/**
	 * Reads the content of an attempt file if it exists
	 */
	async readAttemptFile(testFilePath: string): Promise<string | null> {
		const testDir = this.getTestDirectoryPath(testFilePath);
		const attemptPath = this.getAttemptFilePath(testFilePath, testDir);

		if (fsSync.existsSync(attemptPath)) {
			return fs.readFile(attemptPath, 'utf8');
		}

		return null;
	}

	/**
	 * Checks if the .unshallow directory is empty and safe to delete
	 */
	async isUnshallowDirectoryEmpty(unshallowDir: string): Promise<boolean> {
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
	 * Cleans up a test directory and also cleans up the parent .unshallow directory
	 * if it becomes empty (meaning all tests have passed)
	 */
	async cleanupTestDirectory(testDir: string): Promise<void> {
		try {
			// Get the parent .unshallow directory before removing the test directory
			const unshallowDir = path.dirname(testDir);

			// Remove the test directory
			await fs.rm(testDir, {recursive: true, force: true});

			// Check if the .unshallow directory is now empty
			const isEmpty = await this.isUnshallowDirectoryEmpty(unshallowDir);

			// If empty, remove the entire .unshallow directory
			if (isEmpty) {
				await fs.rm(unshallowDir, {recursive: true, force: true});
				console.log(`Cleaned up empty .unshallow directory: ${unshallowDir}`);
			}
		} catch (error) {
			console.error(
				`Error cleaning up test directory: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}
}
