import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import {logger} from './logging-callback.js';

/**
 * Log entry type
 */
export type LogType = 'info' | 'error' | 'success';

/**
 * Handles operations on specific files within test directories
 */
export class ArtifactFileSystem {
	/**
	 * Ensures a directory exists, creating it if needed
	 * @param directoryPath Path to the directory
	 */
	private async ensureDirectoryExists(directoryPath: string): Promise<void> {
		try {
			if (!fsSync.existsSync(directoryPath)) {
				await fs.mkdir(directoryPath, {recursive: true});
				logger.info('artifacts', `Created directory: ${directoryPath}`);
			}
		} catch (error) {
			logger.error(
				'artifacts',
				`Error creating directory ${directoryPath}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw error;
		}
	}

	/**
	 * Ensures a file exists, creating it with default content if needed
	 * @param filePath Path to the file
	 * @param defaultContent Default content if the file needs to be created
	 */
	private async ensureFileExists(
		filePath: string,
		defaultContent: string = '',
	): Promise<void> {
		try {
			// Make sure the directory exists first
			const directoryPath = path.dirname(filePath);
			await this.ensureDirectoryExists(directoryPath);

			// Create the file if it doesn't exist
			if (!fsSync.existsSync(filePath)) {
				await fs.writeFile(filePath, defaultContent, 'utf8');
			}
		} catch (error) {
			logger.error(
				'artifacts',
				`Error ensuring file exists ${filePath}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw error;
		}
	}

	/**
	 * Writes content to a file, creating directories if needed
	 */
	private async writeFile(filePath: string, content: string): Promise<void> {
		try {
			const directoryPath = path.dirname(filePath);
			await this.ensureDirectoryExists(directoryPath);
			await fs.writeFile(filePath, content, 'utf8');
		} catch (error) {
			logger.error(
				'artifacts',
				`Error writing file ${filePath}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw error;
		}
	}

	/**
	 * Checks if a file exists
	 */
	private fileExists(filePath: string): boolean {
		return fsSync.existsSync(filePath);
	}

	/**
	 * Checks if a temporary file exists for the given test file
	 * @param testFilePath The original test file path
	 * @returns boolean indicating if the temp file exists
	 */
	public checkTempFileExists(testFilePath: string): boolean {
		const tempFilePath = this.createTempFilePath(testFilePath);
		return fsSync.existsSync(tempFilePath);
	}

	/**
	 * Checks if a plan file exists for the given test file
	 * @param testFilePath The original test file path
	 * @returns boolean indicating if the plan file exists
	 */
	public checkPlanFileExists(testFilePath: string): boolean {
		const testDir = this.getTestDirectory(testFilePath);
		const planFilePath = path.join(testDir, 'plan.txt');

		return fsSync.existsSync(planFilePath);
	}

	/**
	 * Reads the content of a temporary file for the given test file
	 * @param testFilePath The original test file path
	 * @returns The content of the temp file
	 */
	public async readTempFile(testFilePath: string): Promise<string> {
		const tempFilePath = this.createTempFilePath(testFilePath);

		try {
			if (!fsSync.existsSync(tempFilePath)) {
				throw new Error(`Temp file does not exist for test: ${testFilePath}`);
			}
			return await fs.readFile(tempFilePath, 'utf8');
		} catch (error) {
			logger.error(
				'artifacts',
				`Error reading temp file for ${testFilePath}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw error;
		}
	}

	/**
	 * Reads the content of a plan file for the given test file
	 * @param testFilePath The original test file path
	 * @returns The content of the plan file
	 */
	public async readPlanFile(testFilePath: string): Promise<string> {
		const testDir = this.getTestDirectory(testFilePath);
		const planFilePath = path.join(testDir, 'plan.txt');

		try {
			if (!fsSync.existsSync(planFilePath)) {
				throw new Error(`Plan file does not exist for test: ${testFilePath}`);
			}
			return await fs.readFile(planFilePath, 'utf8');
		} catch (error) {
			logger.error(
				'artifacts',
				`Error reading plan file for ${testFilePath}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw error;
		}
	}

	/**
	 * Gets the path to the test directory for a component
	 * @param testFilePath The original test file path
	 * @returns The path to the component's test directory
	 */
	public getTestDirectory(testFilePath: string): string {
		const folderDir = path.dirname(testFilePath);
		const fileNameWithoutExt = path.basename(
			testFilePath,
			path.extname(testFilePath),
		);
		const componentName = fileNameWithoutExt.replace(/\.(test|spec)$/, '');
		return path.join(folderDir, '.unshallow', componentName);
	}

	/**
	 * Initializes the logs file, clearing any previous content
	 */
	async initializeLogsFile(testDir: string): Promise<string> {
		const logsPath = path.join(testDir, 'logs.txt');
		const timestamp = new Date().toISOString();

		// Ensure the test directory exists and create logs file
		await this.writeFile(
			logsPath,
			`--- Migration started at ${timestamp} ---\n\n`,
		);

		return logsPath;
	}

	/**
	 * Appends a log message to the logs file
	 */
	async appendToLogsFile(
		logsPath: string,
		message: string,
		type: LogType = 'info',
	): Promise<void> {
		try {
			// Format message if type is provided (for appendLog method)
			let formattedMessage = message;

			if (arguments.length >= 3) {
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

				formattedMessage = `${timestamp} ${prefix} ${message}`;
			}

			// Ensure the message ends with a newline
			if (!formattedMessage.endsWith('\n')) {
				formattedMessage += '\n';
			}

			// Make sure the file exists first
			await this.ensureFileExists(logsPath);
			await fs.appendFile(logsPath, formattedMessage);
		} catch (error) {
			logger.error(
				'artifacts',
				`Error appending to logs file: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	/**
	 * Saves the Gherkin plan to a plan.txt file
	 */
	async savePlanFile(testDir: string, plan: string): Promise<string> {
		try {
			// Create plan file in the test directory
			const planPath = path.join(testDir, 'plan.txt');
			await this.writeFile(planPath, plan);

			// Verify file was created
			if (this.fileExists(planPath)) {
				logger.info('artifacts', `Successfully saved plan to: ${planPath}`);
			} else {
				logger.error('artifacts', `Plan file not created at: ${planPath}`);
			}

			return planPath;
		} catch (error) {
			logger.error(
				'artifacts',
				`Error saving plan file: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw error;
		}
	}

	/**
	 * Saves the test attempt file for failed migrations
	 */
	async saveAttemptFile(
		testDir: string,
		originalTestPath: string,
		content: string,
	): Promise<string> {
		try {
			const fileNameWithoutExt = path.basename(
				originalTestPath,
				path.extname(originalTestPath),
			);
			const testExt = path.extname(originalTestPath);

			const attemptPath = path.join(
				testDir,
				`${fileNameWithoutExt}.attempt${testExt}`,
			);

			await this.writeFile(attemptPath, content);
			return attemptPath;
		} catch (error) {
			logger.error(
				'artifacts',
				`Error saving attempt file: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw error;
		}
	}

	/**
	 * Creates a path for a temporary file
	 */
	createTempFilePath(originalTestPath: string): string {
		const folderDir = path.dirname(originalTestPath);
		const fileExt = path.extname(originalTestPath);
		const fileName = path.basename(originalTestPath, fileExt);
		
		// Extract the test type (test or spec) from the filename
		const match = fileName.match(/\.(test|spec)$/);
		const testType = match ? match[1] : null;
		
		// Create the correct temp file pattern: fileName.temp.test.tsx
		let tempFileName;
		if (testType) {
			// Remove the .test or .spec suffix and create fileName.temp.test.tsx format
			const baseFileName = fileName.replace(/\.(test|spec)$/, '');
			tempFileName = `${baseFileName}.temp.${testType}${fileExt}`;
		} else {
			// Fallback for files without test/spec pattern
			tempFileName = `${fileName}.temp${fileExt}`;
		}

		console.log(
			'Creating temp file path:',
			path.resolve(path.join(folderDir, tempFileName)),
		);

		return path.resolve(path.join(folderDir, tempFileName));
	}

	/**
	 * Writes content to a temporary file, creating it if it doesn't exist
	 * @param originalFilePath The original file path
	 * @param content The content to write
	 * @param tempFilePath Optional custom temp file path (will create one if not provided)
	 * @returns The path to the temp file
	 */
	async writeToTempFile(
		originalFilePath: string,
		content: string,
		tempFilePath?: string,
	): Promise<string> {
		const tempPath = tempFilePath || this.createTempFilePath(originalFilePath);

		try {
			await this.writeFile(tempPath, content);
			logger.info('artifacts', `Updated temp file at ${tempPath}`);
			return tempPath;
		} catch (error) {
			logger.error(
				'artifacts',
				`Error writing to temp file ${tempPath}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw error;
		}
	}

	/**
	 * Cleans up a temporary file
	 */
	async cleanupTempFile(tempPath: string): Promise<void> {
		try {
			if (fsSync.existsSync(tempPath)) {
				await fs.unlink(tempPath);
			}
		} catch (error) {
			logger.error(
				'artifacts',
				`Error cleaning up temporary file: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	/**
	 * Finalizes a successful migration
	 */
	async finalizeMigration(
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
			await this.cleanupTempFile(tempPath);

			// Log completion
			logger.info(
				'artifacts',
				`Successfully migrated ${originalFilePath} (temp file: ${tempPath}, test dir: ${testDir})`,
			);
		} catch (error) {
			logger.error(
				'artifacts',
				`Error finalizing migration: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	/**
	 * Saves a meta report for failed migrations
	 * @param report The content of the meta report
	 * @param customPath Optional custom path for the report (defaults to migration-meta-report.md in cwd)
	 * @returns The path to the saved report
	 */
	async saveMetaReport(report: string, customPath?: string): Promise<string> {
		try {
			const reportPath =
				customPath || path.join(process.cwd(), 'migration-meta-report.md');
			await this.writeFile(reportPath, report);
			logger.info('artifacts', `Meta report saved to: ${reportPath}`);
			return reportPath;
		} catch (error) {
			logger.error(
				'artifacts',
				`Error saving meta report: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw error;
		}
	}
}
