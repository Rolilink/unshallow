import * as fs from 'fs/promises';
import {ConfigFileSystem} from '../langgraph-workflow/utils/config-filesystem.js';

/**
 * Interface for Langfuse configuration (local definition)
 */
export interface LangfuseConfig {
  secretKey: string;
  publicKey: string;
	baseUrl?: string;
	host?: string;
	enabled?: boolean;
}

/**
 * Manages configuration for the unshallow CLI tool
 */
export class ConfigManager {
	private configFileSystem: ConfigFileSystem;

  constructor() {
		this.configFileSystem = new ConfigFileSystem();
  }

  /**
	 * Gets the OpenAI API key
   */
	async getOpenAIKey(): Promise<string | null> {
		return this.configFileSystem.getOpenAIApiKey();
    }

	/**
	 * Sets the OpenAI API key
	 */
	async setOpenAIKey(key: string): Promise<void> {
		await this.configFileSystem.setOpenAIApiKey(key);
  }

  /**
	 * Gets the Langfuse configuration
	 */
	async getLangfuseConfig(): Promise<LangfuseConfig | null> {
		const config = await this.configFileSystem.getLangfuseConfig();
		if (!config) return null;

		// Convert from ConfigFileSystem's LangfuseConfig to our LangfuseConfig
		return {
			secretKey: config.secretKey,
			publicKey: config.publicKey,
			baseUrl: config.host,
			host: config.host,
			enabled: true,
		};
  }

  /**
	 * Sets the Langfuse configuration
   */
	async setLangfuseConfig(config: LangfuseConfig): Promise<void> {
		// Convert from our LangfuseConfig to ConfigFileSystem's LangfuseConfig
		await this.configFileSystem.setLangfuseConfig({
            secretKey: config.secretKey,
            publicKey: config.publicKey,
			host: config.baseUrl || config.host,
		});
	}

	/**
	 * Gets the default context file path
	 */
	getDefaultContextFilePath(): string {
		return this.configFileSystem.getContextFilePath();
  }

  /**
	 * Gets the content of the context file
	 */
	async getDefaultContext(): Promise<string> {
		return this.configFileSystem.getContextFile();
	}

	/**
	 * Initializes the context file if it doesn't exist
	 */
	async initializeContextFile(): Promise<void> {
		await this.configFileSystem.initializeContextFile();
      }

	/**
	 * Check if the default context file exists
	 */
	async hasDefaultContextFile(): Promise<boolean> {
		try {
			await fs.access(this.getDefaultContextFilePath());
			return true;
    } catch (error) {
			return false;
		}
	}

	/**
	 * Check if OpenAI API key is configured
	 */
	async hasOpenAIKey(): Promise<boolean> {
		const key = await this.getOpenAIKey();
		return Boolean(key);
  }

  /**
   * Check if Langfuse is configured
   */
	async hasLangfuseConfig(): Promise<boolean> {
		const config = await this.getLangfuseConfig();
		return config !== null;
  }

  /**
   * Enable or disable Langfuse logging
   */
	async setLangfuseEnabled(enabled: boolean): Promise<void> {
		const config = await this.getLangfuseConfig();
    if (config) {
      config.enabled = enabled;
			await this.setLangfuseConfig(config);
    }
  }
}
