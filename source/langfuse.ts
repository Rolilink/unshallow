import { CallbackHandler } from "langfuse-langchain";
import { ConfigManager } from "./config/config-manager.js";

// Create a function to get the Langfuse handler
function createLangfuseHandler() {
  const configManager = new ConfigManager();
  const langfuseConfig = configManager.getLangfuseConfig();

  // If Langfuse is not configured or disabled, return a no-op handler
  if (!langfuseConfig || !langfuseConfig.enabled) {
    console.log('Langfuse logging is disabled. Use "unshallow set-langfuse-config" to enable.');
    return {
      handleLLMStart: () => {},
      handleLLMEnd: () => {},
      handleChainStart: () => {},
      handleChainEnd: () => {},
      handleToolStart: () => {},
      handleToolEnd: () => {},
      // Add any other callback methods as no-ops
    };
  }

  // Use the configuration from the config file
  return new CallbackHandler({
    secretKey: langfuseConfig.secretKey,
    publicKey: langfuseConfig.publicKey,
    baseUrl: langfuseConfig.baseUrl,
  });
}

// Create the handler
const langfuseHandler = createLangfuseHandler();

export const langfuseCallbackHandler = langfuseHandler;
