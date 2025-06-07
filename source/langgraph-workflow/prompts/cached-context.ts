export const cachedContext = `

<tested-file-source-code> <!-- Source code of the file under test -->

\`\`\`tsx
{testedFileSourceCode}
\`\`\`

</tested-file-source-code>

<tested-file-imports> <!-- All local files imported by the tested file (depth controlled externally) -->

{testedFileImports}

</tested-file-imports>

<supporting-examples> <!-- Example tests that were previously migrated by the user -->

{supportingExamples}

</supporting-examples>
`;
