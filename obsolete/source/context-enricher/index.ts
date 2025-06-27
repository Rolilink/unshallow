import * as fs from 'fs/promises';
import * as path from 'path';
import * as ts from 'typescript';
import {EnrichmentOptions} from './interfaces/index.js';
import {EnrichedContext, File} from '../types.js';
import {resolveImportPath, fileExists} from './utils/file-utils.js';
import {ConfigManager} from '../config/config-manager.js';
import * as fsSync from 'fs';

/**
 * The ContextEnricher analyzes test files to extract contextual information
 * about the files being tested.
 */
export class ContextEnricher {
	/**
	 * Creates a new ContextEnricher
	 * @param projectRoot The root directory of the project
	 */
	constructor(private projectRoot: string) {}

	/**
	 * Analyze a test file and extract the tested file along with its imports
	 * @param testFilePath Path to the test file
	 * @param options Configuration options including import depth
	 * @returns Enriched context containing file information and related files
	 */
	async enrichContext(
		testFilePath: string,
		options: EnrichmentOptions = {},
	): Promise<EnrichedContext> {
		const importDepth = options.importDepth || 1;

		try {
			// Derive the tested file path based on naming convention
			const testedFilePath = this.findTestedFilePath(testFilePath);

			// Check if the tested file exists
			if (!(await fileExists(testedFilePath))) {
				throw new Error(
					`Could not find tested file at ${testedFilePath} based on test file ${testFilePath}`,
				);
			}

			// Read the tested file content
			const testedFileContent = await fs.readFile(testedFilePath, 'utf8');
			const testedFileName = path.basename(testedFilePath);

			// Create the tested File object
			const testedFile: File = {
				fileName: testedFileName,
				fileContent: testedFileContent,
				fileAbsolutePath: testedFilePath,
				imports: {},
			};

			// Process all imports starting from the tested file
			const imports = await this.processFileImports(
				testedFilePath,
				testFilePath,
				1,
				importDepth,
			);

			// Assign imports to the tested file
			testedFile.imports = imports;

			// Create the enriched context with the new structure
			const context: EnrichedContext = {
				testedFile,
				exampleTests: {},
				userProvidedContext: undefined,
			};

			// Process example tests if provided
			if (options.exampleTests && options.exampleTests.length > 0) {
				context.exampleTests = {};

				for (const examplePath of options.exampleTests) {
					try {
						const absolutePath = path.isAbsolute(examplePath)
							? examplePath
							: path.resolve(this.projectRoot, examplePath);

						if (await fileExists(absolutePath)) {
							const content = await fs.readFile(absolutePath, 'utf8');
							const fileName = path.basename(absolutePath);

							context.exampleTests[absolutePath] = {
								fileName,
								fileContent: content,
								fileAbsolutePath: absolutePath,
							};
						}
					} catch (error) {
						console.warn(`Failed to load example test ${examplePath}:`, error);
					}
				}
			}

			// Always try to load the default context file
			try {
				const configManager = new ConfigManager();
				const defaultContextPath = configManager.getDefaultContextFilePath();

				if (fsSync.existsSync(defaultContextPath)) {
					context.userProvidedContext = await fs.readFile(
						defaultContextPath,
						'utf8',
					);
					console.log(
						`Loaded default context file from: ${defaultContextPath}`,
					);
				}
			} catch (error) {
				console.warn(`Failed to load default context file:`, error);
			}

			return context;
		} catch (error) {
			console.error(`Error enriching context for ${testFilePath}:`, error);
			throw error;
		}
	}

	/**
	 * Finds the tested file path based on test file path naming convention
	 * @param testFilePath Path to the test file
	 * @returns Path to the tested file
	 */
	private findTestedFilePath(testFilePath: string): string {
		const testDir = path.dirname(testFilePath);
		const testFileName = path.basename(testFilePath);

		// Only support .jsx and .tsx extensions
		const baseFileName = testFileName
			.replace(/\.spec\.(tsx|jsx)$/, '.$1')
			.replace(/\.test\.(tsx|jsx)$/, '.$1');

		// If the replacement didn't change anything, it wasn't a proper test file
		if (baseFileName === testFileName) {
			throw new Error(
				`Test file ${testFilePath} does not follow naming convention (*.test.tsx, *.test.jsx, *.spec.tsx, or *.spec.jsx)`,
			);
		}

		return path.join(testDir, baseFileName);
	}

	/**
	 * Process imports for a file and build the File object structure
	 * @returns Record of imports to be assigned to parent file
	 */
	private async processFileImports(
		filePath: string,
		testFilePath: string,
		currentDepth: number,
		maxDepth: number,
		processedImports: Map<string, File> = new Map(),
	): Promise<Record<string, File>> {
		if (currentDepth > maxDepth) return {};

		// Create a new imports object
		const imports: Record<string, File> = {};

		// Extract direct imports from the file
		const directImports = await this.extractDirectImports(filePath);

		// Process each import
		for (const importPath of directImports) {
			try {
				const resolvedPath = resolveImportPath(
					importPath,
					path.dirname(filePath),
					this.projectRoot,
				);

				// Path relative to test file for the key in the imports record
				const relPathToTestFile = path.relative(
					path.dirname(testFilePath),
					resolvedPath,
				);

				// Skip if already processed
				if (processedImports.has(resolvedPath)) {
					// If already processed, just reference it
					imports[relPathToTestFile] = processedImports.get(resolvedPath)!;
					continue;
				}

				// Read the file content
				const content = await fs.readFile(resolvedPath, 'utf8');
				const fileName = path.basename(resolvedPath);

				// Create the File object (without imports initially)
				const importFile: File = {
					fileName,
					fileContent: content,
					fileAbsolutePath: resolvedPath,
					pathRelativeToTestedFile: relPathToTestFile,
				};

				// Add to processed imports map
				processedImports.set(resolvedPath, importFile);

				// Add to this level's imports
				imports[relPathToTestFile] = importFile;

				// Process nested imports if not at max depth
				if (currentDepth < maxDepth) {
					const nestedImports = await this.processFileImports(
						resolvedPath,
						testFilePath,
						currentDepth + 1,
						maxDepth,
						processedImports,
					);

					// Assign nested imports to the file
					importFile.imports = nestedImports;
				}
			} catch (error) {
				console.warn(
					`Error processing import ${importPath} from ${filePath}:`,
					error,
				);
			}
		}

		return imports;
	}

	/**
	 * Extract direct relative imports from a file
	 * @param filePath Path to the file to analyze
	 * @returns Array of import paths
	 */
	private async extractDirectImports(filePath: string): Promise<string[]> {
		try {
			const content = await fs.readFile(filePath, 'utf8');
			const sourceFile = ts.createSourceFile(
				filePath,
				content,
				ts.ScriptTarget.Latest,
				true,
			);

			// Extract only relative imports (starting with '.')
			const imports: string[] = [];
			ts.forEachChild(sourceFile, node => {
				if (ts.isImportDeclaration(node)) {
					const importPath = (node.moduleSpecifier as ts.StringLiteral).text;

					// Only include relative imports
					if (importPath.startsWith('.')) {
						imports.push(importPath);
					}
				}
			});

			return imports;
		} catch (error) {
			console.error(`Error extracting imports from ${filePath}:`, error);
			return [];
		}
	}
}
