import {CallbackHandler} from 'langfuse-langchain';
import {ConfigManager} from './config/config-manager.js';
import {logger} from './langgraph-workflow/utils/logging-callback.js';

// Track initialization state - keep these private
let langfuseCallbackHandler: any = null;
let initializationPromise: Promise<any> | null = null;

/**
 * Get the Langfuse callback handler, initializing it if needed
 * This function should be used instead of directly accessing the handler
 */
export async function getLangfuseCallbackHandler(): Promise<any> {
	return ensureLangfuseInitialized();
}

/**
 * Initialize the Langfuse handler if needed
 * This function can be awaited to ensure handler is initialized before use
 */
export async function ensureLangfuseInitialized(): Promise<any> {
	// If already initialized, return the handler
	if (langfuseCallbackHandler !== null) {
		return langfuseCallbackHandler;
	}

	// If initialization is in progress, wait for it
	if (initializationPromise !== null) {
		return initializationPromise;
	}

	// Start initialization
	initializationPromise = initializeLangfuseHandler();

	try {
		// Wait for initialization and store the result
		langfuseCallbackHandler = await initializationPromise;
		return langfuseCallbackHandler;
	} catch (error) {
		// Log error but don't throw to prevent breaking program flow
		logger.error('langfuse', 'Failed to initialize Langfuse:', error);
		return null;
	}
}

/**
 * Create and initialize the Langfuse handler
 * @private
 */
async function initializeLangfuseHandler() {
	try {
		const configManager = new ConfigManager();
		const langfuseConfig = await configManager.getLangfuseConfig();

		// Skip setup if Langfuse is not configured or disabled
		if (!langfuseConfig || !langfuseConfig.enabled) {
			logger.info('langfuse', 'Langfuse tracing disabled');
			return null;
		}

		logger.info('langfuse', 'Initializing Langfuse tracing...');

		// Create a handler with the config
		const handler = new CallbackHandler({
			secretKey: langfuseConfig.secretKey,
			publicKey: langfuseConfig.publicKey,
			baseUrl: langfuseConfig.baseUrl || 'https://cloud.langfuse.com',
		});

		logger.info('langfuse', 'Langfuse tracing initialized');
		return handler;
	} catch (error) {
		logger.error('langfuse', 'Error initializing Langfuse:', error);
		return null;
	}
}
