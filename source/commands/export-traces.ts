/**
 * Command to export Langfuse traces to files
 */

import { Langfuse } from "langfuse";
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Interface for command options
export interface ExportTracesOptions {
  limit?: string;
  filter?: string;
  days?: string;
  format?: string;
}

/**
 * Handles the export-traces command
 * @param options Command options
 * @returns Exit code
 */
export async function handleExportTracesCommand(options: ExportTracesOptions): Promise<number> {
  try {
    console.log("Starting Langfuse traces export...");

    // Create Langfuse client
    const langfuse = new Langfuse({
			secretKey: "sk-lf-e66bd87b-4f75-4db2-a7d0-30b8432a1e17",
			publicKey: "pk-lf-70b101b3-963c-45cc-b4d8-df34b92ce17e",
			baseUrl: "http://localhost:3000",
    });

    // Prepare export directory in user's home folder
    const exportDir = path.join(os.homedir(), '.unshallow-langfuse-logs');
    await ensureExportDir(exportDir);

    // Create timestamp for the export folder
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const timestampDir = path.join(exportDir, `export-${timestamp}`);
    await fs.mkdir(timestampDir);

    console.log(`Export directory created: ${timestampDir}`);

    // Parse options
    const limit = options.limit ? parseInt(options.limit, 10) : 100;
    const daysBack = options.days ? parseInt(options.days, 10) : 7;
    const format = options.format || 'json';

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysBack);

    console.log(`Fetching traces from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`Limit: ${limit} traces`);

    // Fetch and export traces
    await exportTraces(langfuse, timestampDir, {
      limit,
      startDate,
      endDate,
      filter: options.filter,
      format
    });

    console.log("Export completed successfully!");
    return 0;
  } catch (error) {
    console.error("Error exporting Langfuse traces:", error);
    return 1;
  }
}

/**
 * Ensures the export directory exists
 */
async function ensureExportDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch (error) {
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`Created export directory: ${dirPath}`);
  }
}

/**
 * Exports Langfuse traces to files
 */
async function exportTraces(
  langfuse: Langfuse,
  exportDir: string,
  options: {
    limit: number,
    startDate: Date,
    endDate: Date,
    filter?: string,
    format: string
  }
): Promise<void> {
  let page = 1;
  const pageSize = 25; // Adjust based on API limits
  let totalExported = 0;
  const indexData: Array<{id: string, name: string, timestamp: string}> = [];

  // Parse filter if provided
  let filterObj = {};
  if (options.filter) {
    try {
      filterObj = JSON.parse(options.filter);
    } catch (error) {
      console.warn("Invalid filter JSON, ignoring filter");
    }
  }

  while (totalExported < options.limit) {
    console.log(`Fetching page ${page}...`);

    try {
      // Fetch traces with pagination
      const response = await langfuse.fetchTraces({
        page,
        limit: pageSize,
        fromTimestamp: options.startDate,
        toTimestamp: options.endDate,
        ...filterObj
      });

      // Check if we have trace data
      const traces = response.data || [];

      if (traces.length === 0) {
        console.log("No more traces to fetch");
        break;
      }

      // Save each trace to a separate file
      for (const trace of traces) {
        if (totalExported >= options.limit) break;

        const fileName = `${trace.id}.${options.format}`;
        const filePath = path.join(exportDir, fileName);

        // Pretty-print JSON or use specific format
        if (options.format === 'json') {
          await fs.writeFile(filePath, JSON.stringify(trace, null, 2));
        } else if (options.format === 'ndjson') {
          await fs.writeFile(filePath, JSON.stringify(trace));
        } else {
          await fs.writeFile(filePath, JSON.stringify(trace, null, 2));
        }

        // Add to index
        indexData.push({
          id: trace.id,
          name: trace.name || 'unnamed',
          timestamp: trace.timestamp || new Date().toISOString()
        });

        totalExported++;
        console.log(`Exported trace ${trace.id} (${totalExported}/${options.limit})`);
      }

      page++;

      // Check if we've reached the limit or there are no more traces
      if (traces.length < pageSize) {
        break;
      }
    } catch (error) {
      console.error("Error fetching traces:", error);
      break;
    }
  }

  // Create an index file for easier navigation
  await fs.writeFile(
    path.join(exportDir, 'index.json'),
    JSON.stringify({
      exportDate: new Date().toISOString(),
      totalExported,
      traces: indexData
    }, null, 2)
  );

  console.log(`Total traces exported: ${totalExported}`);
}
