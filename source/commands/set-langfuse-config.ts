/**
 * Handler for the set-langfuse-config command
 */
import { ConfigManager, LangfuseConfig } from '../config/config-manager.js';

// Type definition for command options
export interface SetLangfuseConfigOptions {
  disable?: boolean;
  enable?: boolean;
}

/**
 * Handles the set-langfuse-config command
 */
export async function handleSetLangfuseConfigCommand(
  configJson: string,
  options: SetLangfuseConfigOptions
): Promise<number> {
  try {
    const configManager = new ConfigManager();

    // Handle enable/disable flags
    if (options.disable || options.enable) {
      if (!configManager.hasLangfuseConfig()) {
        console.error('Langfuse is not configured yet. Please provide a configuration first.');
        console.error('Example: unshallow set-langfuse-config \'{"secretKey":"your-key","publicKey":"your-key","baseUrl":"http://your-url"}\'');
        return 1;
      }

      configManager.setLangfuseEnabled(!!options.enable);
      console.log(`Langfuse logging has been ${options.enable ? 'enabled' : 'disabled'}.`);
      return 0;
    }

    // Parse the provided JSON configuration
    let langfuseConfig: LangfuseConfig;
    try {
      const parsedConfig = JSON.parse(configJson);
      langfuseConfig = {
        secretKey: parsedConfig.secretKey,
        publicKey: parsedConfig.publicKey,
        baseUrl: parsedConfig.baseUrl || 'https://cloud.langfuse.com',
        enabled: parsedConfig.enabled !== false
      };

      // Validate the configuration
      if (!langfuseConfig.secretKey || !langfuseConfig.publicKey) {
        throw new Error('Missing required fields');
      }
    } catch (error) {
      console.error('Invalid Langfuse configuration JSON. Please provide a valid JSON object.');
      console.error('Example: unshallow set-langfuse-config \'{"secretKey":"your-key","publicKey":"your-key","baseUrl":"http://your-url"}\'');
      console.error('Error:', error instanceof Error ? error.message : String(error));
      return 1;
    }

    // Save the configuration
    configManager.setLangfuseConfig(langfuseConfig);
    console.log('Langfuse configuration set successfully.');
    console.log(`Logging is now ${langfuseConfig.enabled ? 'enabled' : 'disabled'}.`);
    console.log(`Base URL: ${langfuseConfig.baseUrl}`);

    return 0;
  } catch (error) {
    console.error('Failed to set Langfuse configuration:', error);
    return 1;
  }
}
