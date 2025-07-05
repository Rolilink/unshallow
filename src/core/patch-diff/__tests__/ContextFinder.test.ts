import { describe, it, expect } from '@jest/globals';
import { ContextFinder } from '../ContextFinder';

describe('ContextFinder', () => {
  let contextFinder: ContextFinder;

  beforeEach(() => {
    contextFinder = new ContextFinder();
  });

  describe('findContextCore', () => {
    it('should find exact match with fuzz 0', () => {
      const lines = ['line1', 'target_line', 'line3'];
      const context = ['target_line'];
      
      const [index, fuzz] = contextFinder.findContextCore(lines, context, 0);
      
      expect(index).toBe(1);
      expect(fuzz).toBe(0);
    });

    it('should find match ignoring trailing whitespace with fuzz 1', () => {
      const lines = ['line1', 'target_line   ', 'line3'];
      const context = ['target_line'];
      
      const [index, fuzz] = contextFinder.findContextCore(lines, context, 0);
      
      expect(index).toBe(1);
      expect(fuzz).toBe(1);
    });

    it('should find match ignoring all whitespace with fuzz 100', () => {
      const lines = ['line1', '  target_line  ', 'line3'];
      const context = ['target_line'];
      
      const [index, fuzz] = contextFinder.findContextCore(lines, context, 0);
      
      expect(index).toBe(1);
      expect(fuzz).toBe(100);
    });

    it('should return -1 when no match found', () => {
      const lines = ['line1', 'line2', 'line3'];
      const context = ['not_found'];
      
      const [index, fuzz] = contextFinder.findContextCore(lines, context, 0);
      
      expect(index).toBe(-1);
      expect(fuzz).toBe(0);
    });

    it('should handle empty context', () => {
      const lines = ['line1', 'line2', 'line3'];
      const context: string[] = [];
      
      const [index, fuzz] = contextFinder.findContextCore(lines, context, 1);
      
      expect(index).toBe(1); // Returns start position
      expect(fuzz).toBe(0);
    });

    it('should find multi-line context', () => {
      const lines = ['line1', 'context1', 'context2', 'line4'];
      const context = ['context1', 'context2'];
      
      const [index, fuzz] = contextFinder.findContextCore(lines, context, 0);
      
      expect(index).toBe(1);
      expect(fuzz).toBe(0);
    });

    it('should respect start position', () => {
      const lines = ['target', 'line2', 'target', 'line4'];
      const context = ['target'];
      
      const [index, fuzz] = contextFinder.findContextCore(lines, context, 2);
      
      expect(index).toBe(2); // Should find second occurrence
      expect(fuzz).toBe(0);
    });

    it('should handle Unicode normalization - hyphens', () => {
      const lines = ['calculate(x – 1)']; // EN DASH
      const context = ['calculate(x - 1)']; // ASCII HYPHEN
      
      const [index, fuzz] = contextFinder.findContextCore(lines, context, 0);
      
      expect(index).toBe(0);
      expect(fuzz).toBe(0);
    });

    it('should handle Unicode normalization - quotes', () => {
      const lines = ['print("hello")']; // Smart quotes
      const context = ['print("hello")']; // ASCII quotes
      
      const [index, fuzz] = contextFinder.findContextCore(lines, context, 0);
      
      expect(index).toBe(0);
      expect(fuzz).toBe(0);
    });

    it('should handle Unicode normalization - spaces', () => {
      const lines = ['value = 42']; // Non-breaking space
      const context = ['value = 42']; // Regular space
      
      const [index, fuzz] = contextFinder.findContextCore(lines, context, 0);
      
      expect(index).toBe(0);
      expect(fuzz).toBe(0);
    });

    it('should prioritize exact match over fuzzy match', () => {
      const lines = ['  target  ', 'target', 'line3'];
      const context = ['target'];
      
      const [index, fuzz] = contextFinder.findContextCore(lines, context, 0);
      
      expect(index).toBe(1); // Should find exact match, not fuzzy one
      expect(fuzz).toBe(0);
    });

    it('should prioritize trailing whitespace match over all whitespace match', () => {
      const lines = ['  target  ', 'target   ', 'line3'];
      const context = ['target'];
      
      const [index, fuzz] = contextFinder.findContextCore(lines, context, 0);
      
      expect(index).toBe(1); // Should find trailing whitespace match
      expect(fuzz).toBe(1);
    });

    it('should handle complex Unicode combinations', () => {
      const lines = ['result = x – 1; print("done")']; // EN DASH + smart quotes
      const context = ['result = x - 1; print("done")']; // ASCII equivalents
      
      const [index, fuzz] = contextFinder.findContextCore(lines, context, 0);
      
      expect(index).toBe(0);
      expect(fuzz).toBe(0);
    });

    it('should handle NFC normalization', () => {
      // Test with composed vs decomposed Unicode characters
      const lines = ['café']; // Composed é
      const context = ['café']; // Decomposed e + ´
      
      const [index, fuzz] = contextFinder.findContextCore(lines, context, 0);
      
      expect(index).toBe(0);
      expect(fuzz).toBe(0);
    });
  });

  describe('findContext', () => {
    it('should handle non-EOF context normally', () => {
      const lines = ['line1', 'target', 'line3'];
      const context = ['target'];
      
      const [index, fuzz] = contextFinder.findContext(lines, context, 0, false);
      
      expect(index).toBe(1);
      expect(fuzz).toBe(0);
    });

    it('should handle EOF context at correct position', () => {
      const lines = ['line1', 'line2', 'eof_context'];
      const context = ['eof_context'];
      
      const [index, fuzz] = contextFinder.findContext(lines, context, 0, true);
      
      expect(index).toBe(2); // Should find at EOF position
      expect(fuzz).toBe(0);
    });

    it('should handle EOF context not at EOF with penalty', () => {
      const lines = ['eof_context', 'line2', 'line3'];
      const context = ['eof_context'];
      
      const [index, fuzz] = contextFinder.findContext(lines, context, 0, true);
      
      expect(index).toBe(0); // Should find it but with penalty
      expect(fuzz).toBeGreaterThanOrEqual(10000); // High fuzz penalty
    });

    it('should handle EOF context not found', () => {
      const lines = ['line1', 'line2', 'line3'];
      const context = ['not_found'];
      
      const [index, fuzz] = contextFinder.findContext(lines, context, 0, true);
      
      expect(index).toBe(-1);
      expect(fuzz).toBeGreaterThanOrEqual(10000);
    });

    it('should prefer EOF position for EOF context', () => {
      const lines = ['target', 'line2', 'target']; // Appears twice
      const context = ['target'];
      
      const [index, fuzz] = contextFinder.findContext(lines, context, 0, true);
      
      expect(index).toBe(2); // Should prefer the EOF position
      expect(fuzz).toBe(0);
    });

    it('should handle empty file for EOF context', () => {
      const lines: string[] = [];
      const context = ['target'];
      
      const [index, fuzz] = contextFinder.findContext(lines, context, 0, true);
      
      expect(index).toBe(-1);
      expect(fuzz).toBeGreaterThanOrEqual(10000);
    });

    it('should handle context larger than file for EOF', () => {
      const lines = ['line1'];
      const context = ['line1', 'line2', 'line3']; // Longer than file
      
      const [index, fuzz] = contextFinder.findContext(lines, context, 0, true);
      
      expect(index).toBe(-1);
      expect(fuzz).toBeGreaterThanOrEqual(10000);
    });

    it('should handle multi-line EOF context', () => {
      const lines = ['line1', 'eof_line1', 'eof_line2'];
      const context = ['eof_line1', 'eof_line2'];
      
      const [index, fuzz] = contextFinder.findContext(lines, context, 0, true);
      
      expect(index).toBe(1); // Should find at correct EOF position
      expect(fuzz).toBe(0);
    });

    it('should handle whitespace variations in EOF context', () => {
      const lines = ['line1', 'eof_line   ']; // Trailing whitespace
      const context = ['eof_line'];
      
      const [index, fuzz] = contextFinder.findContext(lines, context, 0, true);
      
      expect(index).toBe(1);
      expect(fuzz).toBe(1); // Fuzz for trailing whitespace
    });

    it('should apply fuzz penalty correctly for misplaced EOF context', () => {
      const lines = ['eof_target', 'middle', 'end'];
      const context = ['eof_target'];
      
      const [index, fuzz] = contextFinder.findContext(lines, context, 0, true);
      
      expect(index).toBe(0);
      expect(fuzz).toBe(10000); // Base fuzz (0) + penalty (10000)
    });
  });
});