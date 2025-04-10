# Todo for V0

- Implement correct configuration for languse (through ~/.unshallow/langfuse.json)
  - also through a command that saves the configuration there.
- Implement correct file replacing logic (through ./unshallow folders parallel to the test)
  - logs.txt (will contain all logs of migrating this test)
  - will need to implement a logger function and a --verbose option
  - [test_name].attempt.spec.tsx will be the temporary file
  - the folder will be deleted if the test passes.
- Implement retry logic
  - will look for ./unshallow folders.
  - will start from the run test step and start fixing it
  - if it failed on the lint or ts step will do as well
  - requires `--retry` option
- Implement meta report
  - after running all the files it will collect summarize each log of the migration
    - then will sumarize each summary in look for patterns and repeated errors
    - it will provide and detailed .md summary with code examples
    - it will also provide suggestions on how to modify the context.txt file
