#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command()
  .name('unshallow')
  .description('Migrate Enzyme tests to React Testing Library')
  .version('0.0.1');

program
  .command('migrate [directory]')
  .description('Migrate test files to React Testing Library')
  .option('--web', 'Open web UI for monitoring (always enabled)', true)
  .action(async (directory = '.') => {
    console.log(`Starting migration for directory: ${directory}`);
    console.log('Web UI will be available at http://localhost:3000');
    // TODO: Implement migration logic
  });

program.parse();
