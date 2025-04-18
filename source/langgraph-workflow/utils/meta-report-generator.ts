import { MigrationResult, MigrationSummary } from '../interfaces/shared-types.js';
import { ConfigFileSystem } from './config-filesystem.js';
import { generateMetaReportPrompt } from '../prompts/generate-meta-report-prompt.js';
import { callOpenAI } from './openai.js';
import { logger } from './logging-callback.js';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Format failed test information for the meta report
 * @param failedTests Array of failed test results
 * @returns Formatted string with test details in XML format
 */
export function formatFailedTestsInfo(failedTests: MigrationResult[]): string {
  let formattedInfo = '';

  for (const test of failedTests) {
    try {
      // Format the error message
      const errorMessage = test.error ? (test.error.message || "Unknown error") : "Unknown error";

      // Format imports as JSON if they exist
      const importsJSON = test.imports ? JSON.stringify(test.imports, null, 2) : '{}';

      // Append this test's info to the formatted string with fixed tags
      formattedInfo += `
<failed-test>
<file-path>${test.relativePath}</file-path>
<failure-step>${test.errorStep || 'UNKNOWN'}</failure-step>
<error-message>
\`\`\`
${errorMessage}
\`\`\`
</error-message>

<test-context>
<original-enzyme-test>
\`\`\`tsx
${test.originalEnzymeContent || ''}
\`\`\`
</original-enzyme-test>

<final-rtl-attempt>
\`\`\`tsx
${test.rtlTestContent || ''}
\`\`\`
</final-rtl-attempt>

<migration-plan>
\`\`\`
${test.planContent || ''}
\`\`\`
</migration-plan>

<component-info>
<name>${test.componentName || ''}</name>
<content>
\`\`\`tsx
${test.componentContent || ''}
\`\`\`
</content>
</component-info>

<imports>
\`\`\`json
${importsJSON}
\`\`\`
</imports>

<accessibility-snapshot>
\`\`\`
${test.accessibilitySnapshot || ''}
\`\`\`
</accessibility-snapshot>

<user-context>
\`\`\`
${test.userContext || ''}
\`\`\`
</user-context>
</test-context>
</failed-test>`;
    } catch (error) {
      logger.error('meta-report', `Error formatting test ${test.relativePath}: ${error instanceof Error ? error.message : String(error)}`);
      // Add minimal error information for this test
      formattedInfo += `
<failed-test>
<file-path>${test.relativePath}</file-path>
<failure-step>${test.errorStep || 'UNKNOWN'}</failure-step>
<error-message>
\`\`\`
${test.error ? (test.error.message || "Unknown error") : "Unknown error"}
\`\`\`
</error-message>
<test-context>
<error>Failed to retrieve complete test context</error>
</test-context>
</failed-test>`;
    }
  }

  return formattedInfo;
}

/**
 * Generate a meta report for failed migrations
 * @param summary Migration summary with failed results
 * @returns Path to the generated report
 */
export async function generateMetaReport(summary: MigrationSummary): Promise<string> {
  try {
    // Only proceed if there are failures
    if (summary.failed === 0) {
      logger.info('meta-report', 'No failures to report');
      return '';
    }

    logger.info('meta-report', `Generating meta report for ${summary.failed} failed migrations`);

    // Get failed test results
    const failedTests = summary.results.filter(r => !r.success);

    // Format migration summary as JSON
    const migrationSummaryJSON = JSON.stringify({
      totalFiles: summary.totalFiles,
      successful: summary.successful,
      failed: summary.failed,
      skipped: summary.skipped,
      totalDuration: summary.totalDuration
    }, null, 2);

    // Format failed tests information
    const failedTestsInfo = formatFailedTestsInfo(failedTests);

    // Prepare the prompt by replacing placeholders
    const formattedPrompt = generateMetaReportPrompt
      .replace('{migrationSummary}', migrationSummaryJSON)
      .replace('{failedTestsInfo}', failedTestsInfo);

    // Call the o4-mini model to generate the report
    // We use o4-mini for all meta reports
    logger.info('meta-report', 'Calling model to generate report analysis');
    const report = await callOpenAI(formattedPrompt, 'generate-meta-report');

    // Save the report to the config directory
    const configFs = new ConfigFileSystem();
    await configFs.ensureConfigDirectoryExists();

    // Generate report path in config directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFileName = `migration-meta-report-${timestamp}.md`;
    const reportPath = path.join(configFs.getConfigDirectory(), reportFileName);

    // Write the report
    await fs.writeFile(reportPath, report, 'utf8');

    logger.info('meta-report', `Meta report generated and saved to: ${reportPath}`);

    return reportPath;
  } catch (error) {
    logger.error('meta-report', `Error generating meta report: ${error instanceof Error ? error.message : String(error)}`);
    return '';
  }
}
