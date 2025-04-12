/**
 * Handlers for configuration commands
 */
import {ConfigManager} from '../config/config-manager.js';

/**
 * Handles the config:set-api-key command
 */
export async function handleSetApiKeyCommand(apiKey: string): Promise<void> {
    const configManager = new ConfigManager();
	await configManager.setOpenAIKey(apiKey);

	// Mask api key for display
	const currentApiKey = await configManager.getOpenAIKey();
	if (currentApiKey) {
		const maskedKey = maskApiKey(currentApiKey);
		console.log(`API key set successfully: ${maskedKey}`);
	} else {
		console.log('API key set successfully');
  }
}

/**
 * Handles the config:get-api-key command
 */
export async function handleGetApiKeyCommand(): Promise<void> {
    const configManager = new ConfigManager();
	const apiKey = await configManager.getOpenAIKey();

	if (!apiKey) {
		console.log('No API key set');
		return;
	}

	// Mask api key for display
      const maskedKey = maskApiKey(apiKey);
	console.log(`Current API key: ${maskedKey}`);
}

/**
 * Helper to mask most of the API key for display
 */
function maskApiKey(apiKey: string): string {
  if (apiKey.length < 8) return '****';
  return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
}
