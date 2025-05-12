import * as fs from 'fs/promises';
import * as path from 'path';
import * as ts from 'typescript';
import {
	EnrichmentOptions,
	EnrichedContext,
	ImportInfo,
} from './interfaces/index.js';
import {resolveImportPath, fileExists} from './utils/file-utils.js';
import {ConfigManager} from '../config/config-manager.js';
import * as fsSync from 'fs';

/**
 * The ContextEnricher analyzes test files to extract contextual information
 * about the component being tested.
 */
export class ContextEnricher {
	/**
	 * Creates a new ContextEnricher
	 * @param projectRoot The root directory of the project
	 */
	constructor(private projectRoot: string) {}

	/**
	 * Analyze a test file and extract the tested component along with its imports
	 * @param testFilePath Path to the test file
	 * @param options Configuration options including import depth
	 * @returns Enriched context containing component code and related files
	 */
	async enrichContext(
		testFilePath: string,
		options: EnrichmentOptions = {},
	): Promise<EnrichedContext> {
		const importDepth = options.importDepth || 1;

		try {
			// Read and parse the test file
			const testFileContent = await fs.readFile(testFilePath, 'utf8');
			const sourceFile = ts.createSourceFile(
				testFilePath,
				testFileContent,
				ts.ScriptTarget.Latest,
				true,
			);

			// Find the tested component
			const testedComponent = this.findTestedComponent(sourceFile);
			let componentFilePath: string;
			let componentName: string;
			let componentContent: string;

			if (!testedComponent) {
				// Try to find companion file based on naming convention
				console.log(
					`Could not identify a component under test in ${testFilePath}, trying to find companion file.`,
				);

				// Extract the base filename without test/spec suffix
				const testFileName = path.basename(testFilePath);
				const baseFileName = testFileName
					.replace(/\.spec\.(ts|tsx|js|jsx)$/, '.$1')
					.replace(/\.test\.(ts|tsx|js|jsx)$/, '.$1');

				const baseDir = path.dirname(testFilePath);
				const inferredFilePath = path.join(baseDir, baseFileName);

				// Check if the companion file exists
				if (await fileExists(inferredFilePath)) {
					componentFilePath = inferredFilePath;
					componentName = path.parse(baseFileName).name;
					componentContent = await fs.readFile(componentFilePath, 'utf8');
					console.log(`Found companion file: ${componentFilePath}`);
				} else {
					throw new Error(
						`Could not identify a component under test in ${testFilePath} and no companion file was found`,
					);
				}
			} else {
				// Get component file path from import
				componentFilePath = resolveImportPath(
					testedComponent.importPath,
					path.dirname(testFilePath),
					this.projectRoot,
				);
				componentName = testedComponent.name;
				componentContent = await fs.readFile(componentFilePath, 'utf8');
			}

			// For backward compatibility we still maintain the Maps
			const componentImports = new Map<string, string>();
			const relatedFiles = new Map<string, string>();

			// Create the imports array for the new structure
			const importsArray: ImportInfo[] = [];

			// Add the component itself as the first import
			importsArray.push({
				name: componentName,
				code: componentContent,
				pathRelativeToTest: path.relative(
					path.dirname(testFilePath),
					componentFilePath,
				),
				isComponent: true,
			});

			// Extract direct imports from the component file
			const componentDirectImports = await this.extractDirectImports(
				componentFilePath,
			);

			// Process direct imports
			for (const importPath of componentDirectImports) {
				try {
					const resolvedPath = resolveImportPath(
						importPath,
						path.dirname(componentFilePath),
						this.projectRoot,
					);

					const relativePath = path.relative(this.projectRoot, resolvedPath);
					const importName = path.basename(resolvedPath);
					const content = await fs.readFile(resolvedPath, 'utf8');

					// Add to legacy Map
					componentImports.set(relativePath, content);

					// Add to new ImportInfo array
					importsArray.push({
						name: importName,
						code: content,
						pathRelativeToTest: path.relative(
							path.dirname(testFilePath),
							resolvedPath,
						),
						pathRelativeToComponent: path.relative(
							path.dirname(componentFilePath),
							resolvedPath,
						),
						isComponent: false,
					});
				} catch (error) {
					console.warn(
						`Error processing direct import ${importPath} from ${componentFilePath}:`,
						error,
					);
				}
			}

			// Process deeper imports starting from the component's direct imports
			for (const [importPath] of componentImports) {
				const absolutePath = path.resolve(this.projectRoot, importPath);
				await this.processImportsWithStructure(
					absolutePath,
					importsArray,
					relatedFiles,
					testFilePath,
					componentFilePath,
					1,
					importDepth,
				);
			}

			// Create the base context
			const context: EnrichedContext = {
				testedComponent: {
					name: componentName,
					filePath: path.relative(this.projectRoot, componentFilePath),
					content: componentContent,
				},
				imports: importsArray,
				componentImports, // For backward compatibility
				relatedFiles, // For backward compatibility
			};

			// Process example tests if provided
			if (options.exampleTests && options.exampleTests.length > 0) {
				context.exampleTests = new Map<string, string>();

				for (const examplePath of options.exampleTests) {
					try {
						const absolutePath = path.isAbsolute(examplePath)
							? examplePath
							: path.resolve(this.projectRoot, examplePath);

						if (fileExists(absolutePath)) {
							const content = await fs.readFile(absolutePath, 'utf8');
							context.exampleTests.set(
								path.relative(this.projectRoot, absolutePath),
								content,
							);
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
					context.extraContext = await fs.readFile(defaultContextPath, 'utf8');
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
	 * Extract direct imports from a file
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

			// Extract imports
			const imports: string[] = [];
			ts.forEachChild(sourceFile, node => {
				if (ts.isImportDeclaration(node)) {
					const importPath = (node.moduleSpecifier as ts.StringLiteral).text;

					// Skip node_modules and non-relative imports
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

	/**
	 * Get a map of all related file contents from the enriched context
	 * @param context The enriched context object
	 * @returns A map of file paths to their contents
	 */
	getRelatedFilesContent(context: EnrichedContext): Map<string, string> {
		// If we have the legacy Maps, use them
		if (context.componentImports && context.relatedFiles) {
			// Combine component imports and related files
			const combinedMap = new Map<string, string>([
				...context.componentImports,
				...context.relatedFiles,
			]);
			return combinedMap;
		}

		// If we don't have the legacy Maps, create one from the imports array
		const combinedMap = new Map<string, string>();
		if (context.imports) {
			for (const importInfo of context.imports) {
				combinedMap.set(importInfo.pathRelativeToTest, importInfo.code);
			}
		}
		return combinedMap;
	}

	/**
	 * Find the tested component in a source file by analyzing imports and test patterns
	 */
	private findTestedComponent(
		sourceFile: ts.SourceFile,
	): {name: string; importPath: string} | null {
		// Track imports for later reference
		const imports: {name: string; path: string}[] = [];

		// Extract imports first
		ts.forEachChild(sourceFile, node => {
			if (ts.isImportDeclaration(node)) {
				const importPath = (node.moduleSpecifier as ts.StringLiteral).text;

				if (node.importClause) {
					// Default import
					if (node.importClause.name) {
						imports.push({
							name: node.importClause.name.text,
							path: importPath,
						});
					}

					// Named imports
					if (
						node.importClause.namedBindings &&
						ts.isNamedImports(node.importClause.namedBindings)
					) {
						node.importClause.namedBindings.elements.forEach(element => {
							imports.push({
								name: element.name.text,
								path: importPath,
							});
						});
					}
				}
			}
		});

		// Common testing patterns
		const testPatterns = [
			'shallow',
			'mount',
			'render', // Enzyme and RTL
		];

		// Look for component usage in test file
		let testedComponent: {name: string; importPath: string} | null = null;

		// Recursively visit all nodes in the AST
		const visitNode = (node: ts.Node): void => {
			if (testedComponent) return; // Already found

			// Check for testing function calls
			if (ts.isCallExpression(node)) {
				const callText = node.expression.getText();

				if (testPatterns.some(pattern => callText.includes(pattern))) {
					if (node.arguments.length > 0) {
						// Check first argument which is usually the component
						const firstArg = node.arguments[0];
						let componentName = '';

						// JSX Element case (<ComponentName />)
						if (
							firstArg &&
							(ts.isJsxElement(firstArg as ts.Node) ||
								ts.isJsxSelfClosingElement(firstArg as ts.Node))
						) {
							const tagName = ts.isJsxElement(firstArg as ts.Node)
								? (firstArg as ts.JsxElement).openingElement.tagName.getText()
								: (firstArg as ts.JsxSelfClosingElement).tagName.getText();
							componentName = tagName;
						}
						// Variable reference case (ComponentName)
						else if (firstArg && ts.isIdentifier(firstArg as ts.Node)) {
							componentName = (firstArg as ts.Identifier).text;
						}

						if (componentName) {
							// Look for matching import
							const matchingImport = imports.find(
								imp => imp.name === componentName,
							);
							if (matchingImport) {
								testedComponent = {
									name: componentName,
									importPath: matchingImport.path,
								};
							}
						}
					}
				}
			}

			// Continue recursion through all children
			ts.forEachChild(node, visitNode);
		};

		// Start recursive traversal
		visitNode(sourceFile);

		return testedComponent;
	}

	/**
	 * Process imports recursively up to the specified depth and add structured import info
	 */
	private async processImportsWithStructure(
		filePath: string,
		importsArray: ImportInfo[],
		relatedFiles: Map<string, string>,
		testFilePath: string,
		componentFilePath: string,
		currentDepth: number,
		maxDepth: number,
	): Promise<void> {
		if (currentDepth > maxDepth) return;

		try {
			const content = await fs.readFile(filePath, 'utf8');
			const importName = path.basename(filePath);

			// Add to the related files map if not already present
			const relativePath = path.relative(this.projectRoot, filePath);
			if (!relatedFiles.has(relativePath)) {
				relatedFiles.set(relativePath, content);

				// Check if this import is already in the imports array to avoid duplicates
				const exists = importsArray.some(
					imp =>
						imp.pathRelativeToTest ===
						path.relative(path.dirname(testFilePath), filePath),
				);

				if (!exists) {
					// Add to structured imports array
					importsArray.push({
						name: importName,
						code: content,
						pathRelativeToTest: path.relative(
							path.dirname(testFilePath),
							filePath,
						),
						pathRelativeToComponent: path.relative(
							path.dirname(componentFilePath),
							filePath,
						),
						isComponent: false,
					});
				}
			}

			const sourceFile = ts.createSourceFile(
				filePath,
				content,
				ts.ScriptTarget.Latest,
				true,
			);

			// Extract imports
			const imports: string[] = [];
			ts.forEachChild(sourceFile, node => {
				if (ts.isImportDeclaration(node)) {
					const importPath = (node.moduleSpecifier as ts.StringLiteral).text;

					// Skip node_modules and non-relative imports
					if (importPath.startsWith('.')) {
						imports.push(importPath);
					}
				}
			});

			// Process each import recursively
			for (const importPath of imports) {
				try {
					const resolvedPath = resolveImportPath(
						importPath,
						path.dirname(filePath),
						this.projectRoot,
					);

					// Skip if already processed
					if (relatedFiles.has(path.relative(this.projectRoot, resolvedPath))) {
						continue;
					}

					// Process nested imports if not at max depth
					if (currentDepth < maxDepth) {
						await this.processImportsWithStructure(
							resolvedPath,
							importsArray,
							relatedFiles,
							testFilePath,
							componentFilePath,
							currentDepth + 1,
							maxDepth,
						);
					}
				} catch (error) {
					console.warn(
						`Error processing import ${importPath} from ${filePath}:`,
						error,
					);
				}
			}
		} catch (error) {
			console.error(`Error processing file ${filePath}:`, error);
		}
	}
}
