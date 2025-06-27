/**
 * Handler for the set-langfuse-config command
 */
import {ConfigManager} from '../config/config-manager.js';

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
): Promise<number> {
  try {
		// Parse the config JSON
		const config = JSON.parse(configJson);

		// Validate required fields
		if (!config.publicKey || !config.secretKey) {
			console.error(
				'Error: Langfuse configuration must include publicKey and secretKey',
			);
        return 1;
      }

		// Set the config
		const configManager = new ConfigManager();
		await configManager.setLangfuseConfig({
			publicKey: config.publicKey,
			secretKey: config.secretKey,
			baseUrl: config.host || config.baseUrl || 'https://cloud.langfuse.com',
			enabled: true,
		});

		console.log('Langfuse configuration set successfully');
    return 0;
  } catch (error) {
		console.error('Error setting Langfuse configuration:', error);
    return 1;
  }
}
