import { FileSystem } from '../file-system';
import { GitRepository } from '../git';
import {
  EnvironmentConfig,
  ValidationResult,
  ModelTier,
  WorkflowNode,
  CommandType,
  ProjectConfig,
} from './types';
import * as path from 'path';

const validateEnvironmentConfig = (
  config: Partial<EnvironmentConfig>
): ValidationResult => {
  const errors: string[] = [];

  // Check API keys
  if (!config.apiKeys) {
    errors.push('apiKeys configuration is missing');
  } else if (!config.apiKeys.openai) {
    errors.push('OpenAI API key is required');
  }

  // Check model tiers
  const validTiers: ModelTier[] = ['nano', 'mini', 'full'];
  if (config.modelTiers) {
    const tiers = config.modelTiers;
    Object.entries(tiers).forEach(([node, tier]) => {
      if (tier && !validTiers.includes(tier)) {
        errors.push(`Invalid model tier for ${node}: ${tier}`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [],
  };
};

const getDefaultEnvironmentConfig = () => ({
  apiKeys: {
    langfuse: null,
  },
  modelTiers: {
    plan: 'mini',
    migrate: 'mini',
    lintFix: 'mini',
    tsFix: 'mini',
  },
  commands: {
    test: 'npm test',
    lint: 'npm run lint',
    lintFix: 'npm run lint:fix',
    typeCheck: 'npm run type-check',
  },
});

export class ConfigurationManager {
  private fileSystem: FileSystem;
  private gitRepository: GitRepository;

  constructor() {
    this.fileSystem = new FileSystem();
    this.gitRepository = new GitRepository();
  }

  async loadProjectConfig(): Promise<ProjectConfig> {
    const root = await this.gitRepository.getRoot();
    const configPath = path.join(root, 'UNSHALLOW.md');

    try {
      const content = await this.fileSystem.read(configPath);
      return { content, filePath: configPath };
    } catch (error) {
      throw new Error(
        `Failed to load project configuration from ${configPath}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  async loadEnvironmentConfig(): Promise<EnvironmentConfig> {
    const root = await this.gitRepository.getRoot();
    const configPath = path.join(root, 'unshallow.json');

    try {
      const userConfig = await this.fileSystem.readAsJson<
        Partial<EnvironmentConfig>
      >(configPath);

      // Extract required openai key and merge with defaults using destructuring
      const { apiKeys, ...restConfig } = userConfig;

      if (!apiKeys?.openai) {
        throw new Error('OpenAI API key is required in unshallow.json');
      }

      const defaults = getDefaultEnvironmentConfig();

      // Merge configurations with proper destructuring
      return {
        ...defaults,
        ...restConfig,
        apiKeys: {
          openai: apiKeys.openai,
          langfuse: apiKeys.langfuse || defaults.apiKeys!.langfuse,
        },
        modelTiers: {
          ...defaults.modelTiers!,
          ...restConfig.modelTiers,
        },
        commands: {
          ...defaults.commands!,
          ...restConfig.commands,
        },
      } as EnvironmentConfig;
    } catch (error) {
      throw new Error(
        `Failed to load environment configuration from ${configPath}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  getModelTier(
    workflowNode: WorkflowNode,
    config: EnvironmentConfig
  ): ModelTier {
    const nodeMap: Record<WorkflowNode, keyof EnvironmentConfig['modelTiers']> =
      {
        plan: 'plan',
        migrate: 'migrate',
        'lint-fix': 'lintFix',
        'ts-fix': 'tsFix',
      };

    return config.modelTiers[nodeMap[workflowNode]] || 'mini';
  }

  getCommand(commandType: CommandType, config: EnvironmentConfig): string {
    const commandMap: Record<CommandType, keyof EnvironmentConfig['commands']> =
      {
        test: 'test',
        lint: 'lint',
        'lint-fix': 'lintFix',
        'type-check': 'typeCheck',
      };

    return config.commands[commandMap[commandType]];
  }

  validateConfiguration(config: EnvironmentConfig): ValidationResult {
    return validateEnvironmentConfig(config);
  }
}
