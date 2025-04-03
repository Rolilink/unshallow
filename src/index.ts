#!/usr/bin/env node
import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { migrateCommand } from './cli/migrate';

const program = new Command();

program
  .name('unshallow')
  .description('CLI tool for migrating Enzyme tests to React Testing Library')
  .version('0.1.0');

program.addCommand(migrateCommand);

program.parse(process.argv);

// If no command is provided, show help
if (process.argv.length <= 2) {
  program.help();
} 
