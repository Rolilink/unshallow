/**
 * Handlers for configuration commands
 */
import { ConfigManager } from '../config/config-manager.js';

/**
 * Handles the set-api-key command
 */
export function handleSetApiKeyCommand(apiKey: string) {
  try {
    const configManager = new ConfigManager();
    configManager.setOpenAIKey(apiKey);
    console.log('OpenAI API key set successfully.');
    return 0;
  } catch (error) {
    console.error('Failed to set OpenAI API key:', error);
    return 1;
  }
}

/**
 * Handles the get-api-key command
 */
export function handleGetApiKeyCommand() {
  try {
    const configManager = new ConfigManager();
    const apiKey = configManager.getOpenAIKey();

    if (apiKey) {
      // Only show first few and last few characters for security
      const maskedKey = maskApiKey(apiKey);
      console.log(`Current OpenAI API key: ${maskedKey}`);
    } else {
      console.log('No OpenAI API key configured.');
      console.log('Set one with: unshallow config set-api-key YOUR_API_KEY');
    }

    return 0;
  } catch (error) {
    console.error('Failed to get OpenAI API key:', error);
    return 1;
  }
}

/**
 * Helper to mask most of the API key for display
 */
function maskApiKey(apiKey: string): string {
  if (apiKey.length < 8) return '****';
  return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
}
