// Configuration models
export interface ProjectConfig {
  content: string; // Raw text content of UNSHALLOW.md
  filePath?: string;
}

export interface EnvironmentConfig {
  apiKeys: {
    openai: string;
    langfuse: LangfuseConfig | null;
  };
  modelTiers: {
    plan: ModelTier; // ReAct agent for planning
    migrate: ModelTier; // ReAct agent for migration
    lintFix: ModelTier; // ReAct agent for lint fixing
    tsFix: ModelTier; // ReAct agent for TypeScript fixing
  };
  commands: {
    test: string;
    lint: string;
    lintFix: string;
    typeCheck: string;
  };
}

// Supporting types
export type ModelTier = 'nano' | 'mini' | 'full';
export type WorkflowNode = 'plan' | 'migrate' | 'lint-fix' | 'ts-fix';
export type CommandType = 'test' | 'lint' | 'lint-fix' | 'type-check';

export interface LangfuseConfig {
  secretKey: string;
  publicKey: string;
  baseUrl?: string;
  enabled?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Function signatures
export type ConfigLoader = (
  projectRoot: string
) => Promise<EnvironmentConfig | ProjectConfig>;
export type ConfigValidator = (
  config: Partial<EnvironmentConfig>
) => ValidationResult;
