# V4A Diff Format Specification

## Table of Contents

- [Overview](#overview)
- [Basic Syntax](#basic-syntax)
- [Action Types](#action-types)
- [Context Rules](#context-rules)
- [Context Markers](#context-markers)
- [Code Change Syntax](#code-change-syntax)
- [Advanced Context Identification](#advanced-context-identification)
- [Context Overlap Rules](#context-overlap-rules)
- [Examples](#examples)
- [Usage with apply_patch](#usage-with-apply_patch)
- [Best Practices](#best-practices)
- [Error Handling](#error-handling)

## Overview

The V4A (Version 4A) diff format is a custom, human-readable patch specification designed for applying code changes without relying on line numbers. Instead, it uses contextual code identification to locate and modify specific sections within files.

### Key Features

- **Context-based identification**: Uses surrounding code context instead of line numbers
- **Human-readable format**: Easy to understand and write manually
- **Hierarchical context markers**: Supports class and function-level identification
- **Multi-file support**: Can modify multiple files in a single patch
- **Smart context handling**: Automatically manages overlapping changes

## Basic Syntax

Every V4A patch must be enclosed within sentinel markers:

```
*** Begin Patch
[patch content]
*** End Patch
```

### Required Elements

1. **Begin Sentinel**: `*** Begin Patch` (must be the first line)
2. **Action Declarations**: Specify what to do with each file
3. **Code Changes**: The actual modifications to make
4. **End Sentinel**: `*** End Patch` (must be the last line)

## Action Types

V4A supports four fundamental file operations:

### Add File
Creates a new file with the specified content.

```
*** Add File: path/to/new-file.ext
+[entire file content]
+[line by line]
+[prefixed with +]
```

### Update File
Modifies an existing file by applying specific changes.

```
*** Update File: path/to/existing-file.ext
[context and changes]
```

### Move File
Moves an existing file to a new location while optionally applying content changes.

```
*** Update File: path/to/existing-file.ext
*** Move to: new/path/to/file.ext
[context and changes]
```

**Note**: The move operation combines file relocation with content modification. The original file is deleted and a new file is created at the target location with the updated content.

### Delete File
Removes an existing file completely.

```
*** Delete File: path/to/file-to-remove.ext
```

**Important**: File paths must always be relative, never absolute.

## Context Rules

### Default Context Requirements

- **3 lines before**: Show 3 lines of code immediately above each change
- **3 lines after**: Show 3 lines of code immediately below each change
- **Context lines**: Prefix with a single space (` `)

### Basic Context Example

```
*** Update File: example.py
 def existing_function():
     """This function already exists"""
     current_code = "old"
-    old_line = "remove this"
+    new_line = "add this instead"
     more_existing = "code"
     return current_code
```

## Context Markers

When 3 lines of context are insufficient to uniquely identify a code location, use the `@@` operator to specify the containing class or function.

### Single Context Marker

```
@@ class ClassName
[3 lines of context before]
- old_code
+ new_code
[3 lines of context after]
```

### Function Context Example

```
*** Update File: calculator.py
@@ def calculate():
    input_value = get_input()
    if input_value > 0:
        result = process_positive(input_value)
-       return result
+       return result * 2
    else:
        return process_negative(input_value)
```

## Code Change Syntax

### Removal (Deletion)
Prefix lines to be removed with a minus sign (`-`):

```
- old_code_line
- another_old_line
```

### Addition (Insertion)
Prefix lines to be added with a plus sign (`+`):

```
+ new_code_line
+ another_new_line
```

### Context (Unchanged)
Prefix context lines with a single space (` `):

```
 existing_code_line
 another_context_line
```

### Mixed Changes
You can combine additions and removals:

```
 existing_context
- old_implementation
+ new_implementation
+ additional_new_line
 more_context
```

## Advanced Context Identification

### Multiple Context Markers

For highly nested or repeated code patterns, use multiple `@@` statements:

```
@@ class BaseClass
@@     def method():
[3 lines of context]
- old_code
+ new_code
[3 lines of context]
```

### Deeply Nested Example

```
*** Update File: complex.py
@@ class DataProcessor
@@     def process_data():
@@         for item in items:
             if item.is_valid():
                 current_value = item.get_value()
                 processed = transform(current_value)
-                results.append(processed)
+                results.append(processed * 2)
+                log_processing(processed)
                 total_count += 1
             else:
                 skip_invalid(item)
```

## Context Overlap Rules

When making multiple changes within the same file, avoid duplicating context lines between adjacent changes.

### Incorrect (Duplicated Context)
```
@@ def function_one():
    line1 = "context"
    line2 = "context"
-   old_code1 = "remove"
+   new_code1 = "add"
    line3 = "context"
    line4 = "context"

@@ def function_one():
    line3 = "context"  # ❌ Duplicated
    line4 = "context"  # ❌ Duplicated
-   old_code2 = "remove"
+   new_code2 = "add"
    line5 = "context"
```

### Correct (No Duplication)
```
@@ def function_one():
    line1 = "context"
    line2 = "context"
-   old_code1 = "remove"
+   new_code1 = "add"
    line3 = "context"
    line4 = "context"
-   old_code2 = "remove"
+   new_code2 = "add"
    line5 = "context"
```

## Examples

### Example 1: Simple Function Update

```
*** Begin Patch
*** Update File: utils.py
@@ def greet(name):
     """Greet someone by name"""
-    print(f"Hello {name}")
+    print(f"Hello, {name}!")
+    print(f"Nice to meet you!")
*** End Patch
```

### Example 2: Class Method Addition

```
*** Begin Patch
*** Update File: models.py
@@ class User:
     def __init__(self, name, email):
         self.name = name
         self.email = email
         self.is_active = True
+    
+    def deactivate(self):
+        """Deactivate the user account"""
+        self.is_active = False
+    
+    def activate(self):
+        """Activate the user account"""  
+        self.is_active = True
*** End Patch
```

### Example 3: File Move with Content Changes

```
*** Begin Patch
*** Update File: old_location.py
*** Move to: src/new_location.py
-class OldLocationProcessor:
-    """A processor that handles old location tasks."""
+class NewLocationProcessor:
+    """A processor that handles new location tasks."""
     
     def __init__(self, config=None):
         self.config = config or {}
         self.status = "initialized"

@@ def process_data(self, data):
-        """Process data using old location logic."""
+        """Process data using new location logic."""
         processed = []
         for item in data:
             if self.validate_item(item):
*** End Patch
```

### Example 4: Multi-File Patch

```
*** Begin Patch
*** Update File: main.py
@@ def main():
     print("Starting application")
-    run_old_process()
+    run_new_process()
     print("Application finished")

*** Update File: config.py
@@ class Config:
-    DEBUG = False
+    DEBUG = True
     VERSION = "1.0.0"

*** Add File: helpers.py
+"""Helper utilities for the application"""
+
+def format_output(data):
+    """Format data for display"""
+    return f"Result: {data}"
*** End Patch
```

### Example 5: Complete File Operations

```
*** Begin Patch
*** Delete File: old_module.py

*** Add File: new_module.py
+"""Replacement for old_module.py"""
+
+def new_function():
+    """Improved implementation"""
+    return "new_result"

*** Update File: imports.py
-from old_module import old_function
+from new_module import new_function
*** End Patch
```

## Usage with apply_patch

The V4A format is designed to work with the `apply_patch` command:

```bash
apply_patch <<"EOF"
*** Begin Patch
*** Update File: example.py
@@ def my_function():
     existing_code = "unchanged"
-    old_value = "remove"
+    new_value = "replace"
     more_code = "unchanged"
*** End Patch
EOF
```

### Command Structure

1. **Invocation**: `apply_patch <<"EOF"`
2. **Patch Content**: Complete V4A diff specification
3. **Termination**: `EOF`

### Expected Output

- **Success**: Python outputs "Done!" at the end
- **Errors**: Warning messages appear before "Done!"
- **Status**: Check messages before "Done!" to verify success

## Best Practices

### Context Selection

1. **Choose unique context**: Select context lines that uniquely identify the location
2. **Avoid generic patterns**: Don't use overly common code patterns as context
3. **Include meaningful markers**: Use function/class names, distinctive comments, or unique variable names

### Patch Organization

1. **Group related changes**: Keep logically related changes in the same patch
2. **Use descriptive context**: Include function signatures or class declarations
3. **Test incrementally**: Apply patches in small, testable chunks

### Code Quality

1. **Maintain indentation**: Preserve the original code's indentation style
2. **Follow conventions**: Match the existing code style and patterns
3. **Validate syntax**: Ensure new code is syntactically correct

### File Management

1. **Use relative paths**: Always specify file paths relative to the project root
2. **Verify file existence**: Ensure target files exist before updating/moving/deleting
3. **Handle dependencies**: Consider file dependencies when adding/removing/moving files
4. **Plan move operations**: Ensure target directories exist or will be created for move operations

## Error Handling

### Common Error Scenarios

1. **Context not found**: The specified context doesn't exist in the target file
2. **Ambiguous context**: Multiple locations match the provided context
3. **File not found**: Target file doesn't exist for Update/Delete/Move operations
4. **File already exists**: Target file exists for Add operations or Move target
5. **Invalid syntax**: Malformed patch structure or syntax errors
6. **Move conflicts**: Target path conflicts with existing files

### Error Messages

- **"Invalid context"**: Context lines don't match file content
- **"File not found"**: Target file missing for Update/Delete
- **"File already exists"**: Target file exists for Add operation
- **"Invalid Line"**: Syntax error in patch format
- **"Missing sentinels"**: Begin/End Patch markers missing or malformed

### Debugging Tips

1. **Check context exactly**: Ensure context lines match file content precisely
2. **Verify file paths**: Confirm relative paths are correct
3. **Test with simple changes**: Start with minimal patches to isolate issues
4. **Review output messages**: Examine all output before "Done!" for warnings

### Recovery Strategies

1. **Simplify context**: Reduce context to most essential lines
2. **Add context markers**: Use @@ operators for better identification
3. **Break down patches**: Split complex patches into smaller pieces
4. **Verify file state**: Ensure target files are in expected state before patching

---

This specification provides a complete reference for creating and applying V4A diff format patches. The format's context-based approach makes it particularly suitable for human-readable code modifications and automated patch systems that need to be resilient to minor file changes.