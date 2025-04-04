#!/usr/bin/env node
import {Command} from 'commander';
import {handleMigrateCommand} from './commands/migrate.js';
import {handleContextEnricherCommand} from './commands/context-enricher.js';
import {handleSetApiKeyCommand, handleGetApiKeyCommand} from './commands/config.js';
import {handleTestLintCommand} from './commands/test-lint.js';

// Create the main program
const program = new Command()
	.name('unshallow')
	.description('Migrate Enzyme tests to React Testing Library')
	.version('0.0.1');

// Add the config command
program
	.command('config')
	.description('Configuration management');

// Add set-api-key subcommand
program
	.command('config:set-api-key')
	.description('Set the OpenAI API key')
	.argument('<key>', 'Your OpenAI API key')
	.action((key) => {
		const exitCode = handleSetApiKeyCommand(key);
		process.exit(exitCode);
	});

// Add get-api-key subcommand
program
	.command('config:get-api-key')
	.description('View the current OpenAI API key (masked)')
	.action(() => {
		const exitCode = handleGetApiKeyCommand();
		process.exit(exitCode);
	});

// Add the migrate command
program
	.command('migrate')
	.description('Migrate Enzyme test files to React Testing Library')
	.argument('<path>', 'File or directory to migrate from Enzyme to RTL')
	.option('--skip-ts-check', 'Skip TypeScript checking')
	.option('--skip-lint-check', 'Skip ESLint checking')
	.option('--skip-test-run', 'Skip running the test')
	.option('--max-retries <number>', 'Maximum LLM retries', '15')
	.option('--pattern <glob>', 'Test file pattern', '**/*.{test,spec}.{ts,tsx}')
	.option('--import-depth <number>', 'Depth for AST import analysis', '1')
	.option(
		'--examples <paths>',
		'Comma-separated list of example tests to use as references',
	)
	.option(
		'--context-file <path>',
		'Path to a text file with additional context for the migration',
	)
	.option(
		'--lint-check-cmd <command>',
		'Custom command for lint checking',
		'yarn lint:check',
	)
	.option(
		'--lint-fix-cmd <command>',
		'Custom command for lint fixing',
		'yarn lint:fix',
	)
	.option(
		'--ts-check-cmd <command>',
		'Custom command for TypeScript checking',
		'yarn ts:check',
	)
	.option(
		'--test-cmd <command>',
		'Custom command for running tests',
		'yarn test',
	)
	.option(
		'--api-key <key>',
		'OpenAI API key to use for this command (overrides config)',
	)
	.action(async (inputPath, options) => {
		const exitCode = await handleMigrateCommand(inputPath, options);
		process.exit(exitCode);
	});

// Add the context-enricher command
program
	.command('context-enricher')
	.description('Analyze a test file and extract contextual information')
	.argument('<testFilePath>', 'Path to the test file to analyze')
	.option(
		'--import-depth <number>',
		'Depth for AST import analysis',
		'1'
	)
	.option(
		'--examples <paths>',
		'Comma-separated list of example tests to use as references'
	)
	.option(
		'--context-file <path>',
		'Path to a text file with additional context'
	)
	.option(
		'--output-format <format>',
		'Output format (pretty or json)',
		'pretty'
	)
	.action(async (testFilePath, options) => {
		const exitCode = await handleContextEnricherCommand(testFilePath, options);
		process.exit(exitCode);
	});

// Add the test-lint command
program
	.command('test-lint')
	.description('Test the lint check and fix cycle on a file')
	.argument('<path>', 'File to test the lint cycle on')
	.option('--max-retries <number>', 'Maximum LLM retries', '15')
	.option(
		'--lint-check-cmd <command>',
		'Custom command for lint checking',
		'yarn lint:check',
	)
	.option(
		'--lint-fix-cmd <command>',
		'Custom command for lint fixing',
		'yarn lint:fix',
	)
	.option(
		'--output-file <path>',
		'Output file to write the fixed content to',
	)
	.action(async (inputPath, options) => {
		const exitCode = await handleTestLintCommand(inputPath, options);
		process.exit(exitCode);
	});

// Parse the arguments
program.parse();
