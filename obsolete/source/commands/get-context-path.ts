import { ConfigManager } from '../config/config-manager.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Handle the get-context-path command
 * Returns the path to the default context file or creates it if it doesn't exist
 */
export async function handleGetContextPathCommand(): Promise<number> {
  try {
    const configManager = new ConfigManager();
    const contextFilePath = configManager.getDefaultContextFilePath();

    // Check if the directory exists, if not create it
    const contextDir = path.dirname(contextFilePath);
    if (!fs.existsSync(contextDir)) {
      fs.mkdirSync(contextDir, { recursive: true });
    }

    // Check if the file exists, if not create it with a template
    if (!fs.existsSync(contextFilePath)) {
      const templateContent = ``;
      fs.writeFileSync(contextFilePath, templateContent, 'utf8');
      console.log(`Created default context file at: ${contextFilePath}`);
    } else {
      console.log(`Default context file exists at: ${contextFilePath}`);
    }

    // Output just the path for easy use in scripts
    console.log(contextFilePath);

    return 0;
  } catch (error) {
    console.error('Error getting context file path:', error);
    return 1;
  }
}
