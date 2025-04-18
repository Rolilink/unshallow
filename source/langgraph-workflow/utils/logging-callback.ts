import {ArtifactFileSystem} from './artifact-filesystem.js';

/**
 * Enhanced logger that writes to both console and the logs.txt file in the .unshallow directory
 * Implements detailed logging for each workflow node
 */
export class Logger {
	private logsPath: string | null = null;
	private attemptCounter: Map<string, number> = new Map();
	private artifactFileSystem: ArtifactFileSystem;
	private silent: boolean = false;

	constructor() {
		this.artifactFileSystem = new ArtifactFileSystem();
	}

	/**
	 * Set the logs file path
	 * @param logsPath Path to the logs file
	 */
	setLogsPath(logsPath: string): void {
		this.logsPath = logsPath;
	}

	/**
	 * Enable or disable console output
	 * @param silent Whether to suppress console output
	 */
	setSilent(silent: boolean): void {
		this.silent = silent;
	}

	/**
	 * Get the current attempt count for a specific operation type
	 * @param operationType The type of operation (test, ts, lint, etc.)
	 * @returns The current attempt number
	 */
	getAttemptCount(operationType: string): number {
		const count = this.attemptCounter.get(operationType) || 0;
		return count;
	}

	/**
	 * Set the attempt counter for a specific operation type
	 * @param operationType The type of operation (test, ts, lint, etc.)
	 * @param count The count to set
	 */
	setAttemptCount(operationType: string, count: number): void {
		this.attemptCounter.set(operationType, count);
	}

	/**
	 * Increment the attempt counter for a specific operation type
	 * @param operationType The type of operation (test, ts, lint, etc.)
	 * @returns The new attempt number
	 */
	incrementAttemptCount(operationType: string): number {
		const currentCount = this.getAttemptCount(operationType);
		const newCount = currentCount + 1;
		this.attemptCounter.set(operationType, newCount);
		return newCount;
	}

	/**
	 * Log progress information - always displays even in silent mode
	 * Used to show the current file state and retry counts during processing
	 * @param filePath The path of the file being processed
	 * @param state The current state (migrating, testing, fixing, etc.)
	 * @param retries Current retry information for the different stages
	 */
	async progress(filePath: string, state: string, retries?: { rtl: number; test: number; ts: number; lint: number }): Promise<void> {
		// Get just the filename for display
		const fileName = filePath.split('/').pop() || filePath;

		// Format retry counts if provided
		let retryInfo = '';
		if (retries) {
			const totalRetries = retries.rtl + retries.test + retries.ts + retries.lint;
			retryInfo = ` [Retries: ${totalRetries} | RTL: ${retries.rtl}, Test: ${retries.test}, TS: ${retries.ts}, Lint: ${retries.lint}]`;
		}

		// Format attempt info if applicable
		let attemptInfo = '';
		if (state.includes('fixing') && state.includes(':')) {
			const parts = state.split(':');
			if (parts.length > 0 && parts[0]) {
				const stageType = parts[0].trim(); // e.g., "RTL fixing"
				const operationType = stageType.toLowerCase().replace(' ', '_'); // Convert to operation type
				const attemptNum = this.getAttemptCount(operationType);
				attemptInfo = ` (Attempt #${attemptNum})`;
				state = `${stageType}${attemptInfo}: ${parts[1] || ''}`;
			}
		}

		// Create progress message - always shown regardless of silent mode
		const message = `[Progress] ${fileName} - ${state}${retryInfo}`;

		// Always log to console regardless of silent setting - use process.stdout directly
		// to bypass the console.log silent setting
		process.stdout.write(`${message}\n`);

		// Also log to file if available
		if (this.logsPath) {
			try {
				await this.artifactFileSystem.appendToLogsFile(
					this.logsPath,
					`${new Date().toISOString()} ${message}\n`
				);
			} catch (error) {
				// Silent error handling for log file errors
			}
		}
	}

	/**
	 * Write a message to both console and log file
	 * @param message The message to log
	 */
	private async write(message: string): Promise<void> {
		// Print to console if not in silent mode
		if (!this.silent) {
			console.log(message);
		}

		// Write to logs file if available
		if (this.logsPath) {
			try {
				// Use ArtifactFileSystem to append to log
				await this.artifactFileSystem.appendToLogsFile(this.logsPath, message);
			} catch (error) {
				if (!this.silent) {
					console.error(
						`Error writing to log file: ${
							error instanceof Error ? error.message : String(error)
						}`,
					);
				}
			}
		}
	}

	/**
	 * Format a header for a log section
	 * @param nodeName The name of the node
	 * @param title The title for the section
	 * @returns Formatted header string
	 */
	private formatHeader(nodeName: string, title: string): string {
		const timestamp = new Date().toISOString();
		const separator = '='.repeat(80);
		return `\n${separator}\n[${timestamp}] [${nodeName}] ${title}\n${separator}`;
	}

	/**
	 * Format content for logging with a title
	 * @param title The title for the content
	 * @param content The content to log
	 * @returns Formatted content string
	 */
	private formatContent(
		title: string,
		content: string | null | undefined,
	): string {
		if (content === null || content === undefined || content === '') {
			return `${title}: <empty>`;
		}
		return `${title}:\n\n${content}\n`;
	}

	/**
	 * Log a basic info message
	 * @param nodeName The name of the node
	 * @param message The message to log
	 */
	async info(nodeName: string, message: string): Promise<void> {
		const timestamp = new Date().toISOString();
		const logLine = `[${timestamp}] [${nodeName}] ${message}`;
		await this.write(logLine);
	}

	/**
	 * Log an error message
	 * @param nodeName The name of the node
	 * @param message The error message
	 * @param error Optional error object
	 */
	async error(
		nodeName: string,
		message: string,
		error?: unknown,
	): Promise<void> {
		const timestamp = new Date().toISOString();
		const errorMessage =
			error instanceof Error ? error.message : String(error || '');
		const stackTrace =
			error instanceof Error && error.stack
				? `\nStack Trace:\n${error.stack}`
				: '';
		const logLine = `[${timestamp}] [${nodeName}] ERROR: ${message}${
			errorMessage ? ` - ${errorMessage}` : ''
		}${stackTrace}`;
		await this.write(logLine);
	}

	/**
	 * Log a success message
	 * @param nodeName The name of the node
	 * @param message The success message
	 */
	async success(nodeName: string, message: string): Promise<void> {
		const timestamp = new Date().toISOString();
		const logLine = `[${timestamp}] [${nodeName}] SUCCESS: ${message}`;
		await this.write(logLine);
	}

	/**
	 * Log the start of a node's execution
	 * @param nodeName The name of the node
	 * @param message Optional additional message
	 */
	async logNodeStart(nodeName: string, message?: string): Promise<void> {
		const header = this.formatHeader(nodeName, 'Starting execution');
		await this.write(header);
		if (message) {
			await this.info(nodeName, message);
		}
	}

	/**
	 * Log the completion of a node's execution
	 * @param nodeName The name of the node
	 * @param status The status of the completion
	 * @param message Optional additional message
	 */
	async logNodeComplete(
		nodeName: string,
		status: string,
		message?: string,
	): Promise<void> {
		const header = this.formatHeader(
			nodeName,
			`Completed with status: ${status}`,
		);
		await this.write(header);
		if (message) {
			await this.info(nodeName, message);
		}
	}

	/**
	 * Log the test file content
	 * @param nodeName The name of the node
	 * @param filePath The path to the test file
	 * @param content The content of the test file
	 */
	async logTestFile(
		nodeName: string,
		filePath: string,
		content: string,
	): Promise<void> {
		const header = this.formatHeader(nodeName, `Test file: ${filePath}`);
		await this.write(header);
		await this.write(this.formatContent('Test file content', content));
	}

	/**
	 * Log component details
	 * @param nodeName The name of the node
	 * @param componentName The name of the component
	 * @param componentCode The source code of the component
	 */
	async logComponent(
		nodeName: string,
		componentName: string,
		componentCode: string,
	): Promise<void> {
		const header = this.formatHeader(nodeName, `Component: ${componentName}`);
		await this.write(header);
		await this.write(
			this.formatContent('Component source code', componentCode),
		);
	}

	/**
	 * Log component imports
	 * @param nodeName The name of the node
	 * @param imports The imports to log
	 */
	async logImports(
		nodeName: string,
		imports: Record<string, string>,
	): Promise<void> {
		const header = this.formatHeader(nodeName, 'Component imports');
		await this.write(header);

		// Log each import separately
		for (const [importPath, importContent] of Object.entries(imports)) {
			await this.write(
				this.formatContent(`Import: ${importPath}`, importContent),
			);
		}
	}

	/**
	 * Log example tests
	 * @param nodeName The name of the node
	 * @param examples The example tests to log
	 */
	async logExamples(
		nodeName: string,
		examples: Record<string, string>,
	): Promise<void> {
		if (!examples || Object.keys(examples).length === 0) {
			return;
		}

		const header = this.formatHeader(nodeName, 'Example tests');
		await this.write(header);

		// Log each example separately
		for (const [examplePath, exampleContent] of Object.entries(examples)) {
			await this.write(
				this.formatContent(`Example: ${examplePath}`, exampleContent),
			);
		}
	}

	/**
	 * Log RTL conversion plan
	 * @param nodeName The name of the node
	 * @param plan The conversion plan
	 * @param explanation Optional explanation of the plan
	 */
	async logPlan(
		nodeName: string,
		plan: string,
		explanation?: string,
	): Promise<void> {
		const header = this.formatHeader(nodeName, 'RTL conversion plan');
		await this.write(header);
		await this.write(this.formatContent('Plan', plan));

		if (explanation) {
			await this.write(this.formatContent('Explanation', explanation));
		}
	}

	/**
	 * Log generated RTL test
	 * @param nodeName The name of the node
	 * @param rtlTest The generated RTL test
	 * @param explanation Optional explanation of the generation
	 */
	async logRtlTest(
		nodeName: string,
		rtlTest: string,
		explanation?: string,
	): Promise<void> {
		const header = this.formatHeader(nodeName, 'Generated RTL test');
		await this.write(header);
		await this.write(this.formatContent('RTL test content', rtlTest));

		if (explanation) {
			await this.write(this.formatContent('Explanation', explanation));
		}
	}

	/**
	 * Log command execution
	 * @param nodeName The name of the node
	 * @param command The command being executed
	 * @param stdout The standard output
	 * @param stderr The standard error
	 * @param exitCode The exit code
	 * @param attempt Optional attempt number
	 */
	async logCommand(
		nodeName: string,
		command: string,
		stdout: string,
		stderr: string,
		exitCode: number,
		attemptType?: string,
	): Promise<void> {
		const attemptInfo = attemptType
			? ` (Attempt #${this.getAttemptCount(attemptType)})`
			: '';

		const header = this.formatHeader(
			nodeName,
			`Command execution${attemptInfo}`,
		);
		await this.write(header);
		await this.write(`Command: ${command}`);
		await this.write(`Exit code: ${exitCode}`);
		await this.write(this.formatContent('Standard output', stdout));
		await this.write(this.formatContent('Standard error', stderr));

		if (exitCode === 0) {
			await this.success(nodeName, 'Command executed successfully');
		} else {
			await this.error(nodeName, `Command failed with exit code: ${exitCode}`);
		}
	}

	/**
	 * Log test errors
	 * @param nodeName The name of the node
	 * @param errors The errors to log
	 */
	async logErrors(
		nodeName: string,
		errors: any,
		title: string = 'Errors',
	): Promise<void> {
		const header = this.formatHeader(nodeName, title);
		await this.write(header);

		if (!errors || (Array.isArray(errors) && errors.length === 0)) {
			await this.write(`${title}: <none>`);
			return;
		}

		// Handle different error formats
		if (Array.isArray(errors)) {
			for (let i = 0; i < errors.length; i++) {
				await this.write(
					this.formatContent(
						`Error #${i + 1}`,
						JSON.stringify(errors[i], null, 2),
					),
				);
			}
		} else if (typeof errors === 'object') {
			await this.write(
				this.formatContent(title, JSON.stringify(errors, null, 2)),
			);
		} else {
			await this.write(this.formatContent(title, String(errors)));
		}
	}

	/**
	 * Log accessibility data
	 * @param nodeName The name of the node
	 * @param accessibilityDump The accessibility dump
	 * @param domTree The DOM tree
	 */
	async logAccessibilityData(
		nodeName: string,
		accessibilityDump: string,
		domTree: string,
	): Promise<void> {
		const header = this.formatHeader(nodeName, 'Accessibility data');
		await this.write(header);
		await this.write(
			this.formatContent('Accessibility dump', accessibilityDump),
		);
		await this.write(this.formatContent('DOM tree', domTree));
	}

	/**
	 * Log fix details
	 * @param nodeName The name of the node
	 * @param fixIntent The fix intent
	 * @param explanation The explanation of the fix
	 * @param updatedTest The updated test content
	 * @param attemptType The type of attempt (for attempt counting)
	 */
	async logFix(
		nodeName: string,
		fixIntent: string,
		explanation: string | undefined,
		updatedTest: string | undefined,
		attemptType: string,
	): Promise<void> {
		const attemptCount = this.getAttemptCount(attemptType);
		const header = this.formatHeader(
			nodeName,
			`Fix (Attempt #${attemptCount})`,
		);
		await this.write(header);
		await this.write(this.formatContent('Fix intent', fixIntent));

		if (explanation) {
			await this.write(this.formatContent('Explanation', explanation));
		}

		if (updatedTest) {
			await this.write(this.formatContent('Updated test content', updatedTest));
		}
	}
}

// Export a singleton instance of the logger
export const logger = new Logger();
