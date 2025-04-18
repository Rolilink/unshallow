import { WorkflowStep } from './index.js';

/**
 * Result of a single file migration
 */
export interface MigrationResult {
  success: boolean;
  filePath: string;
  relativePath: string;
  errorStep?: WorkflowStep;
  error?: Error;
  duration: number;
  retries?: {
    rtl: number;
    test: number;
    ts: number;
    lint: number;
    total: number;
  };

  // Additional fields for meta report
  originalEnzymeContent?: string;
  rtlTestContent?: string;
  planContent?: string;
  componentName?: string;
  componentContent?: string;
  accessibilitySnapshot?: string;
  domTree?: string;
  imports?: any[];
  userContext?: string;
}

/**
 * Summary of all migrations
 */
export interface MigrationSummary {
  totalFiles: number;
  successful: number;
  failed: number;
  skipped: number;
  totalDuration: number;
  results: MigrationResult[];
  metaReportPath?: string;
}
