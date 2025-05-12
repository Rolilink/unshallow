import {WorkflowState, WorkflowStep} from '../interfaces/index.js';
import {NodeResult} from '../interfaces/node.js';
import {exec} from 'child_process';
import {promisify} from 'util';
import {logger} from '../utils/logging-callback.js';
import {stripAnsiCodes} from '../utils/openai.js';
import {ArtifactFileSystem} from '../utils/artifact-filesystem.js';

const execAsync = promisify(exec);

// Initialize the artifact file system
const artifactFileSystem = new ArtifactFileSystem();

/**
 * Validates the TypeScript in the test file
 */
export const tsValidationNode = async (
	state: WorkflowState,
): Promise<NodeResult> => {
	const {file} = state;
	const NODE_NAME = 'ts-validation';

	// Use our tracked TS attempts if in the fix loop, only increment if not yet in the fix loop
	const attemptNumber =
		file.currentStep === WorkflowStep.TS_VALIDATION_FAILED
			? logger.getAttemptCount('ts-fix')
			: file.retries.ts === 0
			? logger.incrementAttemptCount('ts')
			: logger.getAttemptCount('ts');

	await logger.logNodeStart(
		NODE_NAME,
		`Validating TypeScript (attempt #${attemptNumber}): ${file.path}`,
	);

	// Add progress logging
	await logger.progress(file.path, `TypeScript validation`, file.retries);

	// Check if we have already exceeded max retries
	if (file.retries.ts >= file.maxRetries) {
		await logger.error(
			NODE_NAME,
			`Max TypeScript fix retries (${file.maxRetries}) exceeded`,
		);
		await logger.progress(
			file.path,
			`Failed: Max TypeScript fix retries (${file.maxRetries}) exceeded`,
			file.retries,
		);

		return {
			file: {
				...file,
				status: 'failed',
				currentStep: WorkflowStep.TS_VALIDATION_FAILED,
			},
		};
	}

	// Skip if configured to skip TS validation
	if (file.skipTs) {
		await logger.info(NODE_NAME, `Skipped (skipTs enabled)`);
		return {
			file: {
				...file,
				tsCheck: {
					success: true,
					errors: [],
				},
				currentStep: WorkflowStep.TS_VALIDATION_SKIPPED,
			},
		};
	}

	try {
		// Get the temp file path using ArtifactFileSystem
		const tempFile = artifactFileSystem.createTempFilePath(file.path);

		// Run TypeScript validation with custom command if provided
		const tsCheckCmd = file.commands.tsCheck || 'yarn ts:check';
		const fullCommand = `${tsCheckCmd}`;

		await logger.info(NODE_NAME, `Executing: ${fullCommand}`);

		let stdout = '';
		let stderr = '';
		let exitCode = 0;

		try {
			const result = await execAsync(fullCommand);
			stdout = result.stdout || '';
			stderr = result.stderr || '';
		} catch (execError: any) {
			// When a command fails, exec throws an error with the exit code
			stdout = execError.stdout || '';
			stderr = execError.stderr || '';
			exitCode = execError.code || 1;
		}

		// Clean up ANSI codes
		stdout = stripAnsiCodes(stdout);
		stderr = stripAnsiCodes(stderr);

		// Log the complete command output
		await logger.logCommand(
			NODE_NAME,
			fullCommand,
			stdout,
			stderr,
			exitCode,
			file.currentStep === WorkflowStep.TS_VALIDATION_FAILED ? 'ts-fix' : 'ts',
		);

		// Check for TS errors
		if (stderr && stderr.toLowerCase().includes('error')) {
			const errors = stderr.split('\n').filter(line => line.includes('error'));

			console.log('TS Errors:', errors); // Debugging line

			// Check if any of the errors are related to the file being migrated
			const tempFileBase = tempFile.split('/').pop() || '';

			console.log('Temp File Base:', tempFileBase); // Debugging line
			console.log('Temp File:', tempFile); // Debugging line
			// Check if errors contain references to the file being migrated
			const hasErrorsInMigratedFile = errors.some(
				error => error.includes(tempFile) || error.includes(tempFileBase),
			);

			await logger.error(
				NODE_NAME,
				`TypeScript validation failed with ${errors.length} errors`,
			);

			// Log all errors
			await logger.logErrors(NODE_NAME, errors, 'TypeScript errors');

			// Add progress logging for TS errors
			await logger.progress(
				file.path,
				`TypeScript validation failed with ${errors.length} errors`,
				file.retries,
			);

			// Only trigger TS_VALIDATION_FAILED if errors are in the migrated file
			if (hasErrorsInMigratedFile) {
				await logger.info(
					NODE_NAME,
					`Errors found in the migrated file, triggering TypeScript fix.`,
				);

				return {
					file: {
						...file,
						tsCheck: {
							success: false,
							errors: errors,
						},
						currentStep: WorkflowStep.TS_VALIDATION_FAILED,
					},
				};
			} else {
				// Errors are in other files, consider this a pass for the migrated file
				await logger.info(
					NODE_NAME,
					`TypeScript errors found but none related to the migrated file. Proceeding without fix.`,
				);

				return {
					file: {
						...file,
						tsCheck: {
							success: true,
							errors: [],
						},
						currentStep: WorkflowStep.TS_VALIDATION_PASSED,
					},
				};
			}
		}

		await logger.success(NODE_NAME, `TypeScript validation passed`);

		// Add progress logging for TS success
		await logger.progress(
			file.path,
			`TypeScript validation passed`,
			file.retries,
		);

		// TS validation succeeded
		return {
			file: {
				...file,
				tsCheck: {
					success: true,
					errors: [],
				},
				currentStep: WorkflowStep.TS_VALIDATION_PASSED,
			},
		};
	} catch (error) {
		await logger.error(NODE_NAME, `Error during TypeScript validation`, error);

		return {
			file: {
				...file,
				tsCheck: {
					success: false,
					errors: [error instanceof Error ? error.message : String(error)],
				},
				status: 'failed',
				currentStep: WorkflowStep.TS_VALIDATION_ERROR,
			},
		};
	}
};
