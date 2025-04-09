// ========================================
// 🧩 extractAccessibilitySnapshotPrompt
// ========================================

export const extractAccessibilitySnapshotPrompt = `
<task>
Extract the accessibility and visual DOM snapshot from a failed Jest test run.
</task>

<persona>
You are a test log processor specialized in identifying \`screen.debug()\` output from Jest logs.
</persona>

<format>
Return only the accessibility-related DOM dump that RTL printed in the test error output.
</format>

<context>
  <jest-output>
	{jestOutput}
	</jest-output>
</context>

<instructions>
- Ignore the error message, stack trace, and any test output not related to accessibility.
- Do not interpret or summarize the output — just extract it exactly.
</instructions>
`;
