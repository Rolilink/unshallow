import { jest } from '@jest/globals';
import { ConfigurationManager } from '../ConfigurationManager.js';
import { FileSystem } from '../../file-system/index.js';
import { GitRepository } from '../../git/index.js';
import {
  EnvironmentConfig,
  ProjectConfig,
  ModelTier,
  WorkflowNode,
  CommandType,
  ValidationResult,
} from '../types.js';

// Mock the dependencies
jest.mock('../../file-system/index.js');
jest.mock('../../git/index.js');

const MockedFileSystem = FileSystem as jest.MockedClass<typeof FileSystem>;
const MockedGitRepository = GitRepository as jest.MockedClass<
  typeof GitRepository
>;

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  let mockFileSystem: jest.Mocked<FileSystem>;
  let mockGitRepository: jest.Mocked<GitRepository>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockFileSystem = new MockedFileSystem() as jest.Mocked<FileSystem>;
    mockGitRepository = new MockedGitRepository() as jest.Mocked<GitRepository>;

    // Configure mocks to return instances
    MockedFileSystem.mockImplementation(() => mockFileSystem);
    MockedGitRepository.mockImplementation(() => mockGitRepository);

    configManager = new ConfigurationManager();
  });

  describe('constructor', () => {
    it('should create FileSystem and GitRepository instances', () => {
      // Clear previous calls and create a new instance to test constructor
      jest.clearAllMocks();
      
      new ConfigurationManager();
      
      expect(MockedFileSystem).toHaveBeenCalledTimes(1);
      expect(MockedGitRepository).toHaveBeenCalledTimes(1);
    });
  });

  describe('loadProjectConfig', () => {
    const mockRoot = '/mock/project/root';
    const expectedConfigPath = '/mock/project/root/UNSHALLOW.md';
    const mockContent = '# Project Configuration\nThis is the project config.';

    beforeEach(() => {
      mockGitRepository.getRoot.mockResolvedValue(mockRoot);
    });

    it('should successfully load project configuration', async () => {
      mockFileSystem.read.mockResolvedValue(mockContent);

      const result: ProjectConfig = await configManager.loadProjectConfig();

      expect(mockGitRepository.getRoot).toHaveBeenCalledTimes(1);
      expect(mockFileSystem.read).toHaveBeenCalledWith(expectedConfigPath);
      expect(result).toEqual({
        content: mockContent,
        filePath: expectedConfigPath,
      });
    });

    it('should throw error when file is missing', async () => {
      const fileError = new Error('ENOENT: no such file or directory');
      mockFileSystem.read.mockRejectedValue(fileError);

      await expect(configManager.loadProjectConfig()).rejects.toThrow(
        `Failed to load project configuration from ${expectedConfigPath}: ENOENT: no such file or directory`
      );

      expect(mockGitRepository.getRoot).toHaveBeenCalledTimes(1);
      expect(mockFileSystem.read).toHaveBeenCalledWith(expectedConfigPath);
    });

    it('should handle non-Error exceptions', async () => {
      mockFileSystem.read.mockRejectedValue('Unknown error');

      await expect(configManager.loadProjectConfig()).rejects.toThrow(
        `Failed to load project configuration from ${expectedConfigPath}: Unknown error`
      );
    });

    it('should handle git repository errors', async () => {
      mockGitRepository.getRoot.mockRejectedValue(new Error('Not a git repo'));

      await expect(configManager.loadProjectConfig()).rejects.toThrow(
        'Not a git repo'
      );
    });
  });

  describe('loadEnvironmentConfig', () => {
    const mockRoot = '/mock/project/root';
    const expectedConfigPath = '/mock/project/root/unshallow.json';

    beforeEach(() => {
      mockGitRepository.getRoot.mockResolvedValue(mockRoot);
    });

    it('should successfully load valid complete configuration', async () => {
      const mockUserConfig = {
        apiKeys: {
          openai: 'sk-test-openai-key',
          langfuse: {
            secretKey: 'sk-test-langfuse',
            publicKey: 'pk-test-langfuse',
            baseUrl: 'https://custom.langfuse.com',
            enabled: true,
          },
        },
        modelTiers: {
          plan: 'full' as ModelTier,
          migrate: 'mini' as ModelTier,
          lintFix: 'nano' as ModelTier,
          tsFix: 'full' as ModelTier,
        },
        commands: {
          test: 'yarn test',
          lint: 'yarn lint',
          lintFix: 'yarn lint:fix',
          typeCheck: 'yarn type-check',
        },
      };

      mockFileSystem.readAsJson.mockResolvedValue(mockUserConfig);

      const result: EnvironmentConfig = await configManager.loadEnvironmentConfig();

      expect(mockGitRepository.getRoot).toHaveBeenCalledTimes(1);
      expect(mockFileSystem.readAsJson).toHaveBeenCalledWith(expectedConfigPath);
      expect(result).toEqual({
        apiKeys: {
          openai: 'sk-test-openai-key',
          langfuse: {
            secretKey: 'sk-test-langfuse',
            publicKey: 'pk-test-langfuse',
            baseUrl: 'https://custom.langfuse.com',
            enabled: true,
          },
        },
        modelTiers: {
          plan: 'full',
          migrate: 'mini',
          lintFix: 'nano',
          tsFix: 'full',
        },
        commands: {
          test: 'yarn test',
          lint: 'yarn lint',
          lintFix: 'yarn lint:fix',
          typeCheck: 'yarn type-check',
        },
      });
    });

    it('should merge partial configuration with defaults', async () => {
      const mockUserConfig = {
        apiKeys: {
          openai: 'sk-test-openai-key',
        },
        modelTiers: {
          plan: 'full' as ModelTier,
        },
        commands: {
          test: 'jest',
        },
      };

      mockFileSystem.readAsJson.mockResolvedValue(mockUserConfig);

      const result: EnvironmentConfig = await configManager.loadEnvironmentConfig();

      expect(result).toEqual({
        apiKeys: {
          openai: 'sk-test-openai-key',
          langfuse: null,
        },
        modelTiers: {
          plan: 'full',
          migrate: 'mini',
          lintFix: 'mini',
          tsFix: 'mini',
        },
        commands: {
          test: 'jest',
          lint: 'npm run lint',
          lintFix: 'npm run lint:fix',
          typeCheck: 'npm run type-check',
        },
      });
    });

    it('should throw error when OpenAI API key is missing', async () => {
      const mockUserConfig = {
        apiKeys: {
          langfuse: null,
        },
        modelTiers: {
          plan: 'mini' as ModelTier,
        },
      };

      mockFileSystem.readAsJson.mockResolvedValue(mockUserConfig);

      await expect(configManager.loadEnvironmentConfig()).rejects.toThrow(
        `Failed to load environment configuration from ${expectedConfigPath}: OpenAI API key is required in unshallow.json`
      );
    });

    it('should throw error when apiKeys is missing', async () => {
      const mockUserConfig = {
        modelTiers: {
          plan: 'mini' as ModelTier,
        },
      };

      mockFileSystem.readAsJson.mockResolvedValue(mockUserConfig);

      await expect(configManager.loadEnvironmentConfig()).rejects.toThrow(
        `Failed to load environment configuration from ${expectedConfigPath}: OpenAI API key is required in unshallow.json`
      );
    });

    it('should throw error when apiKeys.openai is null', async () => {
      const mockUserConfig = {
        apiKeys: {
          openai: null,
        },
      };

      mockFileSystem.readAsJson.mockResolvedValue(mockUserConfig);

      await expect(configManager.loadEnvironmentConfig()).rejects.toThrow(
        `Failed to load environment configuration from ${expectedConfigPath}: OpenAI API key is required in unshallow.json`
      );
    });

    it('should handle file read errors', async () => {
      const fileError = new Error('ENOENT: no such file or directory');
      mockFileSystem.readAsJson.mockRejectedValue(fileError);

      await expect(configManager.loadEnvironmentConfig()).rejects.toThrow(
        `Failed to load environment configuration from ${expectedConfigPath}: ENOENT: no such file or directory`
      );
    });

    it('should handle JSON parse errors', async () => {
      const parseError = new SyntaxError('Unexpected token } in JSON');
      mockFileSystem.readAsJson.mockRejectedValue(parseError);

      await expect(configManager.loadEnvironmentConfig()).rejects.toThrow(
        `Failed to load environment configuration from ${expectedConfigPath}: Unexpected token } in JSON`
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockFileSystem.readAsJson.mockRejectedValue('Unknown error');

      await expect(configManager.loadEnvironmentConfig()).rejects.toThrow(
        `Failed to load environment configuration from ${expectedConfigPath}: Unknown error`
      );
    });
  });

  describe('getModelTier', () => {
    const mockConfig: EnvironmentConfig = {
      apiKeys: {
        openai: 'sk-test-key',
        langfuse: null,
      },
      modelTiers: {
        plan: 'full',
        migrate: 'mini',
        lintFix: 'nano',
        tsFix: 'full',
      },
      commands: {
        test: 'npm test',
        lint: 'npm run lint',
        lintFix: 'npm run lint:fix',
        typeCheck: 'npm run type-check',
      },
    };

    it('should return correct model tier for plan node', () => {
      const result = configManager.getModelTier('plan', mockConfig);
      expect(result).toBe('full');
    });

    it('should return correct model tier for migrate node', () => {
      const result = configManager.getModelTier('migrate', mockConfig);
      expect(result).toBe('mini');
    });

    it('should return correct model tier for lint-fix node', () => {
      const result = configManager.getModelTier('lint-fix', mockConfig);
      expect(result).toBe('nano');
    });

    it('should return correct model tier for ts-fix node', () => {
      const result = configManager.getModelTier('ts-fix', mockConfig);
      expect(result).toBe('full');
    });

    it('should return fallback tier when node tier is not configured', () => {
      const configWithMissingTier: EnvironmentConfig = {
        ...mockConfig,
        modelTiers: {
          plan: 'full',
          migrate: 'mini',
          lintFix: 'nano',
          // tsFix is missing
        } as unknown as EnvironmentConfig['modelTiers'],
      };

      const result = configManager.getModelTier('ts-fix', configWithMissingTier);
      expect(result).toBe('mini');
    });

    it('should handle all workflow node types', () => {
      const workflowNodes: WorkflowNode[] = ['plan', 'migrate', 'lint-fix', 'ts-fix'];
      
      workflowNodes.forEach((node) => {
        const result = configManager.getModelTier(node, mockConfig);
        expect(['nano', 'mini', 'full']).toContain(result);
      });
    });
  });

  describe('getCommand', () => {
    const mockConfig: EnvironmentConfig = {
      apiKeys: {
        openai: 'sk-test-key',
        langfuse: null,
      },
      modelTiers: {
        plan: 'mini',
        migrate: 'mini',
        lintFix: 'mini',
        tsFix: 'mini',
      },
      commands: {
        test: 'jest --coverage',
        lint: 'eslint src/',
        lintFix: 'eslint src/ --fix',
        typeCheck: 'tsc --noEmit',
      },
    };

    it('should return correct command for test', () => {
      const result = configManager.getCommand('test', mockConfig);
      expect(result).toBe('jest --coverage');
    });

    it('should return correct command for lint', () => {
      const result = configManager.getCommand('lint', mockConfig);
      expect(result).toBe('eslint src/');
    });

    it('should return correct command for lint-fix', () => {
      const result = configManager.getCommand('lint-fix', mockConfig);
      expect(result).toBe('eslint src/ --fix');
    });

    it('should return correct command for type-check', () => {
      const result = configManager.getCommand('type-check', mockConfig);
      expect(result).toBe('tsc --noEmit');
    });

    it('should handle all command types', () => {
      const commandTypes: CommandType[] = ['test', 'lint', 'lint-fix', 'type-check'];
      
      commandTypes.forEach((commandType) => {
        const result = configManager.getCommand(commandType, mockConfig);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  describe('validateConfiguration', () => {
    it('should validate a complete valid configuration', () => {
      const validConfig: EnvironmentConfig = {
        apiKeys: {
          openai: 'sk-test-key',
          langfuse: {
            secretKey: 'sk-langfuse',
            publicKey: 'pk-langfuse',
          },
        },
        modelTiers: {
          plan: 'full',
          migrate: 'mini',
          lintFix: 'nano',
          tsFix: 'full',
        },
        commands: {
          test: 'npm test',
          lint: 'npm run lint',
          lintFix: 'npm run lint:fix',
          typeCheck: 'npm run type-check',
        },
      };

      const result: ValidationResult = configManager.validateConfiguration(validConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should return errors for missing apiKeys', () => {
      const invalidConfig = {} as EnvironmentConfig;

      const result: ValidationResult = configManager.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('apiKeys configuration is missing');
    });

    it('should return errors for missing OpenAI API key', () => {
      const invalidConfig = {
        apiKeys: {
          langfuse: null,
        },
      } as EnvironmentConfig;

      const result: ValidationResult = configManager.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('OpenAI API key is required');
    });

    it('should return errors for invalid model tiers', () => {
      const invalidConfig = {
        apiKeys: {
          openai: 'sk-test-key',
          langfuse: null,
        },
        modelTiers: {
          plan: 'invalid-tier' as ModelTier,
          migrate: 'another-invalid' as ModelTier,
          lintFix: 'mini',
          tsFix: 'full',
        },
      } as EnvironmentConfig;

      const result: ValidationResult = configManager.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid model tier for plan: invalid-tier');
      expect(result.errors).toContain('Invalid model tier for migrate: another-invalid');
    });

    it('should validate configuration with valid model tiers', () => {
      const validConfig = {
        apiKeys: {
          openai: 'sk-test-key',
          langfuse: null,
        },
        modelTiers: {
          plan: 'nano' as ModelTier,
          migrate: 'mini' as ModelTier,
          lintFix: 'full' as ModelTier,
          tsFix: 'nano' as ModelTier,
        },
      } as EnvironmentConfig;

      const result: ValidationResult = configManager.validateConfiguration(validConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle partial model tiers configuration', () => {
      const configWithPartialTiers = {
        apiKeys: {
          openai: 'sk-test-key',
          langfuse: null,
        },
        modelTiers: {
          plan: 'mini' as ModelTier,
          // Other tiers missing
        },
      } as EnvironmentConfig;

      const result: ValidationResult = configManager.validateConfiguration(configWithPartialTiers);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should accumulate multiple validation errors', () => {
      const invalidConfig = {
        modelTiers: {
          plan: 'invalid1' as ModelTier,
          migrate: 'invalid2' as ModelTier,
          lintFix: 'invalid3' as ModelTier,
          tsFix: 'valid-mini' as ModelTier, // This one is invalid too
        },
      } as EnvironmentConfig;

      const result: ValidationResult = configManager.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(5); // 1 for missing apiKeys + 4 for invalid tiers
      expect(result.errors).toContain('apiKeys configuration is missing');
      expect(result.errors).toContain('Invalid model tier for plan: invalid1');
      expect(result.errors).toContain('Invalid model tier for migrate: invalid2');
      expect(result.errors).toContain('Invalid model tier for lintFix: invalid3');
      expect(result.errors).toContain('Invalid model tier for tsFix: valid-mini');
    });

    it('should handle null model tiers gracefully', () => {
      const configWithNullTiers = {
        apiKeys: {
          openai: 'sk-test-key',
          langfuse: null,
        },
        modelTiers: {
          plan: null as unknown as ModelTier,
          migrate: 'mini' as ModelTier,
          lintFix: undefined as unknown as ModelTier,
          tsFix: 'full' as ModelTier,
        },
      } as EnvironmentConfig;

      const result: ValidationResult = configManager.validateConfiguration(configWithNullTiers);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('integration tests', () => {
    it('should work end-to-end with valid configuration', async () => {
      const mockRoot = '/test/project';
      const mockProjectContent = '# Test Project\nConfiguration content';
      const mockEnvConfig = {
        apiKeys: {
          openai: 'sk-test-key',
        },
        modelTiers: {
          plan: 'full' as ModelTier,
        },
      };

      mockGitRepository.getRoot.mockResolvedValue(mockRoot);
      mockFileSystem.read.mockResolvedValue(mockProjectContent);
      mockFileSystem.readAsJson.mockResolvedValue(mockEnvConfig);

      // Load project config
      const projectConfig = await configManager.loadProjectConfig();
      expect(projectConfig.content).toBe(mockProjectContent);
      expect(projectConfig.filePath).toBe('/test/project/UNSHALLOW.md');

      // Load environment config
      const envConfig = await configManager.loadEnvironmentConfig();
      expect(envConfig.apiKeys.openai).toBe('sk-test-key');

      // Test getModelTier with loaded config
      const tier = configManager.getModelTier('plan', envConfig);
      expect(tier).toBe('full');

      // Test getCommand with loaded config
      const command = configManager.getCommand('test', envConfig);
      expect(command).toBe('npm test'); // Default value

      // Validate the configuration
      const validation = configManager.validateConfiguration(envConfig);
      expect(validation.isValid).toBe(true);
    });

    it('should handle cascade of errors gracefully', async () => {
      const mockRoot = '/test/project';
      
      mockGitRepository.getRoot.mockResolvedValue(mockRoot);
      mockFileSystem.read.mockRejectedValue(new Error('Project config not found'));
      mockFileSystem.readAsJson.mockRejectedValue(new Error('Environment config not found'));

      // Both config loads should fail
      await expect(configManager.loadProjectConfig()).rejects.toThrow('Project config not found');
      await expect(configManager.loadEnvironmentConfig()).rejects.toThrow('Environment config not found');
    });
  });
});