import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { ChainValues } from '@langchain/core/utils/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Callback handler that logs LLM interactions to a file
 */
export class FileLoggingCallbackHandler extends BaseCallbackHandler {
  name = "file_logging_callback_handler";
  private logFilePath: string;
  private logDir: string;
  private startTimes: Map<string, number> = new Map();

  constructor() {
    super();

    // Create timestamp for filename
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');

    // Set log directory in user's home folder
    this.logDir = path.join(os.homedir(), '.unshallow-logs');

    // Create log filename with timestamp
    this.logFilePath = path.join(this.logDir, `migration-${timestamp}.log`);

    // Ensure the log directory exists
    this.ensureLogDirectoryExists();

    // Initialize log file with header
    this.appendToLog(`=== Unshallow Migration Log - Started at ${new Date().toISOString()} ===\n\n`);

    console.log(`Logging LLM interactions to: ${this.logFilePath}`);
  }

  /**
   * Ensure the log directory exists
   */
  private ensureLogDirectoryExists(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
      console.log(`Created log directory: ${this.logDir}`);
    }
  }

  /**
   * Append message to the log file
   */
  private appendToLog(message: string): void {
    try {
      fs.appendFileSync(this.logFilePath, message);
    } catch (error) {
      console.error(`Error writing to log: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Called when an LLM starts running
   * @param llm - The LLM instance
   * @param prompts - The prompts being sent to the LLM
   * @param runId - The unique run ID
   * @param parentRunId - The parent run ID (unused but required by interface)
   * @param extraParams - Extra parameters (unused but required by interface)
   * @param tags - Optional tags for categorizing the run
   */
  override async handleLLMStart(
    llm: any,
    prompts: string[],
    runId: string,
    _parentRunId?: string,
    _extraParams?: Record<string, unknown>,
    tags?: string[]
  ): Promise<void> {
    // Store start time for calculating duration later
    this.startTimes.set(runId, Date.now());

    // Get the current node name from tags if available
    const nodeName = tags?.find(tag => tag.startsWith('node:'))?.replace('node:', '') || 'unknown';

    // Log the LLM request
    const logMessage = [
      `\n=== LLM REQUEST - ${nodeName} - ${new Date().toISOString()} ===`,
      `Run ID: ${runId}`,
      `Model: ${llm.model || llm.modelName || 'unknown'}`,
      `Prompts:`,
      ...prompts.map((prompt, i) => `--- PROMPT ${i + 1} ---\n${prompt}\n-----------------`),
      '=== END REQUEST ===\n'
    ].join('\n');

    this.appendToLog(logMessage);
  }

  /**
   * Called when an LLM ends
   * @param output - The output from the LLM
   * @param runId - The unique run ID
   * @param parentRunId - The parent run ID (unused but required by interface)
   * @param tags - Optional tags for categorizing the run
   */
  override async handleLLMEnd(
    output: any,
    runId: string,
    _parentRunId?: string,
    tags?: string[]
  ): Promise<void> {
    // Calculate time elapsed
    const startTime = this.startTimes.get(runId) || Date.now();
    const timeElapsed = Date.now() - startTime;
    this.startTimes.delete(runId);

    // Get the current node name from tags if available
    const nodeName = tags?.find(tag => tag.startsWith('node:'))?.replace('node:', '') || 'unknown';

    // Format the response for logging
    let responseStr: string;
    try {
      responseStr = JSON.stringify(output, null, 2);
    } catch (error) {
      responseStr = `[Non-serializable response: ${typeof output}]`;
    }

    // Log the LLM response
    const logMessage = [
      `\n=== LLM RESPONSE - ${nodeName} - ${new Date().toISOString()} ===`,
      `Run ID: ${runId}`,
      `Time elapsed: ${timeElapsed}ms`,
      `Response:`,
      responseStr,
      '=== END RESPONSE ===\n'
    ].join('\n');

    this.appendToLog(logMessage);
  }

  /**
   * Called when an error occurs in any component
   * @param error - The error that occurred
   * @param runId - The unique run ID
   * @param parentRunId - The parent run ID (unused but required by interface)
   * @param tags - Optional tags for categorizing the run
   */
  override async handleChainError(
    error: Error,
    runId: string,
    _parentRunId?: string,
    tags?: string[]
  ): Promise<void> {
    // Get the current node name from tags if available
    const nodeName = tags?.find(tag => tag.startsWith('node:'))?.replace('node:', '') || 'unknown';

    // Log the error
    const logMessage = [
      `\n!!! ERROR - ${nodeName} - ${new Date().toISOString()} !!!`,
      `Run ID: ${runId}`,
      `Error: ${error.message}`,
      `Stack: ${error.stack || 'No stack trace available'}`,
      '!!! END ERROR !!!\n'
    ].join('\n');

    this.appendToLog(logMessage);
  }

  /**
   * Called when a node starts running
   * @param chain - The chain instance (unused but required by interface)
   * @param inputs - The inputs to the chain (unused but required by interface)
   * @param runId - The unique run ID
   * @param parentRunId - The parent run ID (unused but required by interface)
   * @param tags - Optional tags for categorizing the run
   */
  override async handleChainStart(
    _chain: any,
    _inputs: ChainValues,
    runId: string,
    _parentRunId?: string,
    tags?: string[]
  ): Promise<void> {
    // Get the current node name from tags if available
    const nodeName = tags?.find(tag => tag.startsWith('node:'))?.replace('node:', '') || 'unknown';

    // Log the node execution start
    const logMessage = `[${new Date().toISOString()}] [${nodeName}] Started execution (runId: ${runId})\n`;
    this.appendToLog(logMessage);
  }

  /**
   * Called when a node ends
   * @param outputs - The outputs from the chain (unused but required by interface)
   * @param runId - The unique run ID
   * @param parentRunId - The parent run ID (unused but required by interface)
   * @param tags - Optional tags for categorizing the run
   */
  override async handleChainEnd(
    _outputs: ChainValues,
    runId: string,
    _parentRunId?: string,
    tags?: string[]
  ): Promise<void> {
    // Get the current node name from tags if available
    const nodeName = tags?.find(tag => tag.startsWith('node:'))?.replace('node:', '') || 'unknown';

    // Log the node execution end
    const logMessage = `[${new Date().toISOString()}] [${nodeName}] Completed execution (runId: ${runId})\n`;
    this.appendToLog(logMessage);
  }
}

// Export a singleton instance of the callback handler
export const fileLoggingCallbackHandler = new FileLoggingCallbackHandler();
