// ========================================
// 🛠️ planRtlFixPrompt
// ========================================

export const planRtlFixPrompt = `
<prompt>
<role>
You are a test planner helping fix a broken React Testing Library (RTL) test.
Your job is to analyze a previous test implementation attempt and produce a detailed, human-readable plan to fix and improve the test.
</role>

<goal>
Refactor the broken test to follow best practices and fix any errors. Focus on descriptive guidance that informs the next implementation step.
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

	<user-instructions>
		The following instructions will override previous guidelines and give extra context for this specific test:
		{userInstructions}
	</user-instructions>

	<explanation>{explanation}</explanation>

	<last-attempt>
		<previous-code>{previousCode}</previous-code>
		<attempt-plan>{previousPlan}</attempt-plan>
		<attempt-plan-explanation>{previousPlanExplanation}</attempt-plan-explanation>
		<resulting-code>{previousOutput}</resulting-code>
		<error>{previousError}</error>
		<reflection>{previousReflection}</reflection>
	</last-attempt>

	<previous-attempts-summary>{attemptSummary}</previous-attempts-summary>
</context>

<plan-format>
Provide a revised test plan using the same structure as the initial conversion planner, but focus only on **what needs to change** to fix the current test failure.

Use the same tag structure as before, and for any section that does **not** need to be changed, write \`no changes needed\` as a plain string. Do not omit the section. The goal is to produce a full plan tree that can be easily diffed with the original plan.

<plan>
	<high-level-description>
		Always include a short summary of what the test fix is doing. This should explain the test issue and the general fix strategy. Be brief but specific.
	</high-level-description>

	<test>
		<imports>
			Describe if imports must be added, removed, or modified (e.g., switch from fireEvent to userEvent). If unchanged, say: no changes needed
		</imports>

		<mocks-setup>
			Explain any additions or updates to mocks. Should a mock be typed differently or scoped to a different setup block? If unchanged, say: no changes needed
		</mocks-setup>

		<describe-statement>
			<title>
				Explain if the test description needs to be updated to reflect a new behavior or strategy. If unchanged, say: no changes needed
			</title>
			<before-each>
				Describe any additions or cleanups needed in the beforeEach hook. If unchanged, say: no changes needed
			</before-each>
			<after-each>
				Describe any additions or cleanups needed in the afterEach hook. If unchanged, say: no changes needed
			</after-each>

			<it-statement>
				<title>
					Describe any necessary title updates. If unchanged, say: no changes needed
				</title>
				<description>
					Explain if the test description or intent has shifted. If unchanged, say: no changes needed
				</description>
				<each>
					Update if the test now uses a data-driven form. If not used or unchanged, say: no changes needed
				</each>
				<setup>
					Describe changes to mocks, state, or environment setup. Mention new helpers, mock return values, etc.
				</setup>
				<act>
					Describe how to rerender or interact with the component differently. Mention fixes to rendering or user simulation.
				</act>
				<assert>
					Describe how the assertion strategy is updated. Mention different queries, timing improvements, or better matchers.
				</assert>
				<clean>
					Explain if any manual cleanup logic is now necessary. If unchanged, say: no changes needed
				</clean>
			</it-statement>
		</describe-statement>
	</test>
</plan>
</plan-format>

<output-format>
Return a JSON object with:
{
	plan: string,         // The revised XML plan
	explanation: string   // A short explanation of how this revision improves the test
}
</output-format>
</prompt>
`;