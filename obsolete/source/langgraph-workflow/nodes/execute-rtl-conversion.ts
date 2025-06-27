import {WorkflowState, WorkflowStep} from '../interfaces/index.js';
import {NodeResult} from '../interfaces/node.js';
import {PromptTemplate} from '@langchain/core/prompts';
import {executeRtlConversionPrompt} from '../prompts/execute-rtl-conversion-prompt.js';
import {callOpenAIStructured} from '../utils/openai.js';
import {z} from 'zod';
import {migrationGuidelines} from '../prompts/migration-guidelines.js';
import {logger} from '../utils/logging-callback.js';
import {getExecuteRtlConversionVars} from '../utils/context-formatter.js';

// Define the schema using Zod
export const ExecuteRtlConversionOutputSchema = z.object({
	rtl: z.string().describe('The complete RTL test implementation'),
});

export type ExecuteRtlConversionOutput = z.infer<
	typeof ExecuteRtlConversionOutputSchema
>;

// Create the PromptTemplate for the convert RTL template
export const executeRtlConversionTemplate = PromptTemplate.fromTemplate(
	executeRtlConversionPrompt,
);

/**
 * Executes the conversion from Enzyme to RTL
 * Uses the plan from the previous step to guide the implementation
 */
export const executeRtlConversionNode = async (
	state: WorkflowState,
): Promise<NodeResult> => {
	const {file} = state;
	const NODE_NAME = 'execute-rtl-conversion';

	await logger.logNodeStart(NODE_NAME, 'Executing RTL conversion');

	try {
		// Skip if the status is failed or no plan is available
		if (file.status === 'failed' || !file.fixPlan?.plan) {
			await logger.info(
				NODE_NAME,
				`Skipping, status=${file.status}, plan=${!!file.fixPlan?.plan}`,
			);
			return {
				file: {
					...file,
					status: file.status || 'failed',
					error: file.error || new Error('Missing plan for conversion'),
					currentStep: WorkflowStep.INITIALIZE,
				},
			};
		}

		// Get prompt variables using the context formatter
		const promptVars = getExecuteRtlConversionVars(state);

		// Add migration guidelines to the prompt variables
		const formattedPrompt = await executeRtlConversionTemplate.format({
			...promptVars,
			migrationGuidelines,
		});

		await logger.info(NODE_NAME, 'Calling OpenAI to execute conversion');

		// Call OpenAI with the prompt
		const response = await callOpenAIStructured({
			prompt: formattedPrompt,
			schema: ExecuteRtlConversionOutputSchema,
			// Use o4-mini if reasoningExecution is enabled
			model: state.file.reasoningExecution ? 'o4-mini' : 'gpt-4.1',
			nodeName: 'execute_rtl_conversion',
		});

		await logger.success(NODE_NAME, 'Conversion complete');

		// Log the generated RTL test
		if (response.rtl) {
			await logger.logRtlTest(NODE_NAME, response.rtl);
		}

		// Return the updated state with the generated RTL test
		return {
			file: {
				...file,
				rtlTest: response.rtl,
				status: 'in-progress',
				currentStep: WorkflowStep.EXECUTE_RTL_CONVERSION,
			},
		};
	} catch (error) {
		await logger.error(NODE_NAME, 'Error during RTL conversion', error);

		// If there's an error, mark the process as failed
		return {
			file: {
				...file,
				error: error instanceof Error ? error : new Error(String(error)),
				status: 'failed',
				currentStep: WorkflowStep.INITIALIZE,
			},
		};
	}
};
