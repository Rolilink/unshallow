import { WorkflowState, WorkflowStep } from '../interfaces/index.js';
import { formatComponentContext } from '../utils/format-context.js';
import { NodeResult } from '../interfaces/node.js';

/**
 * Applies the context to the test file
 */
export const applyContextNode = async (state: WorkflowState): Promise<NodeResult> => {
  const { file } = state;
  const { context } = file;

  // Use the template function to format the component context
  const componentContext = formatComponentContext(
    context.componentName,
    context.componentCode,
    context.imports,
    context.examples,
    context.extraContext
  );

  // Update the file state with this context
  return {
    file: {
      ...file,
      componentContext,
      currentStep: WorkflowStep.APPLY_CONTEXT,
    },
  };
};
