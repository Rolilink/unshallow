import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Logger utility for LangGraph workflow
 * Logs LLM requests and responses to a file in the user's home directory
 */
export class Logger {
  private logFilePath: string;
  private logDir: string;
  private static instance: Logger;

  private constructor() {
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
  }

  /**
   * Get the singleton instance of the logger
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
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
      console.error(`Error writing to log: ${error}`);
    }
  }

  /**
   * Log a node's execution
   */
  public logNodeExecution(nodeName: string, message: string): void {
    const logMessage = `[${new Date().toISOString()}] [${nodeName}] ${message}\n`;
    this.appendToLog(logMessage);
    // Also log to console if needed
    // console.log(logMessage);
  }

  /**
   * Log an LLM request
   */
  public logLLMRequest(nodeName: string, prompt: string, model: string): void {
    const logMessage = [
      `\n=== LLM REQUEST - ${nodeName} - ${new Date().toISOString()} ===`,
      `Model: ${model}`,
      `Prompt:\n${prompt}`,
      '=== END REQUEST ===\n\n'
    ].join('\n');

    this.appendToLog(logMessage);
  }

  /**
   * Log an LLM response
   */
  public logLLMResponse(nodeName: string, response: any, timeElapsed: number): void {
    const logMessage = [
      `\n=== LLM RESPONSE - ${nodeName} - ${new Date().toISOString()} ===`,
      `Time elapsed: ${timeElapsed}ms`,
      `Response:`,
      `${JSON.stringify(response, null, 2)}`,
      '=== END RESPONSE ===\n\n'
    ].join('\n');

    this.appendToLog(logMessage);
  }

  /**
   * Log an error
   */
  public logError(nodeName: string, error: Error | string): void {
    const errorMessage = typeof error === 'string' ? error : `${error.message}\n${error.stack}`;
    const logMessage = [
      `\n!!! ERROR - ${nodeName} - ${new Date().toISOString()} !!!`,
      errorMessage,
      '!!! END ERROR !!!\n\n'
    ].join('\n');

    this.appendToLog(logMessage);
  }

  /**
   * Get the current log file path
   */
  public getLogFilePath(): string {
    return this.logFilePath;
  }
}
