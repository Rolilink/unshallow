import {WorkflowState, WorkflowStep} from '../interfaces/index.js';
import {NodeResult} from '../interfaces/node.js';
import {PromptTemplate} from '@langchain/core/prompts';
import {callOpenAIStructured} from '../utils/openai.js';
import {planRtlConversionPrompt} from '../prompts/plan-rtl-conversion-prompt.js';
import {z} from 'zod';
import {formatImports} from '../utils/format-utils.js';
import {logger} from '../utils/logging-callback.js';
import {
	saveFileToTestDirectory,
	getTestDirectoryPath,
} from '../utils/filesystem.js';

// Define schema for plan RTL conversion output
export const PlanRtlConversionOutputSchema = z.object({
	plan: z
		.string()
		.describe('A detailed plan for how to convert the test to RTL'),
	explanation: z
		.string()
		.describe('A concise explanation of the migration approach'),
});

export type PlanRtlConversionOutput = z.infer<
	typeof PlanRtlConversionOutputSchema
>;

// Create the PromptTemplate for the plan RTL conversion template
export const planRtlConversionTemplate = PromptTemplate.fromTemplate(
	planRtlConversionPrompt,
);

/**
 * Plans the conversion from Enzyme to RTL
 * Using a planner-executor pattern for better quality conversion
 */
export const planRtlConversionNode = async (
	state: WorkflowState,
): Promise<NodeResult> => {
	const {file} = state;
	const NODE_NAME = 'plan-rtl-conversion';

	await logger.logNodeStart(NODE_NAME, `Planning RTL conversion`);

	try {
		// Format the prompt using the template without code block formatting
		const formattedPrompt = await planRtlConversionTemplate.format({
			testFile: file.content, // Use content directly
			componentName: file.context.componentName,
			componentSourceCode: file.context.componentCode, // Use component code directly
			componentFileImports: formatImports(file.context.imports),
			userProvidedContext: file.context.extraContext || '',
			supportingExamples: file.context.examples
				? JSON.stringify(file.context.examples)
				: '',
		});

		await logger.info(NODE_NAME, `Calling OpenAI to plan conversion`);

		// Call OpenAI with the prompt and RTL planning schema
		const response = await callOpenAIStructured({
			prompt: formattedPrompt,
			schema: PlanRtlConversionOutputSchema,
			// Use o3-mini if reasoningPlanning is enabled
			model: state.file.reasoningPlanning ? 'o3-mini' : 'gpt-4o-mini',
			nodeName: 'plan_rtl_conversion',
		});

		// Log the plan and explanation
		await logger.logPlan(NODE_NAME, response.plan, response.explanation);
		await logger.success(
			NODE_NAME,
			`Plan generated with ${response.plan.split('\n').length} steps`,
		);

		// Save the plan to the .unshallow folder
		// Instead of relying on file.testDir, determine the directory directly from the file path
		const testDir = getTestDirectoryPath(file.path);

		try {
			await logger.info(
				NODE_NAME,
				`Saving Gherkin plan to test directory: ${testDir}`,
			);

			// Ensure the directory exists (saveFileToTestDirectory will handle this now)
			const planPath = await saveFileToTestDirectory(
				testDir,
				'plan.txt',
				response.plan,
			);
			await logger.info(
				NODE_NAME,
				`Successfully saved Gherkin plan to ${planPath}`,
			);

			// Verify file was created
			const fs = await import('fs/promises');
			try {
				await fs.access(planPath);
				await logger.info(
					NODE_NAME,
					`Verified plan file exists at ${planPath}`,
				);
			} catch (accessError) {
				await logger.error(
					NODE_NAME,
					`Plan file not found after saving at ${planPath}`,
					accessError,
				);
			}
		} catch (error) {
			await logger.error(
				NODE_NAME,
				`Failed to save Gherkin plan to ${testDir}/plan.txt`,
				error,
			);
		}

		// Return the updated state with the conversion plan
		return {
			file: {
				...file,
				fixPlan: {
					plan: response.plan,
					explanation: response.explanation,
					timestamp: new Date().toISOString(),
				},
				currentStep: WorkflowStep.PLAN_RTL_CONVERSION,
			},
		};
	} catch (error) {
		await logger.error(NODE_NAME, `Error planning RTL conversion`, error);

		// If there's an error, mark the process as failed
		return {
			file: {
				...file,
				error: error instanceof Error ? error : new Error(String(error)),
				status: 'failed',
				currentStep: WorkflowStep.PLAN_RTL_CONVERSION,
			},
		};
	}
};
