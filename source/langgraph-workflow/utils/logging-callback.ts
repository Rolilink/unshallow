import * as fs from 'fs/promises';

/**
 * Logger that writes to both console and the logs.txt file in the .unshallow directory
 */
export class Logger {
  private logsPath: string | null = null;

  /**
   * Set the logs file path
   * @param logsPath Path to the logs file
   */
  setLogsPath(logsPath: string): void {
    this.logsPath = logsPath;
  }

  /**
   * Log an info message
   * @param nodeName Name of the current node
   * @param message Message to log
   */
  async info(nodeName: string, message: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${nodeName}] ${message}`;

    // Print to console
    console.log(logLine);

    // Write to logs file if available
    if (this.logsPath) {
      try {
        await fs.appendFile(this.logsPath, `${logLine}\n`);
      } catch (error) {
        console.error(`Error writing to log file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Log an error message
   * @param nodeName Name of the current node
   * @param message Error message
   * @param error Optional error object
   */
  async error(nodeName: string, message: string, error?: unknown): Promise<void> {
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error || '');
    const logLine = `[${timestamp}] [${nodeName}] ERROR: ${message}${errorMessage ? ` - ${errorMessage}` : ''}`;

    // Print to console
    console.error(logLine);

    // Write to logs file if available
    if (this.logsPath) {
      try {
        await fs.appendFile(this.logsPath, `${logLine}\n`);
      } catch (error) {
        console.error(`Error writing to log file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Log a success message
   * @param nodeName Name of the current node
   * @param message Success message
   */
  async success(nodeName: string, message: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${nodeName}] SUCCESS: ${message}`;

    // Print to console
    console.log(logLine);

    // Write to logs file if available
    if (this.logsPath) {
      try {
        await fs.appendFile(this.logsPath, `${logLine}\n`);
      } catch (error) {
        console.error(`Error writing to log file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}

// Export a singleton instance of the logger
export const logger = new Logger();
