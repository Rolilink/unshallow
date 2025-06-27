import {WorkflowState} from '../interfaces/index.js';
import {File} from '../../types.js';
import path from 'path';

/**
 * Interface for context getters to ensure type safety
 */
export interface ContextGetterResult {
	[key: string]: string;
}

/**
 * Format a single File's imports into a string representation
 */
export function formatFileImports(file: File): string {
	if (!file.imports || Object.keys(file.imports).length === 0) {
		return ''; // No imports
	}

	return Object.entries(file.imports)
		.map(([importPath, importFile]) => {
			const extension = path.extname(importFile.fileName).slice(1) || 'tsx';
			return `
### ${importFile.fileName} (Import path: ${importPath})
\`\`\`${extension}
// File: ${importFile.fileName}
// Path: ${importFile.fileAbsolutePath}
${importFile.fileContent}
\`\`\``;
		})
		.join('\n');
}

/**
 * Format example tests from EnrichedContext
 */
export function formatExampleTests(
	exampleTests?: Record<string, File>,
): string {
	if (!exampleTests || Object.keys(exampleTests).length === 0) {
		return ''; // No example tests
	}

	return Object.entries(exampleTests)
		.map(([_, exampleFile]) => {
			const extension = path.extname(exampleFile.fileName).slice(1) || 'tsx';
			return `
### ${exampleFile.fileName}:
\`\`\`${extension}
${exampleFile.fileContent}
\`\`\``;
		})
		.join('\n');
}

/**
 * Extract component name from file name (removing extensions and test/spec suffix)
 */
export function extractComponentName(fileName: string): string {
	// First remove the file extension
	const nameWithoutExt = path.basename(fileName, path.extname(fileName));
	// Then remove test/spec suffix if present
	return nameWithoutExt.replace(/\.(test|spec)$/, '');
}

/**
 * Get cached context variables from state
 * These are shared across multiple prompts
 */
export function getCachedContextVars(
	state: WorkflowState,
): ContextGetterResult {
	const {file} = state;
	const {context} = file;
	const testedFile = context.testedFile;

	return {
		testedFileSourceCode: testedFile.fileContent,
		testedFileImports: formatFileImports(testedFile),
		supportingExamples: formatExampleTests(context.exampleTests),
	};
}

/**
 * Get plan-rtl-conversion specific context variables
 */
export function getPlanRtlConversionVars(state: WorkflowState): {
	testedFileSourceCode: string;
	testedFileImports: string;
	supportingExamples: string;
	originalTestFile: string;
} {
	const {file} = state;
	const {context} = file;
	const testedFile = context.testedFile;

	// Return the exact variables the prompt template expects
	return {
		testedFileSourceCode: testedFile.fileContent,
		testedFileImports: formatFileImports(testedFile),
		supportingExamples: formatExampleTests(context.exampleTests),
		originalTestFile: file.content,
	};
}

/**
 * Get execute-rtl-conversion specific context variables
 */
export function getExecuteRtlConversionVars(state: WorkflowState): {
	testFile: string;
	componentName: string;
	componentSourceCode: string;
	componentFileImports: string;
	userProvidedContext: string;
	gherkinPlan: string;
} {
	const {file} = state;
	const {context} = file;
	const testedFile = context.testedFile;
	const componentName = extractComponentName(testedFile.fileName);

	// Return the exact variables the execute-rtl prompt template expects
	return {
		testFile: file.content,
		componentName,
		componentSourceCode: testedFile.fileContent,
		componentFileImports: formatFileImports(testedFile),
		userProvidedContext: context.userProvidedContext || '',
		gherkinPlan: file.fixPlan?.plan?.trim() || '',
	};
}

/**
 * Get analyze-failure specific context variables
 */
export function getAnalyzeFailureVars(
	state: WorkflowState,
): ContextGetterResult {
	const {file} = state;
	const {context, currentError} = file;
	const cachedVars = getCachedContextVars(state);
	const componentName = extractComponentName(context.testedFile.fileName);

	return {
		...cachedVars,
		testFile: file.content,
		componentName,
		testName: currentError?.testName || '',
		normalizedError: currentError?.normalized || '',
		rawError: currentError?.message || '',
		accessibilityDump: file.accessibilityDump || '',
		domTree: file.domTree || '',
		previousTestCode: file.originalTest,
		userProvidedContext: context.userProvidedContext || '',
	};
}

/**
 * Get execute-rtl-fix specific context variables
 */
export function getExecuteRtlFixVars(
	state: WorkflowState,
): ContextGetterResult {
	const {file} = state;
	const {context, currentError, fixIntent} = file;
	const cachedVars = getCachedContextVars(state);
	const componentName = extractComponentName(context.testedFile.fileName);

	return {
		...cachedVars,
		testFile: file.content,
		componentName,
		testName: currentError?.testName || '',
		normalizedError: currentError?.normalized || '',
		rawError: currentError?.message || '',
		fixIntent: fixIntent || '',
		accessibilityDump: file.accessibilityDump || '',
		previousTestCode: file.originalTest,
		userProvidedContext: context.userProvidedContext || '',
	};
}
