import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { formatComponentContext } from '../utils/format-context.js';
import { NodeResult } from '../interfaces/node.js';

/**
 * Applies the context to the test file
 */
export const applyContextNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;
  const { context } = file;

  console.log(`[apply-context] Applying context for component: ${context.componentName}`);
  console.log(`[apply-context] Context includes ${Object.keys(context.imports).length} imports and ${context.examples ? Object.keys(context.examples).length : 0} example tests`);

  // Use the template function to format the component context
  const componentContext = formatComponentContext(
    context.componentName,
    context.componentCode,
    context.imports,
    context.examples,
    context.extraContext
  );

  console.log(`[apply-context] Context formatted successfully (${componentContext.length} characters)`);

  // Update the file state with this context
  return {
    file: {
      ...file,
      componentContext,
      currentStep: WorkflowStep.APPLY_CONTEXT,
    },
  };
};
