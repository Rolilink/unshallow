/**
 * PatchParser component for parsing context-based patch text.
 * 
 * Ports the Python patch_diff.py parser logic to TypeScript with proper error handling
 * and composition-based architecture. Handles all three operation types: ADD, DELETE, UPDATE.
 */

import {
  ActionType,
  PatchAction,
  ParsedPatch,
  PatchOptions,
  PatchError,
  InvalidPatchFormatError,
  FileNotFoundError,
  FileAlreadyExistsError,
  PatchErrorCode
} from './types';

/**
 * Internal chunk data structure used during parsing
 */
interface ParsingChunk {
  origIndex: number;
  delLines: string[];
  insLines: string[];
}


/**
 * Parser state for tracking current parsing position and context
 */
class ParserState {
  constructor(
    public readonly lines: string[],
    public index: number = 0,
    public fuzz: number = 0
  ) {}

  /**
   * Get current line, throws if at end
   */
  getCurrentLine(): string {
    if (this.index >= this.lines.length) {
      throw new InvalidPatchFormatError(
        'Unexpected end of input while parsing patch',
        { index: this.index, totalLines: this.lines.length },
        this.index
      );
    }
    return this.lines[this.index] || '';
  }

  /**
   * Check if parsing is complete
   */
  isDone(prefixes?: string[]): boolean {
    if (this.index >= this.lines.length) {
      return true;
    }
    
    if (prefixes && prefixes.length > 0) {
      const currentLine = this.normalizeLineEnding(this.getCurrentLine());
      return prefixes.some(prefix => currentLine.startsWith(prefix));
    }
    
    return false;
  }

  /**
   * Check if current line starts with given prefix
   */
  startsWith(prefix: string | string[]): boolean {
    const prefixes = Array.isArray(prefix) ? prefix : [prefix];
    const currentLine = this.normalizeLineEnding(this.getCurrentLine());
    return prefixes.some(p => currentLine.startsWith(p));
  }

  /**
   * Read line if it starts with prefix, advance index, return text after prefix
   */
  readWithPrefix(prefix: string): string {
    if (prefix === '') {
      throw new Error('readWithPrefix() requires a non-empty prefix');
    }
    
    const currentLine = this.normalizeLineEnding(this.getCurrentLine());
    if (currentLine.startsWith(prefix)) {
      const text = this.getCurrentLine().substring(prefix.length);
      this.index++;
      return text;
    }
    
    return '';
  }

  /**
   * Read current line and advance
   */
  readLine(): string {
    const line = this.getCurrentLine();
    this.index++;
    return line;
  }

  /**
   * Normalize line endings for consistent comparison
   */
  normalizeLineEnding(line: string): string {
    return line.replace(/\r$/, '');
  }
}

/**
 * Context and chunk information extracted from patch section
 */
interface SectionResult {
  contextLines: string[];
  chunks: ParsingChunk[];
  endIndex: number;
  isEof: boolean;
}

/**
 * PatchParser component responsible for parsing patch text into structured data.
 * Uses composition to integrate with ContextFinder for location matching.
 */
export class PatchParser {
  constructor(
    private readonly options: PatchOptions
  ) {}

  /**
   * Parse patch text into structured ParsedPatch object
   */
  async parse(
    patchText: string, 
    currentFiles: Map<string, string>
  ): Promise<ParsedPatch> {
    const startTime = Date.now();
    const lines = patchText.split('\n');
    
    // Validate patch format
    this.validatePatchFormat(lines);
    
    const state = new ParserState(lines, 1); // Skip "*** Begin Patch"
    const actions = new Map<string, PatchAction>();
    let contextSearches = 0;

    // Parse all actions until "*** End Patch"
    while (!state.isDone(['*** End Patch'])) {
      const action = await this.parseNextAction(state, currentFiles);
      
      if (actions.has(action.filePath)) {
        throw new InvalidPatchFormatError(
          `Duplicate action for file: ${action.filePath}`,
          { filePath: action.filePath },
          state.index
        );
      }
      
      actions.set(action.filePath, action);
      contextSearches += action.chunks.length;
    }

    // Consume "*** End Patch" sentinel
    if (!state.startsWith('*** End Patch')) {
      throw new InvalidPatchFormatError(
        'Missing *** End Patch sentinel',
        { currentLine: state.getCurrentLine() },
        state.index
      );
    }
    state.index++;

    const parseTimeMs = Date.now() - startTime;

    return {
      actions,
      fuzzScore: state.fuzz,
      metadata: {
        totalLines: lines.length,
        parseTimeMs,
        contextSearches
      }
    };
  }

  /**
   * Validate patch format has proper sentinels
   */
  private validatePatchFormat(lines: string[]): void {
    if (lines.length < 2) {
      throw new InvalidPatchFormatError(
        'Invalid patch text - missing sentinels',
        { lineCount: lines.length }
      );
    }

    const firstLine = this.normalizeLine(lines[0] || '');
    const lastLine = this.normalizeLine(lines[lines.length - 1] || '');

    if (!firstLine.startsWith('*** Begin Patch')) {
      throw new InvalidPatchFormatError(
        'Invalid patch text - missing *** Begin Patch',
        { firstLine }
      );
    }

    if (lastLine !== '*** End Patch') {
      throw new InvalidPatchFormatError(
        'Invalid patch text - missing *** End Patch',
        { lastLine }
      );
    }
  }

  /**
   * Parse the next action (UPDATE, ADD, or DELETE)
   */
  private async parseNextAction(
    state: ParserState, 
    currentFiles: Map<string, string>
  ): Promise<PatchAction> {
    const line = state.getCurrentLine();

    // Try UPDATE operation
    const updatePath = state.readWithPrefix('*** Update File: ');
    if (updatePath) {
      return this.parseUpdateAction(state, updatePath.trim(), currentFiles);
    }

    // Try DELETE operation  
    const deletePath = state.readWithPrefix('*** Delete File: ');
    if (deletePath) {
      return this.parseDeleteAction(deletePath.trim(), currentFiles);
    }

    // Try ADD operation
    const addPath = state.readWithPrefix('*** Add File: ');
    if (addPath) {
      return this.parseAddAction(state, addPath.trim(), currentFiles);
    }

    // Unknown line
    throw new InvalidPatchFormatError(
      `Unknown action line: ${line}`,
      { line, lineNumber: state.index },
      state.index
    );
  }

  /**
   * Parse UPDATE file action with chunks
   */
  private async parseUpdateAction(
    state: ParserState,
    filePath: string,
    currentFiles: Map<string, string>
  ): Promise<PatchAction> {
    // Validate file exists
    if (!currentFiles.has(filePath)) {
      throw new FileNotFoundError(
        filePath,
        { operation: 'UPDATE' }
      );
    }

    // Check for optional move path
    const movePath = state.readWithPrefix('*** Move to: ');
    
    const fileContent = currentFiles.get(filePath)!;
    const fileLines = fileContent.split('\n');
    const chunks: ParsingChunk[] = [];
    let lineIndex = 0;

    // Parse all chunks until next action or end
    while (!state.isDone([
      '*** End Patch',
      '*** Update File:',
      '*** Delete File:',
      '*** Add File:',
      '*** End of File'
    ])) {
      // Look for context definition line starting with @@
      const contextDef = state.readWithPrefix('@@ ');
      if (contextDef || state.startsWith('@@')) {
        if (!contextDef && state.normalizeLineEnding(state.getCurrentLine()) === '@@') {
          state.readLine(); // Consume standalone @@
        }
      }

      // Parse the section and build chunks
      const section = this.parseSection(state);
      const { foundIndex, fuzzScore } = this.findContextInFile(
        fileLines, 
        section.contextLines, 
        lineIndex, 
        section.isEof
      );

      if (foundIndex === -1) {
        const contextText = section.contextLines.slice(0, 2).join(' | ');
        throw new PatchError(
          `Invalid ${section.isEof ? 'EOF ' : ''}context at ${lineIndex}: ${contextText}`,
          PatchErrorCode.CONTEXT_NOT_FOUND,
          { 
            contextLines: section.contextLines,
            fileLines: fileLines.length,
            searchIndex: lineIndex,
            isEof: section.isEof
          },
          filePath,
          lineIndex
        );
      }

      state.fuzz += fuzzScore;

      // Add chunks with adjusted indices
      for (const chunk of section.chunks) {
        chunks.push({
          origIndex: foundIndex + chunk.origIndex,
          delLines: chunk.delLines,
          insLines: chunk.insLines
        });
      }

      lineIndex = foundIndex + section.contextLines.length;
      state.index = section.endIndex;
    }

    return {
      type: ActionType.UPDATE,
      chunks: chunks.map(c => ({
        origIndex: c.origIndex,
        delLines: c.delLines,
        insLines: c.insLines,
        contextLines: [],
        fuzzScore: 0
      })),
      movePath: movePath.trim() || undefined,
      filePath
    };
  }

  /**
   * Parse DELETE file action
   */
  private parseDeleteAction(
    filePath: string,
    currentFiles: Map<string, string>
  ): PatchAction {
    // Validate file exists
    if (!currentFiles.has(filePath)) {
      throw new FileNotFoundError(
        filePath,
        { operation: 'DELETE' }
      );
    }

    return {
      type: ActionType.DELETE,
      chunks: [],
      filePath
    };
  }

  /**
   * Parse ADD file action
   */
  private parseAddAction(
    state: ParserState,
    filePath: string,
    currentFiles: Map<string, string>
  ): PatchAction {
    // Validate file doesn't exist
    if (currentFiles.has(filePath)) {
      throw new FileAlreadyExistsError(
        filePath,
        { operation: 'ADD' }
      );
    }

    const contentLines: string[] = [];

    // Read all lines until next action
    while (!state.isDone([
      '*** End Patch',
      '*** Update File:', 
      '*** Delete File:',
      '*** Add File:'
    ])) {
      const line = state.readLine();
      
      if (!line.startsWith('+')) {
        throw new InvalidPatchFormatError(
          `Invalid Add File line (missing '+'): ${line}`,
          { line, filePath },
          state.index - 1
        );
      }
      
      contentLines.push(line.substring(1)); // Remove '+' prefix
    }

    return {
      type: ActionType.ADD,
      newFile: contentLines.join('\n'),
      chunks: [],
      filePath
    };
  }

  /**
   * Parse a section (context and chunks) from patch text
   */
  private parseSection(state: ParserState): SectionResult {
    const contextLines: string[] = [];
    const chunks: ParsingChunk[] = [];
    let delLines: string[] = [];
    let insLines: string[] = [];
    let mode: 'keep' | 'delete' | 'add' = 'keep';
    const startIndex = state.index;

    while (state.index < state.lines.length) {
      const line = state.lines[state.index];
      if (!line) {
        state.index++;
        continue;
      }
      
      // Check for section terminators
      if (line.startsWith('@@') ||
          line.startsWith('*** End Patch') ||
          line.startsWith('*** Update File:') ||
          line.startsWith('*** Delete File:') ||
          line.startsWith('*** Add File:') ||
          line.startsWith('*** End of File')) {
        break;
      }

      if (line === '***') {
        break;
      }

      if (line.startsWith('***')) {
        throw new InvalidPatchFormatError(
          `Invalid line: ${line}`,
          { line },
          state.index
        );
      }

      state.index++;

      const lastMode: 'keep' | 'delete' | 'add' = mode;
      let processedLine = line;

      // Handle @@ context markers - treat as context lines
      if (line.startsWith('@@')) {
        // Extract the context definition from @@ line
        const contextMatch = line.match(/^@@ (.+)/);
        if (contextMatch && contextMatch[1]) {
          // Treat the content after @@ as a context line
          processedLine = ' ' + contextMatch[1];
        } else if (line === '@@') {
          // Skip standalone @@ markers
          continue;
        } else {
          // Treat the entire @@ line as context
          processedLine = ' ' + line;
        }
      }

      // Handle empty lines as space-prefixed
      if (processedLine === '') {
        processedLine = ' ';
      }

      // Determine line mode based on prefix
      if (processedLine.startsWith('+')) {
        mode = 'add';
      } else if (processedLine.startsWith('-')) {
        mode = 'delete';
      } else if (processedLine.startsWith(' ')) {
        mode = 'keep';
      } else {
        throw new InvalidPatchFormatError(
          `Invalid line prefix: ${line}`,
          { line },
          state.index - 1
        );
      }

      // Remove prefix
      const content = processedLine.substring(1);

      // Handle mode transitions
      if (mode === 'keep' && lastMode !== mode) {
        if (insLines.length > 0 || delLines.length > 0) {
          chunks.push({
            origIndex: contextLines.length - delLines.length,
            delLines: [...delLines],
            insLines: [...insLines]
          });
        }
        delLines = [];
        insLines = [];
      }

      // Process line based on mode
      if (mode === 'delete') {
        delLines.push(content);
        contextLines.push(content);
      } else if (mode === 'add') {
        insLines.push(content);
      } else if (mode === 'keep') {
        contextLines.push(content);
      }
    }

    // Add final chunk if needed
    if (insLines.length > 0 || delLines.length > 0) {
      chunks.push({
        origIndex: contextLines.length - delLines.length,
        delLines,
        insLines
      });
    }

    // Check for EOF marker
    let isEof = false;
    if (state.index < state.lines.length && 
        state.lines[state.index] === '*** End of File') {
      isEof = true;
      state.index++;
    }

    if (state.index === startIndex) {
      throw new InvalidPatchFormatError(
        'Nothing in this section',
        { startIndex },
        startIndex
      );
    }

    return {
      contextLines,
      chunks,
      endIndex: state.index,
      isEof
    };
  }

  /**
   * Find context lines in file with fuzzy matching
   */
  private findContextInFile(
    fileLines: string[],
    contextLines: string[],
    startIndex: number,
    isEof: boolean
  ): { foundIndex: number; fuzzScore: number } {
    if (contextLines.length === 0) {
      return { foundIndex: startIndex, fuzzScore: 0 };
    }

    // Handle EOF context specially
    if (isEof) {
      const eofResult = this.findContextCore(
        fileLines, 
        contextLines, 
        fileLines.length - contextLines.length
      );
      if (eofResult.foundIndex !== -1) {
        return eofResult;
      }
      
      // Fall back to normal search with EOF penalty
      const normalResult = this.findContextCore(fileLines, contextLines, startIndex);
      return {
        foundIndex: normalResult.foundIndex,
        fuzzScore: normalResult.fuzzScore + 10000
      };
    }

    return this.findContextCore(fileLines, contextLines, startIndex);
  }

  /**
   * Core context finding with progressive fuzzy matching
   */
  private findContextCore(
    fileLines: string[],
    contextLines: string[],
    startIndex: number
  ): { foundIndex: number; fuzzScore: number } {
    // Try exact match
    for (let i = startIndex; i <= fileLines.length - contextLines.length; i++) {
      const slice = fileLines.slice(i, i + contextLines.length);
      if (this.arraysEqual(slice, contextLines)) {
        return { foundIndex: i, fuzzScore: 0 };
      }
    }

    // Try trailing whitespace match
    for (let i = startIndex; i <= fileLines.length - contextLines.length; i++) {
      const slice = fileLines.slice(i, i + contextLines.length);
      const sliceRTrimmed = slice.map(line => line.replace(/\s+$/, ''));
      const contextRTrimmed = contextLines.map(line => line.replace(/\s+$/, ''));
      if (this.arraysEqual(sliceRTrimmed, contextRTrimmed)) {
        return { foundIndex: i, fuzzScore: 1 };
      }
    }

    // Try all whitespace match if enabled
    if (this.options.fuzzyMatching.ignoreAllWhitespace) {
      for (let i = startIndex; i <= fileLines.length - contextLines.length; i++) {
        const slice = fileLines.slice(i, i + contextLines.length);
        const sliceTrimmed = slice.map(line => line.trim());
        const contextTrimmed = contextLines.map(line => line.trim());
        if (this.arraysEqual(sliceTrimmed, contextTrimmed)) {
          return { foundIndex: i, fuzzScore: 100 };
        }
      }
    }

    return { foundIndex: -1, fuzzScore: 0 };
  }

  /**
   * Check if two string arrays are equal
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }

  /**
   * Normalize line ending for consistent processing
   */
  private normalizeLine(line: string): string {
    return line.replace(/\r$/, '');
  }
}