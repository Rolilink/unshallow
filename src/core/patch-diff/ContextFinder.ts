import { PUNCT_EQUIV } from './types';

/**
 * ContextFinder implements the sophisticated 3-pass context matching algorithm
 * from the original implementation with Unicode normalization.
 */
export class ContextFinder {
  /**
   * Canonicalization function that normalizes Unicode and replaces punctuation lookalikes
   * Direct copy from find_context_core in original implementation
   */
  private canon(s: string): string {
    return s
      // Canonical Unicode composition first
      .normalize('NFC')
      // Replace punctuation look-alikes
      .replace(/./gu, (c) => PUNCT_EQUIV[c] ?? c);
  }

  /**
   * Core context finding algorithm with 3-pass fuzzy matching
   * Direct adaptation of find_context_core from original implementation
   */
  findContextCore(
    lines: string[],
    context: string[],
    start: number
  ): [number, number] {
    if (context.length === 0) {
      return [start, 0];
    }

    // Pass 1 – exact equality after canonicalization
    const canonicalContext = this.canon(context.join('\n'));
    for (let i = start; i < lines.length; i++) {
      const segment = this.canon(lines.slice(i, i + context.length).join('\n'));
      if (segment === canonicalContext) {
        return [i, 0];
      }
    }

    // Pass 2 – ignore trailing whitespace
    for (let i = start; i < lines.length; i++) {
      const segment = this.canon(
        lines
          .slice(i, i + context.length)
          .map((s) => s.trimEnd())
          .join('\n')
      );
      const ctx = this.canon(context.map((s) => s.trimEnd()).join('\n'));
      if (segment === ctx) {
        return [i, 1];
      }
    }

    // Pass 3 – ignore all surrounding whitespace
    for (let i = start; i < lines.length; i++) {
      const segment = this.canon(
        lines
          .slice(i, i + context.length)
          .map((s) => s.trim())
          .join('\n')
      );
      const ctx = this.canon(context.map((s) => s.trim()).join('\n'));
      if (segment === ctx) {
        return [i, 100];
      }
    }

    return [-1, 0];
  }

  /**
   * Find context with special handling for EOF contexts
   * Direct adaptation of find_context from original implementation
   */
  findContext(
    lines: string[],
    context: string[],
    start: number,
    eof: boolean
  ): [number, number] {
    if (eof) {
      // First try at exact EOF position
      let [newIndex, fuzz] = this.findContextCore(
        lines,
        context,
        lines.length - context.length
      );
      if (newIndex !== -1) {
        return [newIndex, fuzz];
      }
      
      // Fall back to searching from start with high fuzz penalty
      [newIndex, fuzz] = this.findContextCore(lines, context, start);
      return [newIndex, fuzz + 10000];
    }
    return this.findContextCore(lines, context, start);
  }
}