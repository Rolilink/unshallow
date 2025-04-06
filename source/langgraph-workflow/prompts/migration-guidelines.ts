export const migrationGuidelines = `
- You should generate a react-testing-library implementation that follows the react-testing-library best practices.
- Also take into account the enzyme test, the component source code and the component file imports in your implementation.
- Pay attention to any example provided in the context if it's relevant to the implementation.
- Use \`render()\` from \`@testing-library/react\` and \`userEvent\` for interactions.
- Prefer semantic queries like \`getByRole\`, \`getByLabelText\`, or \`findByText\`.
- Avoid implementation details and snapshot testing.
- Mock only what's necessary using \`jest.fn()\` and \`jest.mock\`.
- Never use fireEvent.
- Follow the query priority order from RTL.
	- ByRole
	- ByLabelText
	- ByPlaceholderText
	- ByText
	- ByTestId
- use findBy queries instead of waitFor.
- use queryBy queries to check for the absence of elements.
- never test css classes or css styles, test via accessibility attributes.
- Always use \`jest.fn()\` when mocking functions or hooks.
- Always use findBy queries when waiting for an element to appear.
- Use \`jest.requireActual()\` to preserve other exports when mocking selectively.
- Never mock entire external libraries unless absolutely necessary.
- Avoid mocking implementation details unless required to isolate the component under test.
- Always Prefer explicit queries and assertions that reflect what the user sees and does.
- Use \`@testing-library/react\` to render components.
- Always query DOM elements using the \`screen\` object (e.g., \`screen.getByRole()\`).
- Use \`userEvent\` from \`@testing-library/user-event\` to simulate user interactions.
- NEVER use toHaveStyle unless the instructions explicitly ask for it.
- NEVER use toHaveAttribute unless the instructions explicitly ask for it.
- NEVER use toHaveClass unless the instructions explicitly ask for it.

<queries-instructions>
VERY IMPORTANT you must follow these instructions or it could cause ERRORS in the test execution.
- Always pass strings for accessibility names in accessibility queries like getByRole, getByLabelText, getByPlaceholderText, getByText, findByRole, findByLabelText, findByPlaceholderText, findByText, queryByRole, queryByLabelText, queryByPlaceholderText, queryByText.
 	example of correct usage: \`getByRole('button', {{ name: "Click me" }})\`
	example of incorrect usage: \`getByRole('button', {{ name: /Click me/i }})\`. (this will cause errors, never do it)

	example of correct usage: \`getByText("Click me")\`
	example of incorrect usage: \`getByText(/Click me/i)\`. (this will cause errors, never do it)
</queries-instructions>
`;
