/**
 * ContextFinder component for locating context lines in files with fuzzy matching.
 * 
 * Implements the core context-based matching algorithm that enables robust
 * patch application by finding code locations using surrounding context
 * instead of brittle line numbers.
 */

import {
  FuzzyMatchingConfig,
  PatchOptions
} from './types';

/**
 * Result of context search operation
 */
export interface ContextMatch {
  /** Index where context was found (-1 if not found) */
  index: number;
  /** Fuzz score achieved during matching (0 = exact, higher = more fuzzy) */
  fuzzScore: number;
  /** Whether the match was found at end-of-file */
  isEofMatch: boolean;
  /** Which matching strategy was successful */
  matchStrategy: 'exact' | 'trailing-whitespace' | 'all-whitespace' | 'eof' | 'none';
  /** Number of search attempts made */
  searchAttempts: number;
}

/**
 * ContextFinder component for finding code locations using fuzzy matching.
 * Implements progressive matching strategies from exact to increasingly fuzzy.
 */
export class ContextFinder {
  private readonly config: FuzzyMatchingConfig;

  constructor(options: PatchOptions) {
    this.config = options.fuzzyMatching;
  }

  /**
   * Find context lines in file content with fuzzy matching support
   */
  async findContext(
    fileContent: string,
    contextLines: string[]
  ): Promise<ContextMatch> {
    // Handle empty context
    if (contextLines.length === 0) {
      return {
        index: 0,
        fuzzScore: 0,
        isEofMatch: false,
        matchStrategy: 'exact',
        searchAttempts: 0
      };
    }

    const fileLines = fileContent.split('\n');
    let searchAttempts = 0;

    // If fuzzy matching is disabled, only try exact match
    if (!this.config.enabled) {
      searchAttempts++;
      const exactMatch = this.findExactMatch(fileLines, contextLines, 0);
      return {
        index: exactMatch.index,
        fuzzScore: exactMatch.fuzzScore,
        isEofMatch: false,
        matchStrategy: exactMatch.index !== -1 ? 'exact' : 'none',
        searchAttempts
      };
    }

    // Progressive fuzzy matching strategies
    const strategies = [
      { name: 'exact' as const, method: (lines: string[], context: string[], start: number) => this.findExactMatch(lines, context, start) },
      { name: 'trailing-whitespace' as const, method: (lines: string[], context: string[], start: number) => this.findTrailingWhitespaceMatch(lines, context, start) },
      { name: 'all-whitespace' as const, method: (lines: string[], context: string[], start: number) => this.findAllWhitespaceMatch(lines, context, start) }
    ];

    // Try each strategy in order
    for (const strategy of strategies) {
      searchAttempts++;
      const result = strategy.method(fileLines, contextLines, 0);
      
      if (result.index !== -1 && result.fuzzScore <= this.config.maxFuzzScore) {
        return {
          index: result.index,
          fuzzScore: result.fuzzScore,
          isEofMatch: false,
          matchStrategy: strategy.name,
          searchAttempts
        };
      }
    }

    // Try EOF matching if enabled
    if (this.config.handleEofContext) {
      searchAttempts++;
      const eofResult = this.findEofMatch(fileLines, contextLines);
      if (eofResult.index !== -1) {
        return {
          index: eofResult.index,
          fuzzScore: eofResult.fuzzScore,
          isEofMatch: true,
          matchStrategy: 'eof',
          searchAttempts
        };
      }
    }

    // No match found
    return {
      index: -1,
      fuzzScore: 0,
      isEofMatch: false,
      matchStrategy: 'none',
      searchAttempts
    };
  }

  /**
   * Find exact string match
   */
  private findExactMatch(
    fileLines: string[],
    contextLines: string[],
    startIndex: number
  ): { index: number; fuzzScore: number } {
    for (let i = startIndex; i <= fileLines.length - contextLines.length; i++) {
      const slice = fileLines.slice(i, i + contextLines.length);
      if (this.arraysEqual(slice, contextLines)) {
        return { index: i, fuzzScore: 0 };
      }
    }
    return { index: -1, fuzzScore: 0 };
  }

  /**
   * Find match ignoring trailing whitespace
   */
  private findTrailingWhitespaceMatch(
    fileLines: string[],
    contextLines: string[],
    startIndex: number
  ): { index: number; fuzzScore: number } {
    if (!this.config.ignoreTrailingWhitespace) {
      return { index: -1, fuzzScore: 0 };
    }

    for (let i = startIndex; i <= fileLines.length - contextLines.length; i++) {
      const slice = fileLines.slice(i, i + contextLines.length);
      const sliceRTrimmed = slice.map(line => line.replace(/\s+$/, ''));
      const contextRTrimmed = contextLines.map(line => line.replace(/\s+$/, ''));
      
      if (this.arraysEqual(sliceRTrimmed, contextRTrimmed)) {
        return { index: i, fuzzScore: 1 };
      }
    }
    return { index: -1, fuzzScore: 0 };
  }

  /**
   * Find match ignoring all whitespace differences
   */
  private findAllWhitespaceMatch(
    fileLines: string[],
    contextLines: string[],
    startIndex: number
  ): { index: number; fuzzScore: number } {
    if (!this.config.ignoreAllWhitespace) {
      return { index: -1, fuzzScore: 0 };
    }

    for (let i = startIndex; i <= fileLines.length - contextLines.length; i++) {
      const slice = fileLines.slice(i, i + contextLines.length);
      const sliceTrimmed = slice.map(line => line.trim());
      const contextTrimmed = contextLines.map(line => line.trim());
      
      if (this.arraysEqual(sliceTrimmed, contextTrimmed)) {
        return { index: i, fuzzScore: 100 };
      }
    }
    return { index: -1, fuzzScore: 0 };
  }

  /**
   * Find match at end of file with special handling
   */
  private findEofMatch(
    fileLines: string[],
    contextLines: string[]
  ): { index: number; fuzzScore: number } {
    const eofStartIndex = Math.max(0, fileLines.length - contextLines.length);
    
    // Try exact match at EOF first
    const exactResult = this.findExactMatch(fileLines, contextLines, eofStartIndex);
    if (exactResult.index !== -1) {
      return { index: exactResult.index, fuzzScore: exactResult.fuzzScore };
    }

    // Try fuzzy matches at EOF
    if (this.config.ignoreTrailingWhitespace) {
      const trailingResult = this.findTrailingWhitespaceMatch(fileLines, contextLines, eofStartIndex);
      if (trailingResult.index !== -1) {
        return { index: trailingResult.index, fuzzScore: trailingResult.fuzzScore + 10000 };
      }
    }

    if (this.config.ignoreAllWhitespace) {
      const allWsResult = this.findAllWhitespaceMatch(fileLines, contextLines, eofStartIndex);
      if (allWsResult.index !== -1) {
        return { index: allWsResult.index, fuzzScore: allWsResult.fuzzScore + 10000 };
      }
    }

    // Fall back to searching from beginning with EOF penalty
    const strategies = [
      (lines: string[], context: string[], start: number) => this.findExactMatch(lines, context, start),
      this.config.ignoreTrailingWhitespace ? (lines: string[], context: string[], start: number) => this.findTrailingWhitespaceMatch(lines, context, start) : null,
      this.config.ignoreAllWhitespace ? (lines: string[], context: string[], start: number) => this.findAllWhitespaceMatch(lines, context, start) : null
    ].filter(Boolean) as Array<(lines: string[], context: string[], start: number) => { index: number; fuzzScore: number }>;

    for (const strategy of strategies) {
      const result = strategy(fileLines, contextLines, 0);
      if (result.index !== -1) {
        return { index: result.index, fuzzScore: result.fuzzScore + 10000 };
      }
    }

    return { index: -1, fuzzScore: 0 };
  }

  /**
   * Check if two string arrays are equal
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }

  /**
   * Validate that context lines are reasonable for matching
   */
  validateContext(contextLines: string[]): {
    isValid: boolean;
    warnings: string[];
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check for empty context
    if (contextLines.length === 0) {
      warnings.push('Empty context - may match at unexpected locations');
      recommendations.push('Provide at least one line of context for reliable matching');
    }

    // Check for very short context
    if (contextLines.length === 1 && contextLines[0] && contextLines[0].trim().length < 10) {
      warnings.push('Very short context - may have multiple matches');
      recommendations.push('Use longer context lines or multiple context lines');
    }

    // Check for common patterns that may match in multiple places
    const commonPatterns = [
      /^\s*\{\s*$/,           // Just opening brace
      /^\s*\}\s*$/,           // Just closing brace
      /^\s*\/\/.*$/,          // Comment only
      /^\s*\*.*$/,            // JSDoc comment
      /^\s*#.*$/,             // Python/shell comment
      /^\s*$|^\s+$/,          // Whitespace only
      /^\s*(import|from)\s+/, // Import statements
      /^\s*const\s+\w+\s*=/,  // Simple const declarations
    ];

    for (let i = 0; i < contextLines.length; i++) {
      const line = contextLines[i];
      if (!line) continue;
      for (const pattern of commonPatterns) {
        if (pattern.test(line)) {
          warnings.push(`Line ${i + 1} contains common pattern that may match in multiple places: "${line.trim()}"`);
          recommendations.push('Use more specific context lines with unique identifiers');
          break;
        }
      }
    }

    // Check for duplicate lines in context
    const lineCounts = new Map<string, number>();
    for (const line of contextLines) {
      const trimmed = line.trim();
      lineCounts.set(trimmed, (lineCounts.get(trimmed) || 0) + 1);
    }

    for (const [line, count] of lineCounts) {
      if (count > 1 && line.length > 0) {
        warnings.push(`Context contains duplicate line: "${line}"`);
        recommendations.push('Ensure context lines are unique for reliable matching');
      }
    }

    // Check for very long context
    if (contextLines.length > 20) {
      warnings.push('Very long context - may be unnecessarily restrictive');
      recommendations.push('Consider using shorter, more focused context');
    }

    return {
      isValid: warnings.length === 0,
      warnings,
      recommendations
    };
  }

  /**
   * Get debug information about context finding configuration
   */
  getDebugInfo(): {
    config: FuzzyMatchingConfig;
    strategies: string[];
    maxAttempts: number;
  } {
    const strategies = ['exact'];
    
    if (this.config.enabled) {
      if (this.config.ignoreTrailingWhitespace) {
        strategies.push('trailing-whitespace');
      }
      if (this.config.ignoreAllWhitespace) {
        strategies.push('all-whitespace');
      }
      if (this.config.handleEofContext) {
        strategies.push('eof');
      }
    }

    return {
      config: { ...this.config },
      strategies,
      maxAttempts: strategies.length
    };
  }

  /**
   * Test context matching against sample content (for debugging)
   */
  async testMatch(
    sampleContent: string,
    contextLines: string[]
  ): Promise<{
    result: ContextMatch;
    validation: {
      isValid: boolean;
      warnings: string[];
      recommendations: string[];
    };
    attempts: Array<{
      strategy: string;
      found: boolean;
      index: number;
      fuzzScore: number;
    }>;
  }> {
    const validation = this.validateContext(contextLines);
    const fileLines = sampleContent.split('\n');
    const attempts: Array<{
      strategy: string;
      found: boolean;
      index: number;
      fuzzScore: number;
    }> = [];

    // Track each attempt
    const strategies = [
      { name: 'exact', method: (lines: string[], context: string[], start: number) => this.findExactMatch(lines, context, start) },
      { name: 'trailing-whitespace', method: (lines: string[], context: string[], start: number) => this.findTrailingWhitespaceMatch(lines, context, start) },
      { name: 'all-whitespace', method: (lines: string[], context: string[], start: number) => this.findAllWhitespaceMatch(lines, context, start) }
    ];

    for (const strategy of strategies) {
      const result = strategy.method(fileLines, contextLines, 0);
      attempts.push({
        strategy: strategy.name,
        found: result.index !== -1,
        index: result.index,
        fuzzScore: result.fuzzScore
      });
    }

    // EOF attempt if enabled
    if (this.config.handleEofContext) {
      const eofResult = this.findEofMatch(fileLines, contextLines);
      attempts.push({
        strategy: 'eof',
        found: eofResult.index !== -1,
        index: eofResult.index,
        fuzzScore: eofResult.fuzzScore
      });
    }

    const result = await this.findContext(sampleContent, contextLines);

    return {
      result,
      validation,
      attempts
    };
  }
}