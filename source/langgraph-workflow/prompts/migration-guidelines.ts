export const migrationGuidelines = `
<migration-guidelines>

<testing>
- Use \`@testing-library/react\` to render components.
- Always query DOM elements using the \`screen\` object (e.g., \`screen.getByRole()\`).
- Use \`userEvent\` from \`@testing-library/user-event\` to simulate user interactions.
- Prefer queries that reflect how users interact with the UI. Use them in this order:
  1. \`getByRole\`
  2. \`getByLabelText\`
  3. \`getByPlaceholderText\`
  4. \`getByText\`
  5. \`getByDisplayValue\`
  6. \`getByAltText\`
  7. \`getByTitle\`
  8. \`getByTestId\` (only as a last resort)

<examples>
Correct usage:
  screen.getByRole('button', {{ name: /submit/i }})
  userEvent.type(screen.getByLabelText('Email'), 'test@example.com')
  await screen.findByText('Success')

Incorrect usage:
  screen.querySelector('button').click()
  fireEvent.change(screen.getByLabelText('Email'), {{ target: {{ value: 'test@example.com' }} }})
  expect(container.querySelector('input').value).toBe('hello')
</examples>

<async-example>
Use \`findBy*\` queries when waiting for elements to appear:

  await screen.findByText('Loading complete')

Use \`waitFor()\` only when waiting for side effects that are not directly queryable:

  await waitFor(() => expect(mockFunction).toHaveBeenCalled())
</async-example>

<anti-patterns>
- Never use snapshot testing. Do not use \`expect(container).toMatchSnapshot()\` or \`asFragment()\`.
- Snapshot tests are brittle, difficult to review, and do not focus on behavior.
- Prefer explicit queries and assertions that reflect what the user sees and does.
</anti-patterns>
</testing>

<mocking>
- Always mock hooks used by the component, unless they are declared in the same file.
- Never mock built-in React hooks like \`useState\`, \`useEffect\`, \`useCallback\`, etc.
- Always mock style-related providers (e.g., theme providers) — prefer wrapping with the actual provider over mocking the hook.
- Never mock context providers like \`ApolloProvider\`, \`QueryClientProvider\`, or \`FormProvider\`. Mock their exposed hooks instead.

<form-libraries>
Mock the form hook:
  jest.mock('react-hook-form', () => {{
    const actual = jest.requireActual('react-hook-form');
    return {{
      ...actual,
      useFormContext: jest.fn(() => ({{
        watch: jest.fn(),
        getValues: jest.fn(),
      }})),
    }};
  }});
</form-libraries>

<routing-libraries>
Use both a memory router and hook mocks:

  render(
    <MemoryRouter>
      <MyComponent />
    </MemoryRouter>
  );

  jest.mock('react-router-dom', () => {{
    const actual = jest.requireActual('react-router-dom');
    return {{
      ...actual,
      useNavigate: jest.fn(() => jest.fn()),
      useParams: jest.fn(() => ({{ id: '123' }})),
    }};
  }});
</routing-libraries>

<styling-libraries>
Always wrap with the actual theme provider when needed:

  render(
    <ThemeProvider theme={{mockTheme}}>
      <MyComponent />
    </ThemeProvider>
  );
</styling-libraries>

<data-fetching>
Mock a custom hook:
  jest.mock('../hooks/useUserQuery', () => ({{
    useUserQuery: jest.fn(() => ({{
      data: {{ name: 'Jane' }},
      isLoading: false,
    }})),
  }}));

React Query:
  jest.mock('@tanstack/react-query', () => {{
    const actual = jest.requireActual('@tanstack/react-query');
    return {{
      ...actual,
      useQuery: jest.fn(() => ({{
        data: {{ user: {{}} }},
        isLoading: false,
      }})),
    }};
  }});

Apollo:
  jest.mock('@apollo/client', () => {{
    const actual = jest.requireActual('@apollo/client');
    return {{
      ...actual,
      useQuery: jest.fn(() => ({{
        data: {{ user: {{}} }},
        loading: false,
      }})),
    }};
  }});
</data-fetching>

<component-mocking>
Mocking components is acceptable when:
- You are testing routing logic and the component is conditionally rendered by a route.
- A child component is deeply complex or outside the scope of the current test.
- The component adds irrelevant behavior (e.g., long-running side effects, nested providers).

Mock the component using a named stub for clarity:

  jest.mock('../components/SettingsPage', () => ({{
    __esModule: true,
    default: jest.fn(() => <div>SettingsPage</div>),
  }}));

  jest.mock('../components/UserProfile', () => ({{
    __esModule: true,
    default: jest.fn(() => <div>UserProfile</div>),
  }}));

This keeps test output clean, improves snapshot clarity, and avoids unnecessary complexity.
</component-mocking>

<general>
- Always use \`jest.fn()\` when mocking functions or hooks.
- Use \`jest.requireActual()\` to preserve other exports when mocking selectively.
- Never mock entire external libraries unless absolutely necessary.
- Avoid mocking implementation details unless required to isolate the component under test.
</general>
</mocking>

</migration-guidelines>
`;
