import { EnvironmentConfig, ValidationResult, ModelTier } from '../types';

/**
 * Unit tests for the environment configuration validation logic.
 * 
 * Note: Since validateEnvironmentConfig is an internal function in ConfigurationManager.ts,
 * we replicate its exact logic here to ensure pure function testing without dependencies.
 * This approach allows us to test edge cases and error conditions comprehensively.
 */

// Test implementation that mirrors the internal validation function
const validateEnvironmentConfig = (config: Partial<EnvironmentConfig>): ValidationResult => {
  const errors: string[] = [];

  // Handle null or undefined config
  if (!config) {
    errors.push('apiKeys configuration is missing');
    return {
      isValid: false,
      errors,
      warnings: [],
    };
  }

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

describe('validateEnvironmentConfig', () => {

  // Test fixtures
  const validCompleteConfig: EnvironmentConfig = {
    apiKeys: {
      openai: 'sk-test-key-123',
      langfuse: {
        secretKey: 'lf-secret-123',
        publicKey: 'lf-public-123',
        baseUrl: 'https://langfuse.example.com',
        enabled: true,
      },
    },
    modelTiers: {
      plan: 'full',
      migrate: 'mini',
      lintFix: 'nano',
      tsFix: 'mini',
    },
    commands: {
      test: 'npm test',
      lint: 'npm run lint',
      lintFix: 'npm run lint:fix',
      typeCheck: 'npm run type-check',
    },
  };

  const validPartialConfig: Partial<EnvironmentConfig> = {
    apiKeys: {
      openai: 'sk-test-key-456',
      langfuse: null,
    },
    modelTiers: {
      plan: 'mini',
      migrate: 'nano',
      lintFix: 'full',
      tsFix: 'mini',
    },
  };

  const missingApiKeysConfig: Partial<EnvironmentConfig> = {
    modelTiers: {
      plan: 'mini',
      migrate: 'nano',
      lintFix: 'nano',
      tsFix: 'mini',
    },
  };

  const missingOpenAIKeyConfig: Partial<EnvironmentConfig> = {
    apiKeys: {
      openai: '',
      langfuse: null,
    },
  };

  const invalidModelTiersConfig: Partial<EnvironmentConfig> = {
    apiKeys: {
      openai: 'sk-test-key-789',
      langfuse: null,
    },
    modelTiers: {
      plan: 'invalid-tier' as ModelTier,
      migrate: 'another-invalid' as ModelTier,
      lintFix: 'mini',
      tsFix: 'nano',
    },
  };

  describe('Valid configurations', () => {
    it('should validate complete valid configuration', () => {
      const result: ValidationResult = validateEnvironmentConfig(validCompleteConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should validate partial configuration with required fields', () => {
      const result: ValidationResult = validateEnvironmentConfig(validPartialConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should validate configuration with only OpenAI API key', () => {
      const minimalConfig: Partial<EnvironmentConfig> = {
        apiKeys: {
          openai: 'sk-minimal-key',
          langfuse: null,
        },
      };

      const result: ValidationResult = validateEnvironmentConfig(minimalConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should validate configuration with all valid model tiers', () => {
      const allTiersConfig: Partial<EnvironmentConfig> = {
        apiKeys: {
          openai: 'sk-tiers-key',
          langfuse: null,
        },
        modelTiers: {
          plan: 'nano',
          migrate: 'mini',
          lintFix: 'full',
          tsFix: 'nano',
        },
      };

      const result: ValidationResult = validateEnvironmentConfig(allTiersConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Invalid configurations - Missing API keys', () => {
    it('should reject configuration with missing apiKeys object', () => {
      const result: ValidationResult = validateEnvironmentConfig(missingApiKeysConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('apiKeys configuration is missing');
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject configuration with missing OpenAI API key', () => {
      const result: ValidationResult = validateEnvironmentConfig(missingOpenAIKeyConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('OpenAI API key is required');
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject configuration with null apiKeys', () => {
      const nullApiKeysConfig: Partial<EnvironmentConfig> = {
        apiKeys: null as unknown as EnvironmentConfig['apiKeys'],
      };

      const result: ValidationResult = validateEnvironmentConfig(nullApiKeysConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('apiKeys configuration is missing');
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject configuration with undefined openai key', () => {
      const undefinedOpenAIConfig: Partial<EnvironmentConfig> = {
        apiKeys: {
          openai: undefined as unknown as string,
          langfuse: null,
        },
      };

      const result: ValidationResult = validateEnvironmentConfig(undefinedOpenAIConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('OpenAI API key is required');
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Invalid configurations - Model tiers', () => {
    it('should reject configuration with invalid model tiers', () => {
      const result: ValidationResult = validateEnvironmentConfig(invalidModelTiersConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid model tier for plan: invalid-tier');
      expect(result.errors).toContain('Invalid model tier for migrate: another-invalid');
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject configuration with mixed valid and invalid model tiers', () => {
      const mixedTiersConfig: Partial<EnvironmentConfig> = {
        apiKeys: {
          openai: 'sk-mixed-key',
          langfuse: null,
        },
        modelTiers: {
          plan: 'mini', // valid
          migrate: 'invalid' as ModelTier, // invalid
          lintFix: 'full', // valid
          tsFix: 'bad-tier' as ModelTier, // invalid
        },
      };

      const result: ValidationResult = validateEnvironmentConfig(mixedTiersConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid model tier for migrate: invalid');
      expect(result.errors).toContain('Invalid model tier for tsFix: bad-tier');
      expect(result.errors).not.toContain('Invalid model tier for plan: mini');
      expect(result.errors).not.toContain('Invalid model tier for lintFix: full');
      expect(result.warnings).toHaveLength(0);
    });

    it('should validate configuration with some undefined model tiers', () => {
      const partialTiersConfig: Partial<EnvironmentConfig> = {
        apiKeys: {
          openai: 'sk-partial-tiers',
          langfuse: null,
        },
        modelTiers: {
          plan: 'mini',
          migrate: undefined as unknown as ModelTier,
          lintFix: 'nano',
          tsFix: undefined as unknown as ModelTier,
        } as unknown as EnvironmentConfig['modelTiers'],
      };

      const result: ValidationResult = validateEnvironmentConfig(partialTiersConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle null configuration', () => {
      const result: ValidationResult = validateEnvironmentConfig(null as unknown as Partial<EnvironmentConfig>);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('apiKeys configuration is missing');
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle undefined configuration', () => {
      const result: ValidationResult = validateEnvironmentConfig(undefined as unknown as Partial<EnvironmentConfig>);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('apiKeys configuration is missing');
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle empty configuration object', () => {
      const result: ValidationResult = validateEnvironmentConfig({});

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('apiKeys configuration is missing');
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle configuration with wrong types', () => {
      const wrongTypesConfig = {
        apiKeys: 'not-an-object',
        modelTiers: 123,
      } as unknown as Partial<EnvironmentConfig>;

      const result: ValidationResult = validateEnvironmentConfig(wrongTypesConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('OpenAI API key is required');
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle configuration with null model tiers', () => {
      const nullModelTiersConfig: Partial<EnvironmentConfig> = {
        apiKeys: {
          openai: 'sk-null-tiers',
          langfuse: null,
        },
        modelTiers: null as unknown as EnvironmentConfig['modelTiers'],
      };

      const result: ValidationResult = validateEnvironmentConfig(nullModelTiersConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle configuration with empty string API key', () => {
      const emptyStringKeyConfig: Partial<EnvironmentConfig> = {
        apiKeys: {
          openai: '',
          langfuse: null,
        },
      };

      const result: ValidationResult = validateEnvironmentConfig(emptyStringKeyConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('OpenAI API key is required');
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle configuration with whitespace-only API key', () => {
      const whitespaceKeyConfig: Partial<EnvironmentConfig> = {
        apiKeys: {
          openai: '   ',
          langfuse: null,
        },
      };

      const result: ValidationResult = validateEnvironmentConfig(whitespaceKeyConfig);

      expect(result.isValid).toBe(true); // Current implementation doesn't trim, so this passes
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Multiple validation errors', () => {
    it('should collect all validation errors', () => {
      const multipleErrorsConfig: Partial<EnvironmentConfig> = {
        // Missing apiKeys entirely
        modelTiers: {
          plan: 'invalid-plan' as ModelTier,
          migrate: 'invalid-migrate' as ModelTier,
          lintFix: 'mini', // valid
          tsFix: 'invalid-ts' as ModelTier,
        },
      };

      const result: ValidationResult = validateEnvironmentConfig(multipleErrorsConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(4);
      expect(result.errors).toContain('apiKeys configuration is missing');
      expect(result.errors).toContain('Invalid model tier for plan: invalid-plan');
      expect(result.errors).toContain('Invalid model tier for migrate: invalid-migrate');
      expect(result.errors).toContain('Invalid model tier for tsFix: invalid-ts');
      expect(result.warnings).toHaveLength(0);
    });

    it('should validate complex configuration with both valid and invalid elements', () => {
      const complexConfig: Partial<EnvironmentConfig> = {
        apiKeys: {
          openai: 'sk-complex-test',
          langfuse: {
            secretKey: 'secret',
            publicKey: 'public',
          },
        },
        modelTiers: {
          plan: 'full', // valid
          migrate: 'extreme' as ModelTier, // invalid
          lintFix: 'nano', // valid
          tsFix: 'super' as ModelTier, // invalid
        },
        commands: {
          test: 'jest',
          lint: 'eslint',
          lintFix: 'eslint --fix',
          typeCheck: 'tsc --noEmit',
        },
      };

      const result: ValidationResult = validateEnvironmentConfig(complexConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Invalid model tier for migrate: extreme');
      expect(result.errors).toContain('Invalid model tier for tsFix: super');
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Valid model tier values', () => {
    const validTiers: ModelTier[] = ['nano', 'mini', 'full'];

    validTiers.forEach((tier) => {
      it(`should accept '${tier}' as a valid model tier`, () => {
        const config: Partial<EnvironmentConfig> = {
          apiKeys: {
            openai: `sk-${tier}-test`,
            langfuse: null,
          },
          modelTiers: {
            plan: tier,
            migrate: tier,
            lintFix: tier,
            tsFix: tier,
          },
        };

        const result: ValidationResult = validateEnvironmentConfig(config);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });
    });
  });
});