import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Configuration for Langfuse tracing
 */
export interface LangfuseConfig {
	publicKey: string;
	secretKey: string;
	host?: string;
}

/**
 * Handles operations on the user's ~/.unshallow config directory
 */
export class ConfigFileSystem {
	private configDir: string;
	private configPath: string;
	private langfuseConfigPath: string;
	private contextFilePath: string;

	constructor() {
		this.configDir = path.join(os.homedir(), '.unshallow');
		this.configPath = path.join(this.configDir, 'config.json');
		this.langfuseConfigPath = path.join(this.configDir, 'langfuse.json');
		this.contextFilePath = path.join(this.configDir, 'context.md');
	}

	/**
	 * Gets the path to the user's config directory
	 */
	getConfigDirectory(): string {
		return this.configDir;
	}

	/**
	 * Ensures the config directory exists
	 */
	async ensureConfigDirectoryExists(): Promise<void> {
		if (!fsSync.existsSync(this.configDir)) {
			await fs.mkdir(this.configDir, {recursive: true});
		}
	}

	/**
	 * Gets the OpenAI API key from the config file
	 */
	async getOpenAIApiKey(): Promise<string | null> {
		const config = await this.readConfigFile<Record<string, any>>(
			this.configPath,
			{},
		);
		return config['openaiApiKey'] || null;
	}

	/**
	 * Sets the OpenAI API key in the config file
	 */
	async setOpenAIApiKey(apiKey: string): Promise<void> {
		const config = await this.readConfigFile<Record<string, any>>(
			this.configPath,
			{},
		);
		config['openaiApiKey'] = apiKey;
		await this.writeConfigFile(this.configPath, config);
	}

	/**
	 * Gets the Langfuse configuration
	 */
	async getLangfuseConfig(): Promise<LangfuseConfig | null> {
		if (!fsSync.existsSync(this.langfuseConfigPath)) {
			return null;
		}

		return this.readConfigFile<LangfuseConfig>(this.langfuseConfigPath, {
			publicKey: '',
			secretKey: '',
			host: '',
		} as LangfuseConfig);
	}

	/**
	 * Sets the Langfuse configuration
	 */
	async setLangfuseConfig(config: LangfuseConfig): Promise<void> {
		await this.ensureConfigDirectoryExists();
		await this.writeConfigFile(this.langfuseConfigPath, config);
	}

	/**
	 * Gets the path to the context file
	 */
	getContextFilePath(): string {
		return this.contextFilePath;
	}

	/**
	 * Gets the content of the context file, initializing it if needed
	 */
	async getContextFile(): Promise<string> {
		await this.initializeContextFile();

		try {
			return await fs.readFile(this.contextFilePath, 'utf8');
		} catch (error) {
			console.error(
				`Error reading context file: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			return '';
		}
	}

	/**
	 * Creates the default context file if it doesn't exist
	 */
	async initializeContextFile(): Promise<void> {
		await this.ensureConfigDirectoryExists();

		if (!fsSync.existsSync(this.contextFilePath)) {
			const templateContent = ``;
			await fs.writeFile(this.contextFilePath, templateContent, 'utf8');
		}
	}

	/**
	 * Updates the context file with new content
	 */
	async updateContextFile(content: string): Promise<void> {
		await this.ensureConfigDirectoryExists();
		await fs.writeFile(this.contextFilePath, content, 'utf8');
	}

	/**
	 * Writes data to a config file
	 */
	private async writeConfigFile<T>(filePath: string, data: T): Promise<void> {
		try {
			await this.ensureConfigDirectoryExists();
			await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
		} catch (error) {
			console.error(
				`Error writing config file ${filePath}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw error;
		}
	}

	/**
	 * Reads a config file, returning defaultValue if it doesn't exist
	 */
	private async readConfigFile<T>(
		filePath: string,
		defaultValue: T,
	): Promise<T> {
		try {
			await this.ensureConfigDirectoryExists();

			if (!fsSync.existsSync(filePath)) {
				return defaultValue;
			}

			const content = await fs.readFile(filePath, 'utf8');
			return JSON.parse(content) as T;
		} catch (error) {
			console.error(
				`Error reading config file ${filePath}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			return defaultValue;
		}
	}

	/**
	 * Ensures a directory exists, creating it if needed
	 * @param directoryPath Path to the directory
	 */
	async ensureDirectoryExists(directoryPath: string): Promise<void> {
		try {
			if (!fsSync.existsSync(directoryPath)) {
				await fs.mkdir(directoryPath, { recursive: true });
				console.log(`Created directory: ${directoryPath}`);
			}
		} catch (error) {
			console.error(`Error creating directory ${directoryPath}: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	/**
	 * Ensures a file exists, creating it with default content if needed
	 * @param filePath Path to the file
	 * @param defaultContent Default content if the file needs to be created
	 */
	async ensureFileExists(filePath: string, defaultContent: string = ''): Promise<void> {
		try {
			// Make sure the directory exists first
			const directoryPath = path.dirname(filePath);
			await this.ensureDirectoryExists(directoryPath);

			// Create the file if it doesn't exist
			if (!fsSync.existsSync(filePath)) {
				await fs.writeFile(filePath, defaultContent, 'utf8');
			}
		} catch (error) {
			console.error(`Error ensuring file exists ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	/**
	 * Appends content to a file
	 * @param filePath Path to the file
	 * @param content Content to append
	 */
	async appendToFile(filePath: string, content: string): Promise<void> {
		try {
			// Ensure the file exists first
			await this.ensureFileExists(filePath);

			// Append to the file
			await fs.appendFile(filePath, content, 'utf8');
		} catch (error) {
			console.error(`Error appending to file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}
}
