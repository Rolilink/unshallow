import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { MigrationApp } from '../components/MigrationApp';

export const migrateCommand = new Command('migrate')
  .description('Migrate Enzyme tests to React Testing Library')
  .argument('<path>', 'Path to the test file or directory')
  .option('-d, --depth <number>', 'Import resolution depth', '2')
  .option('--skip-ts-check', 'Skip TypeScript checking step')
  .option('--skip-lint-check', 'Skip ESLint checking step')
  .action((path, options) => {
    // Render the Ink-based UI
    const { unmount } = render(
      <MigrationApp
        path={path}
        importDepth={parseInt(options.depth)}
        skipTsCheck={options.skipTsCheck}
        skipLintCheck={options.skipLintCheck}
      />
    );
    
    // Handle process exit
    process.on('SIGINT', () => {
      unmount();
      process.exit(0);
    });
  }); 
