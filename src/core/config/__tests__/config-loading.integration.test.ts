import { ConfigurationManager } from '../ConfigurationManager.js';
import { ModelTier, WorkflowNode, CommandType } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('[integration]: Configuration Loading End-to-End Tests', () => {
  let tempDir: string;
  let originalCwd: string;
  let configManager: ConfigurationManager;

  beforeEach(async () => {
    // Store original directory
    originalCwd = process.cwd();
    
    // Create temporary directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unshallow-config-test-'));
    
    // Resolve symlinks to get the real path
    tempDir = await fs.realpath(tempDir);
    
    // Change to temp directory
    process.chdir(tempDir);
    
    // Initialize git repository
    await execAsync('git init');
    await execAsync('git config user.email "test@example.com"');
    await execAsync('git config user.name "Test User"');
    
    // Create configuration manager
    configManager = new ConfigurationManager();
  });

  afterEach(async () => {
    // Change back to original directory
    process.chdir(originalCwd);
    
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Complete Configuration Flow', () => {
    it('should load, validate, and provide access to complete configuration end-to-end', async () => {
      // Create complete UNSHALLOW.md file
      const unshallowContent = `# Project Configuration

## Overview
This is a comprehensive project configuration for testing all features.

## Models
- Plan: mini tier for planning operations
- Migrate: full tier for complex migrations
- LintFix: nano tier for simple lint fixes
- TsFix: mini tier for TypeScript fixes

## Commands
- Test: npm run test:unit
- Lint: eslint src --ext .ts,.tsx
- LintFix: eslint src --ext .ts,.tsx --fix
- TypeCheck: tsc --noEmit

## Langfuse Integration
Enabled with cloud.langfuse.com endpoint for observability.
`;

      // Create complete unshallow.json file
      const completeConfig = {
        apiKeys: {
          openai: 'sk-test-key-12345',
          langfuse: {
            secretKey: 'sk-langfuse-test',
            publicKey: 'pk-langfuse-test',
            baseUrl: 'https://cloud.langfuse.com',
            enabled: true
          }
        },
        modelTiers: {
          plan: 'mini',
          migrate: 'full',
          lintFix: 'nano',
          tsFix: 'mini'
        },
        commands: {
          test: 'npm run test:unit',
          lint: 'eslint src --ext .ts,.tsx',
          lintFix: 'eslint src --ext .ts,.tsx --fix',
          typeCheck: 'tsc --noEmit'
        }
      };

      // Write files to temp directory
      await fs.writeFile(path.join(tempDir, 'UNSHALLOW.md'), unshallowContent);
      await fs.writeFile(path.join(tempDir, 'unshallow.json'), JSON.stringify(completeConfig, null, 2));

      // Load both configurations in parallel
      const [projectConfig, envConfig] = await Promise.all([
        configManager.loadProjectConfig(),
        configManager.loadEnvironmentConfig()
      ]);

      // Verify project configuration
      expect(projectConfig.content).toContain('Project Configuration');
      expect(projectConfig.content).toContain('mini tier for planning operations');
      expect(projectConfig.content).toContain('full tier for complex migrations');
      expect(projectConfig.content).toContain('nano tier for simple lint fixes');
      expect(projectConfig.content).toContain('cloud.langfuse.com');
      expect(path.resolve(projectConfig.filePath || '')).toBe(path.resolve(path.join(tempDir, 'UNSHALLOW.md')));

      // Verify environment configuration - API keys
      expect(envConfig.apiKeys.openai).toBe('sk-test-key-12345');
      expect(envConfig.apiKeys.langfuse).toEqual({
        secretKey: 'sk-langfuse-test',
        publicKey: 'pk-langfuse-test',
        baseUrl: 'https://cloud.langfuse.com',
        enabled: true
      });

      // Verify environment configuration - model tiers
      expect(envConfig.modelTiers.plan).toBe('mini');
      expect(envConfig.modelTiers.migrate).toBe('full');
      expect(envConfig.modelTiers.lintFix).toBe('nano');
      expect(envConfig.modelTiers.tsFix).toBe('mini');

      // Verify environment configuration - commands
      expect(envConfig.commands.test).toBe('npm run test:unit');
      expect(envConfig.commands.lint).toBe('eslint src --ext .ts,.tsx');
      expect(envConfig.commands.lintFix).toBe('eslint src --ext .ts,.tsx --fix');
      expect(envConfig.commands.typeCheck).toBe('tsc --noEmit');

      // Validate configuration
      const validation = configManager.validateConfiguration(envConfig);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);

      // Test utility methods - getModelTier for all workflow nodes
      const workflowNodes: WorkflowNode[] = ['plan', 'migrate', 'lint-fix', 'ts-fix'];
      const expectedTiers: ModelTier[] = ['mini', 'full', 'nano', 'mini'];
      
      workflowNodes.forEach((node, index) => {
        const tier = configManager.getModelTier(node, envConfig);
        expect(tier).toBe(expectedTiers[index]);
      });

      // Test utility methods - getCommand for all command types
      const commandTypes: CommandType[] = ['test', 'lint', 'lint-fix', 'type-check'];
      const expectedCommands = [
        'npm run test:unit',
        'eslint src --ext .ts,.tsx',
        'eslint src --ext .ts,.tsx --fix',
        'tsc --noEmit'
      ];

      commandTypes.forEach((commandType, index) => {
        const command = configManager.getCommand(commandType, envConfig);
        expect(command).toBe(expectedCommands[index]);
      });

      // Verify actual file I/O operations occurred
      const actualProjectContent = await fs.readFile(projectConfig.filePath!, 'utf-8');
      expect(actualProjectContent).toBe(unshallowContent);

      // Verify git operations worked
      const gitRoot = await execAsync('git rev-parse --show-toplevel');
      expect(path.resolve(gitRoot.stdout.trim())).toBe(path.resolve(tempDir));
    });
  });

  describe('Minimal Configuration Flow', () => {
    it('should load, validate, and provide access to minimal configuration with defaults end-to-end', async () => {
      // Create minimal UNSHALLOW.md file
      const minimalUnshallowContent = `# Minimal Project

Basic project configuration.
`;

      // Create minimal unshallow.json with only required OpenAI API key
      const minimalConfig = {
        apiKeys: {
          openai: 'sk-minimal-test-key'
        }
      };

      // Write files to temp directory
      await fs.writeFile(path.join(tempDir, 'UNSHALLOW.md'), minimalUnshallowContent);
      await fs.writeFile(path.join(tempDir, 'unshallow.json'), JSON.stringify(minimalConfig, null, 2));

      // Load both configurations in parallel
      const [projectConfig, envConfig] = await Promise.all([
        configManager.loadProjectConfig(),
        configManager.loadEnvironmentConfig()
      ]);

      // Verify project configuration
      expect(projectConfig.content).toContain('Minimal Project');
      expect(projectConfig.content).toContain('Basic project configuration');
      expect(path.resolve(projectConfig.filePath || '')).toBe(path.resolve(path.join(tempDir, 'UNSHALLOW.md')));

      // Verify environment configuration - required API key
      expect(envConfig.apiKeys.openai).toBe('sk-minimal-test-key');
      
      // Verify environment configuration - defaults applied
      expect(envConfig.apiKeys.langfuse).toBeNull();
      
      // Verify default model tiers
      expect(envConfig.modelTiers.plan).toBe('mini');
      expect(envConfig.modelTiers.migrate).toBe('mini');
      expect(envConfig.modelTiers.lintFix).toBe('mini');
      expect(envConfig.modelTiers.tsFix).toBe('mini');

      // Verify default commands
      expect(envConfig.commands.test).toBe('npm test');
      expect(envConfig.commands.lint).toBe('npm run lint');
      expect(envConfig.commands.lintFix).toBe('npm run lint:fix');
      expect(envConfig.commands.typeCheck).toBe('npm run type-check');

      // Validate configuration
      const validation = configManager.validateConfiguration(envConfig);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);

      // Test utility methods - all workflow nodes should return default 'mini'
      const workflowNodes: WorkflowNode[] = ['plan', 'migrate', 'lint-fix', 'ts-fix'];
      
      workflowNodes.forEach(node => {
        const tier = configManager.getModelTier(node, envConfig);
        expect(tier).toBe('mini'); // All defaults should be 'mini'
      });

      // Test utility methods - all commands should return defaults
      const expectedDefaults = {
        test: 'npm test',
        lint: 'npm run lint',
        'lint-fix': 'npm run lint:fix',
        'type-check': 'npm run type-check'
      };

      Object.entries(expectedDefaults).forEach(([commandType, expectedCommand]) => {
        const command = configManager.getCommand(commandType as CommandType, envConfig);
        expect(command).toBe(expectedCommand);
      });

      // Verify actual file I/O operations occurred
      const actualProjectContent = await fs.readFile(projectConfig.filePath!, 'utf-8');
      expect(actualProjectContent).toBe(minimalUnshallowContent);

      // Verify git operations worked
      const gitRoot = await execAsync('git rev-parse --show-toplevel');
      expect(path.resolve(gitRoot.stdout.trim())).toBe(path.resolve(tempDir));
    });
  });
});