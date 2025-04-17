# Todo for V0

- Implement multiple files support (via directory) and parallel execution
- Implement meta report
	- last error attempt will be saved in the unshallow folder
  - after running all the files it will collect summarize each log of the migration
    - then will sumarize each summary in look for patterns and repeated errors
    - it will provide and detailed .md summary with code examples
- Fix the issue where ts files are not being imported and we need to do `/index.js` instead.
- Improve prompt structure for input caching.
- Final prompt engineering session with gpt-4.1 and o4-mini.
