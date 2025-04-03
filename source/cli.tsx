#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import {Command} from 'commander';
import App from './app.js';

const program = new Command()
	.name('unshallow')
	.description('CLI tool for unshallow')
	.option('--name <name>', 'Your name')
	.version('0.0.0')
	.addHelpText('after', `
Examples:
  $ unshallow --name=Jane
  Hello, Jane
`)
	.parse(process.argv);

const options = program.opts();

render(<App name={options['name']} />);
