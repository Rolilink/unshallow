# Todo for V0
- Implement multiple files support (via directory) and parallel execution
- Implement meta report
  - after running all the files it will collect summarize each log of the migration
    - then will sumarize each summary in look for patterns and repeated errors
    - it will provide and detailed .md summary with code examples
    - it will also provide suggestions on how to modify the context.txt file
- Fix the issue where ts files are not being imported and we need to do `/index.js` instead.
