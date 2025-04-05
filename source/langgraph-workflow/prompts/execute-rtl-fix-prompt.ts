// ========================================
// ⚙️ executeRtlFixPrompt
// ========================================

export const executeRtlFixPrompt = `
<prompt>
<role>
You are a test fix executor. Your task is to apply a fix plan and generate an updated React Testing Library (RTL) test implementation.
</role>

<goal>
Generate a fixed test that follows best practices and incorporates corrections from the latest fix plan. Output the full implementation and describe your strategy.
</goal>

{migrationGuidelines}
<context>
	<file-context>
		<test-file>{testFile}</test-file>
		<component-name>{componentName}</component-name>
		<component-source-code>{componentSourceCode}</component-source-code>
		<component-file-imports>{componentFileImports}</component-file-imports>
	</file-context>
	<user-instructions>
		The following instructions will override previous guidelines and give extra context for this specific test:
		{userInstructions}
	</user-instructions>
	<plan>{plan}</plan>
</context>

<output-format>
Return a JSON object with the following structure:

{
	code: string,         // The full test implementation
	explanation: string   // A brief explanation of how this version resolves the problem
}

Only return the JSON object. Do not include markdown or extra commentary.
</output-format>
</prompt>
`;