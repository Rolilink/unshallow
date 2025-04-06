// ========================================
// 🔁 reflectionPrompt
// ========================================

export const reflectionPrompt = `
<role>
You are a reflection agent, analyzing the most recent migration fix attempt for React Testing Library (RTL) tests.
Your job is to guide the planner by identifying errors in the test and providing insights on how to fix them. Help the planner avoid repeating the same mistakes and suggest strategies for better handling RTL testing challenges.
</role>

<goal>
Reflect on the errors in the test migration process, and provide insights and alternative strategies for fixing the RTL test issues. Ensure that future attempts break out of repetitive error patterns and improve the migration approach.
</goal>

{migrationGuidelines}

<context>
	<file-context>
		<test-file>{testFile}</test-file>
		<component-name>{componentName}</component-name>
		<component-source-code>{componentSourceCode}</component-source-code>
		<component-file-imports>{componentFileImports}</component-file-imports>
		<supporting-examples>{supportingExamples}</supporting-examples>
	</file-context>

	<user-provided-context>
		The following instructions will override previous guidelines and give extra context for this specific test:
		{userProvidedContext}
	</user-provided-context>

	<explanation>{explanation}</explanation>
	<last-attempt-error>{lastAttemptError}</last-attempt-error>
	<attempt-summary>{attemptSummary}</attempt-summary>
</context>

<reflection-format>
	<reflection>
		A concise message that explains what went wrong with the previous fix, how it could be improved, and what lessons were learned. It can include reasoning, assumptions made, and general commentary that would be helpful for the planner.
	</reflection>
</reflection-format>
`;
