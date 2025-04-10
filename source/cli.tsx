#!/usr/bin/env node
import {Command} from 'commander';
import {handleMigrateCommand} from './commands/migrate.js';
import {handleContextEnricherCommand} from './commands/context-enricher.js';
import {
	handleSetApiKeyCommand,
	handleGetApiKeyCommand,
} from './commands/config.js';
import {handleTestLintCommand} from './commands/test-lint.js';
import {handleGetContextPathCommand} from './commands/get-context-path.js';
import {handleSetLangfuseConfigCommand} from './commands/set-langfuse-config.js';

// Create the main program
const program = new Command()
	.name('unshallow')
	.description('Migrate Enzyme tests to React Testing Library')
	.version('0.0.1');

// Add the config command
program.command('config').description('Configuration management');

// Add get API key command
program
	.command('config:get-api-key')
	.description('View the current OpenAI API key (masked)')
	.action(() => {
		const exitCode = handleGetApiKeyCommand();
		process.exit(exitCode);
	});

// Add set API key command
program
	.command('config:set-api-key')
	.description('Set the OpenAI API key')
	.argument('<key>', 'OpenAI API key')
	.action(async key => {
		const exitCode = handleSetApiKeyCommand(key);
		process.exit(exitCode);
	});

// Add set Langfuse config command
program
	.command('set-langfuse-config')
	.description('Configure Langfuse for telemetry and tracing')
	.argument(
		'[config]',
		'JSON configuration with secretKey, publicKey, and baseUrl',
	)
	.option('--enable', 'Enable Langfuse logging')
	.option('--disable', 'Disable Langfuse logging')
	.action(async (config, options) => {
		const exitCode = await handleSetLangfuseConfigCommand(config, options);
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
	.option('--max-retries <number>', 'Maximum LLM retries', '20')
	.option('--pattern <glob>', 'Test file pattern', '**/*.{test,spec}.{ts,tsx}')
	.option('--import-depth <number>', 'Depth for AST import analysis', '1')
	.option(
		'--examples <paths>',
		'Comma-separated list of example tests to use as references',
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
	.option(
		'--reasoning',
		'Use o3-mini model for planning, execution, and reflection steps (faster, less accurate)',
	)
	.option('--reasoning-planning', 'Use o3-mini model for planning steps only')
	.option('--reasoning-execution', 'Use o3-mini model for execution steps only')
	.option(
		'--reasoning-reflection',
		'Use o3-mini model for reflection steps only',
	)
	.option('--debug', 'Enable verbose debug output', false)
	.action(async (inputPath, options) => {
		console.log(
			'Starting migration with options:',
			JSON.stringify(options, null, 2),
		);
		const exitCode = await handleMigrateCommand(inputPath, options);
		process.exit(exitCode);
	});

// Add the context-enricher command
program
	.command('context-enricher')
	.description('Analyze a test file and extract contextual information')
	.argument('<testFilePath>', 'Path to the test file to analyze')
	.option('--import-depth <number>', 'Depth for AST import analysis', '1')
	.option(
		'--examples <paths>',
		'Comma-separated list of example tests to use as references',
	)
	.option(
		'--output-format <format>',
		'Output format (pretty or json)',
		'pretty',
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
	.option('--output-file <path>', 'Output file to write the fixed content to')
	.action(async (inputPath, options) => {
		const exitCode = await handleTestLintCommand(inputPath, options);
		process.exit(exitCode);
	});

// Add the get-context-path command
program
	.command('get-context-path')
	.description('Get or create the default context file path')
	.action(async () => {
		const exitCode = await handleGetContextPathCommand();
		process.exit(exitCode);
	});

// Parse the arguments
program.parse();
