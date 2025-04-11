import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Interface for Langfuse configuration
 */
export interface LangfuseConfig {
  secretKey: string;
  publicKey: string;
  baseUrl: string;
  enabled: boolean;
}

/**
 * Manages configuration for the unshallow CLI tool
 */
export class ConfigManager {
  private configDir: string;
  private configPath: string;
  private langfuseConfigPath: string;
  private config: Record<string, any>;

  constructor() {
    this.configDir = path.join(os.homedir(), '.unshallow');
    this.configPath = path.join(this.configDir, 'config.json');
    this.langfuseConfigPath = path.join(this.configDir, 'langfuse.json');
    this.config = this.loadConfig();
  }

  /**
   * Get the OpenAI API key
   */
  getOpenAIKey(): string | undefined {
    // Check if key exists in config
    if (this.config['openaiApiKey']) {
      return this.config['openaiApiKey'];
    }

    // Check environment variable as fallback
    if (process.env['OPENAI_API_KEY']) {
      return process.env['OPENAI_API_KEY'];
    }

    return undefined;
  }

  /**
   * Get the default context file path
   */
  getDefaultContextFilePath(): string {
    return path.join(this.configDir, 'context.md');
  }

  /**
   * Check if the default context file exists
   */
  hasDefaultContextFile(): boolean {
    return fs.existsSync(this.getDefaultContextFilePath());
  }

  /**
   * Set the OpenAI API key
   */
  setOpenAIKey(apiKey: string): void {
    this.config['openaiApiKey'] = apiKey;
    this.saveConfig();
  }

  /**
   * Check if OpenAI API key is configured
   */
  hasOpenAIKey(): boolean {
    return Boolean(this.getOpenAIKey());
  }

  /**
   * Get Langfuse configuration
   */
  getLangfuseConfig(): LangfuseConfig | null {
    try {
      if (fs.existsSync(this.langfuseConfigPath)) {
        const configContent = fs.readFileSync(this.langfuseConfigPath, 'utf8');
        const config = JSON.parse(configContent);

        // Ensure the config has all required fields
        if (config.secretKey && config.publicKey && config.baseUrl) {
          return {
            secretKey: config.secretKey,
            publicKey: config.publicKey,
            baseUrl: config.baseUrl,
            enabled: config.enabled !== false // default to true if not specified
          };
        }
      }
    } catch (error) {
      console.error('Error loading Langfuse config:', error);
    }

    return null;
  }

  /**
   * Set Langfuse configuration
   */
  setLangfuseConfig(config: LangfuseConfig): void {
    try {
      // Ensure config directory exists
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }

      // Write config to file
      fs.writeFileSync(this.langfuseConfigPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Error saving Langfuse config:', error);
    }
  }

  /**
   * Check if Langfuse is configured
   */
  hasLangfuseConfig(): boolean {
    return this.getLangfuseConfig() !== null;
  }

  /**
   * Enable or disable Langfuse logging
   */
  setLangfuseEnabled(enabled: boolean): void {
    const config = this.getLangfuseConfig();
    if (config) {
      config.enabled = enabled;
      this.setLangfuseConfig(config);
    }
  }

  /**
   * Load configuration from disk
   */
  private loadConfig(): Record<string, any> {
    try {
      // Ensure config directory exists
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }

      // Load config if it exists
      if (fs.existsSync(this.configPath)) {
        const configContent = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(configContent);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }

    // Return empty config if file doesn't exist or error occurs
    return {};
  }

  /**
   * Save configuration to disk
   */
  private saveConfig(): void {
    try {
      // Ensure config directory exists
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }

      // Write config to file
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }
}
