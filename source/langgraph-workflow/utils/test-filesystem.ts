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
	tempPath: string;
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
	 * Creates the .unshallow directory and its subdirectories for a test file
	 */
	async setupTestDirectory(testFilePath: string): Promise<TestDirectoryPaths> {
		const folderDir = path.dirname(testFilePath);
		const fileNameWithoutExt = path.basename(
			testFilePath,
			path.extname(testFilePath),
		);
		const testExt = path.extname(testFilePath);
		const componentName = this.getTestComponentName(testFilePath);

		// Create temporary file path in the same directory as the test
		const tempPath = path.join(
			folderDir,
			`${fileNameWithoutExt}.temp${testExt}`,
		);

		// Get the .unshallow directory path
		const unshallowDir = this.getUnshallowDirPath(testFilePath);

		// Get the component-specific test directory
		const testDir = path.join(unshallowDir, componentName);

		// Create paths for logs and attempt file
		const logsPath = path.join(testDir, 'logs.txt');
		const attemptPath = path.join(
			testDir,
			`${fileNameWithoutExt}.attempt${testExt}`,
		);

		// Ensure the directories exist
		await fs.mkdir(unshallowDir, {recursive: true});
		await fs.mkdir(testDir, {recursive: true});

		return {
			unshallowDir,
			testDir,
			logsPath,
			tempPath,
			attemptPath,
		};
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
