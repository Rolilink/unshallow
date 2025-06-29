# Subsystems Documentation

This directory contains documentation for Unshallow's core subsystems. Each subsystem represents a major functional area of the application, focusing on high-level architecture, design decisions, and developer workflows.

## Purpose and Scope

Subsystem documentation is intended for developers working on Unshallow's internal architecture. These docs explain:

- High-level system design and responsibilities
- Integration patterns between subsystems
- Configuration and setup procedures
- Developer workflows and best practices

**Note:** For technical implementation details of specific modules, see the module-level documentation in the source code.

## Available Documentation

### [Configuration System](./configuration.md)
Configuration management, settings hierarchy, and environment-specific setup for development and production environments.

## Planned Subsystems

The following subsystems will be documented as they are implemented:

### AI Workflow Management
- AI provider integration and switching
- Prompt management and templates
- Context enrichment and processing
- Workflow execution and state management

### Git Operations
- Repository interaction patterns
- Commit analysis and processing
- Branch and tag management
- Git hook integration

### File Processing
- File discovery and filtering
- Content analysis and transformation
- Template processing and generation
- Output management

### CLI Interface
- Command structure and parsing
- Interactive prompts and user input
- Progress reporting and feedback
- Error handling and recovery

## Documentation Template

When creating new subsystem documentation, follow this structure:

```markdown
# [Subsystem Name]

## Overview
Brief description of the subsystem's purpose and responsibilities.

## Architecture
High-level design patterns and component relationships.

## Configuration
Setup requirements and configuration options.

## Integration Points
How this subsystem interacts with others.

## Developer Workflows
Common tasks and procedures for developers.

## Troubleshooting
Common issues and their solutions.
```

## Subsystem vs Module Documentation

**Subsystem Documentation (this directory):**
- High-level architectural overview
- Cross-cutting concerns and integration
- Developer workflows and procedures
- Configuration and setup guidance

**Module Documentation (in source code):**
- API references and function signatures
- Implementation details and algorithms
- Code examples and usage patterns
- Technical specifications and constraints