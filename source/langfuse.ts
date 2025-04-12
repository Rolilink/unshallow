import {CallbackHandler} from 'langfuse-langchain';
import {ConfigManager} from './config/config-manager.js';

// Initialize handler as null initially
let langfuseCallbackHandler: any = null;

// Create and initialize the handler
async function initializeLangfuseHandler() {
	try {
  const configManager = new ConfigManager();
		const langfuseConfig = await configManager.getLangfuseConfig();

		// Skip setup if Langfuse is not configured or disabled
  if (!langfuseConfig || !langfuseConfig.enabled) {
			console.log('Langfuse tracing disabled');
			return null;
		}

		console.log('Initializing Langfuse tracing...');

		// Create a handler with the config
		const handler = new CallbackHandler({
    secretKey: langfuseConfig.secretKey,
    publicKey: langfuseConfig.publicKey,
			baseUrl: langfuseConfig.baseUrl || 'https://cloud.langfuse.com',
  });

		console.log('Langfuse tracing initialized');
		return handler;
	} catch (error) {
		console.error('Error initializing Langfuse:', error);
		return null;
	}
}

// Initialize the handler asynchronously
initializeLangfuseHandler().then(handler => {
	langfuseCallbackHandler = handler;
});

// Export the handler
export {langfuseCallbackHandler};
