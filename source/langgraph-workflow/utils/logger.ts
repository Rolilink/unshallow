import * as path from 'path';
import * as os from 'os';
import {ConfigFileSystem} from './config-filesystem.js';

/**
 * Logger utility for LangGraph workflow
 * Logs LLM requests and responses to a file in the user's home directory
 */
export class Logger {
	private logFilePath: string;
	private logDir: string;
	private static instance: Logger;
	private configFileSystem: ConfigFileSystem;

	private constructor() {
		// Create timestamp for filename
		const timestamp = new Date()
			.toISOString()
			.replace(/:/g, '-')
			.replace(/\..+/, '');

		// Set log directory in user's home folder
		this.logDir = path.join(os.homedir(), '.unshallow-logs');

		// Create log filename with timestamp
		this.logFilePath = path.join(this.logDir, `migration-${timestamp}.log`);

		// Initialize configFileSystem
		this.configFileSystem = new ConfigFileSystem();

		// Initialize the log
		this.initialize();
	}

	/**
	 * Get the singleton instance of the logger
	 */
	public static getInstance(): Logger {
		if (!Logger.instance) {
			Logger.instance = new Logger();
		}
		return Logger.instance;
	}

	/**
	 * Initialize the log file and directory
	 */
	private async initialize(): Promise<void> {
		await this.ensureLogDirectoryExists();
		await this.appendToLog(
			`=== Unshallow Migration Log - Started at ${new Date().toISOString()} ===\n\n`,
		);
	}

	/**
	 * Ensure the log directory exists
	 */
	private async ensureLogDirectoryExists(): Promise<void> {
		await this.configFileSystem.ensureDirectoryExists(this.logDir);
		console.log(`Logs directory: ${this.logDir}`);
	}

	/**
	 * Append message to the log file
	 */
	private async appendToLog(message: string): Promise<void> {
		try {
			// Ensure directory exists
			await this.ensureLogDirectoryExists();

			// Initialize the file if it doesn't exist
			await this.configFileSystem.ensureFileExists(this.logFilePath, '');

			// Use the configFileSystem to append to the file
			await this.configFileSystem.appendToFile(this.logFilePath, message);
		} catch (error) {
			console.error(
				`Error writing to log: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	/**
	 * Log a node's execution
	 */
	public async logNodeExecution(
		nodeName: string,
		message: string,
	): Promise<void> {
		const logMessage = `[${new Date().toISOString()}] [${nodeName}] ${message}\n`;
		await this.appendToLog(logMessage);
	}

	/**
	 * Log an LLM request
	 */
	public async logLLMRequest(
		nodeName: string,
		prompt: string,
		model: string,
	): Promise<void> {
		const logMessage = [
			`\n=== LLM REQUEST - ${nodeName} - ${new Date().toISOString()} ===`,
			`Model: ${model}`,
			`Prompt:\n${prompt}`,
			'=== END REQUEST ===\n\n',
		].join('\n');

		await this.appendToLog(logMessage);
	}

	/**
	 * Log an LLM response
	 */
	public async logLLMResponse(
		nodeName: string,
		response: any,
		timeElapsed: number,
	): Promise<void> {
		const logMessage = [
			`\n=== LLM RESPONSE - ${nodeName} - ${new Date().toISOString()} ===`,
			`Time elapsed: ${timeElapsed}ms`,
			`Response:`,
			`${JSON.stringify(response, null, 2)}`,
			'=== END RESPONSE ===\n\n',
		].join('\n');

		await this.appendToLog(logMessage);
	}

	/**
	 * Log an error
	 */
	public async logError(
		nodeName: string,
		error: Error | string,
	): Promise<void> {
		const errorMessage =
			typeof error === 'string' ? error : `${error.message}\n${error.stack}`;
		const logMessage = [
			`\n!!! ERROR - ${nodeName} - ${new Date().toISOString()} !!!`,
			errorMessage,
			'!!! END ERROR !!!\n\n',
		].join('\n');

		await this.appendToLog(logMessage);
	}

	/**
	 * Get the current log file path
	 */
	public getLogFilePath(): string {
		return this.logFilePath;
	}
}
