import {
  Patch,
  PatchAction,
  ActionType,
  DiffError,
  PATCH_PREFIX,
  PATCH_SUFFIX,
  ADD_FILE_PREFIX,
  DELETE_FILE_PREFIX,
  UPDATE_FILE_PREFIX,
  MOVE_FILE_TO_PREFIX,
  END_OF_FILE_PREFIX,
  HUNK_ADD_LINE_PREFIX,
} from './types';

import { ContextFinder } from './ContextFinder';

/**
 * Parser class that converts V4A patch text into structured Patch objects.
 * This is a direct adaptation of the Parser class from the original implementation.
 */
export class PatchParser {
  private currentFiles: Record<string, string>;
  private lines: string[];
  public index = 0;
  private patch: Patch = { actions: {} };
  private fuzz = 0;
  private contextFinder: ContextFinder;

  constructor(currentFiles: Record<string, string>, lines: string[]) {
    this.currentFiles = currentFiles;
    this.lines = lines;
    this.contextFinder = new ContextFinder();
  }

  /**
   * Check if parsing is done based on current index and optional prefixes
   */
  private isDone(prefixes?: string[]): boolean {
    if (this.index >= this.lines.length) {
      return true;
    }
    if (
      prefixes &&
      prefixes.some((p) => this.lines[this.index]!.startsWith(p.trim()))
    ) {
      return true;
    }
    return false;
  }

  /**
   * Check if current line starts with given prefix(es)
   */
  private startsWith(prefix: string | string[]): boolean {
    const prefixes = Array.isArray(prefix) ? prefix : [prefix];
    return prefixes.some((p) => this.lines[this.index]!.startsWith(p));
  }

  /**
   * Read a string from current line, optionally checking for prefix
   */
  private readStr(prefix = '', returnEverything = false): string {
    if (this.index >= this.lines.length) {
      throw new DiffError(`Index: ${this.index} >= ${this.lines.length}`);
    }
    if (this.lines[this.index]!.startsWith(prefix)) {
      const text = returnEverything
        ? this.lines[this.index]
        : this.lines[this.index]!.slice(prefix.length);
      this.index += 1;
      return text ?? '';
    }
    return '';
  }

  /**
   * Main parsing method - converts patch text to structured Patch object
   */
  parse(): void {
    while (!this.isDone([PATCH_SUFFIX])) {
      // Try to read UPDATE action
      let path = this.readStr(UPDATE_FILE_PREFIX);
      if (path) {
        if (this.patch.actions[path]) {
          throw new DiffError(`Update File Error: Duplicate Path: ${path}`);
        }
        const moveTo = this.readStr(MOVE_FILE_TO_PREFIX);
        if (!(path in this.currentFiles)) {
          throw new DiffError(`Update File Error: Missing File: ${path}`);
        }
        const text = this.currentFiles[path];
        const action = this.parseUpdateFile(text ?? '');
        action.move_path = moveTo || undefined;
        this.patch.actions[path] = action;
        continue;
      }

      // Try to read DELETE action
      path = this.readStr(DELETE_FILE_PREFIX);
      if (path) {
        if (this.patch.actions[path]) {
          throw new DiffError(`Delete File Error: Duplicate Path: ${path}`);
        }
        if (!(path in this.currentFiles)) {
          throw new DiffError(`Delete File Error: Missing File: ${path}`);
        }
        this.patch.actions[path] = { type: ActionType.DELETE, chunks: [] };
        continue;
      }

      // Try to read ADD action
      path = this.readStr(ADD_FILE_PREFIX);
      if (path) {
        if (this.patch.actions[path]) {
          throw new DiffError(`Add File Error: Duplicate Path: ${path}`);
        }
        if (path in this.currentFiles) {
          throw new DiffError(`Add File Error: File already exists: ${path}`);
        }
        this.patch.actions[path] = this.parseAddFile();
        continue;
      }

      throw new DiffError(`Unknown Line: ${this.lines[this.index]}`);
    }

    if (!this.startsWith(PATCH_SUFFIX.trim())) {
      throw new DiffError('Missing End Patch');
    }
    this.index += 1;
  }

  /**
   * Parse UPDATE file action with context finding and chunk application
   */
  private parseUpdateFile(text: string): PatchAction {
    const action: PatchAction = { type: ActionType.UPDATE, chunks: [] };
    const fileLines = text.split('\n');
    let index = 0;

    while (
      !this.isDone([
        PATCH_SUFFIX,
        UPDATE_FILE_PREFIX,
        DELETE_FILE_PREFIX,
        ADD_FILE_PREFIX,
        END_OF_FILE_PREFIX,
      ])
    ) {
      const defStr = this.readStr('@@ ');
      let sectionStr = '';
      if (!defStr && this.lines[this.index] === '@@') {
        sectionStr = this.lines[this.index]!;
        this.index += 1;
      }
      if (!(defStr || sectionStr || index === 0)) {
        throw new DiffError(`Invalid Line:\n${this.lines[this.index]}`);
      }

      if (defStr.trim()) {
        let found = false;

        // Canonicalization function matching original implementation
        const canonLocal = (s: string): string =>
          s.normalize('NFC').replace(
            /./gu,
            (c) =>
              ((
                {
                  '-': '-',
                  '\u2010': '-',
                  '\u2011': '-',
                  '\u2012': '-',
                  '\u2013': '-',
                  '\u2014': '-',
                  '\u2212': '-',
                  '\u0022': '"',
                  '\u201C': '"',
                  '\u201D': '"',
                  '\u201E': '"',
                  '\u00AB': '"',
                  '\u00BB': '"',
                  '\u0027': "'",
                  '\u2018': "'",
                  '\u2019': "'",
                  '\u201B': "'",
                  '\u00A0': ' ',
                  '\u202F': ' ',
                } as Record<string, string>
              )[c] ?? c)
          );

        // First try: exact match in lines before current position
        if (
          !fileLines
            .slice(0, index)
            .some((s) => canonLocal(s) === canonLocal(defStr))
        ) {
          for (let i = index; i < fileLines.length; i++) {
            if (canonLocal(fileLines[i]!) === canonLocal(defStr)) {
              index = i + 1;
              found = true;
              break;
            }
          }
        }

        // Second try: trimmed match in lines before current position
        if (
          !found &&
          !fileLines
            .slice(0, index)
            .some((s) => canonLocal(s.trim()) === canonLocal(defStr.trim()))
        ) {
          for (let i = index; i < fileLines.length; i++) {
            if (
              canonLocal(fileLines[i]!.trim()) === canonLocal(defStr.trim())
            ) {
              index = i + 1;
              this.fuzz += 1;
              found = true;
              break;
            }
          }
        }
      }

      // Parse the next section to get context and chunks
      const [nextChunkContext, chunks, endPatchIndex, eof] = this.peekNextSection(
        this.lines,
        this.index
      );

      // Find context position in file
      const [newIndex, fuzz] = this.contextFinder.findContext(
        fileLines,
        nextChunkContext,
        index,
        eof
      );

      if (newIndex === -1) {
        const ctxText = nextChunkContext.join('\n');
        if (eof) {
          throw new DiffError(`Invalid EOF Context ${index}:\n${ctxText}`);
        } else {
          throw new DiffError(`Invalid Context ${index}:\n${ctxText}`);
        }
      }

      this.fuzz += fuzz;
      
      // Update chunk positions and add to action
      for (const ch of chunks) {
        ch.orig_index += newIndex;
        action.chunks.push(ch);
      }

      index = newIndex + nextChunkContext.length;
      this.index = endPatchIndex;
    }

    return action;
  }

  /**
   * Parse ADD file action - collect all lines with + prefix
   */
  private parseAddFile(): PatchAction {
    const lines: string[] = [];
    
    while (
      !this.isDone([
        PATCH_SUFFIX,
        UPDATE_FILE_PREFIX,
        DELETE_FILE_PREFIX,
        ADD_FILE_PREFIX,
      ])
    ) {
      const s = this.readStr();
      if (!s.startsWith(HUNK_ADD_LINE_PREFIX)) {
        throw new DiffError(`Invalid Add File Line: ${s}`);
      }
      lines.push(s.slice(1));
    }

    return {
      type: ActionType.ADD,
      new_file: lines.join('\n'),
      chunks: [],
    };
  }

  /**
   * Parse the next section to extract context and chunks
   * This is a direct adaptation of peek_next_section from original
   */
  private peekNextSection(
    lines: string[],
    initialIndex: number
  ): [string[], import('./types').Chunk[], number, boolean] {
    let index = initialIndex;
    const old: string[] = [];
    let delLines: string[] = [];
    let insLines: string[] = [];
    const chunks: import('./types').Chunk[] = [];
    let mode: 'keep' | 'add' | 'delete' = 'keep';

    while (index < lines.length) {
      const s = lines[index]!;
      if (
        [
          '@@',
          PATCH_SUFFIX,
          UPDATE_FILE_PREFIX,
          DELETE_FILE_PREFIX,
          ADD_FILE_PREFIX,
          END_OF_FILE_PREFIX,
        ].some((p) => s.startsWith(p.trim()))
      ) {
        break;
      }
      if (s === '***') {
        break;
      }
      if (s.startsWith('***')) {
        throw new DiffError(`Invalid Line: ${s}`);
      }
      index += 1;
      const lastMode: 'keep' | 'add' | 'delete' = mode;
      let line = s;
      
      if (line[0] === HUNK_ADD_LINE_PREFIX) {
        mode = 'add';
      } else if (line[0] === '-') {
        mode = 'delete';
      } else if (line[0] === ' ') {
        mode = 'keep';
      } else {
        // Tolerate invalid lines where the leading whitespace is missing
        mode = 'keep';
        line = ' ' + line;
      }

      line = line.slice(1);
      
      if (mode === 'keep' && lastMode !== mode) {
        if (insLines.length || delLines.length) {
          chunks.push({
            orig_index: old.length - delLines.length,
            del_lines: delLines,
            ins_lines: insLines,
          });
        }
        delLines = [];
        insLines = [];
      }
      
      if (mode === 'delete') {
        delLines.push(line);
        old.push(line);
      } else if (mode === 'add') {
        insLines.push(line);
      } else {
        old.push(line);
      }
    }
    
    if (insLines.length || delLines.length) {
      chunks.push({
        orig_index: old.length - delLines.length,
        del_lines: delLines,
        ins_lines: insLines,
      });
    }
    
    if (index < lines.length && lines[index] === END_OF_FILE_PREFIX) {
      index += 1;
      return [old, chunks, index, true];
    }
    
    return [old, chunks, index, false];
  }

  /**
   * Get the parsed patch object
   */
  getPatch(): Patch {
    return this.patch;
  }

  /**
   * Get the accumulated fuzz score
   */
  getFuzz(): number {
    return this.fuzz;
  }
}

/**
 * High-level function to convert patch text to structured Patch object
 * Direct adaptation of text_to_patch from original
 */
export function textToPatch(
  text: string,
  orig: Record<string, string>
): [Patch, number] {
  const lines = text.trim().split('\n');
  if (
    lines.length < 2 ||
    !(lines[0] ?? '').startsWith(PATCH_PREFIX.trim()) ||
    lines[lines.length - 1] !== PATCH_SUFFIX.trim()
  ) {
    let reason = 'Invalid patch text: ';
    if (lines.length < 2) {
      reason += 'Patch text must have at least two lines.';
    } else if (!(lines[0] ?? '').startsWith(PATCH_PREFIX.trim())) {
      reason += 'Patch text must start with the correct patch prefix.';
    } else if (lines[lines.length - 1] !== PATCH_SUFFIX.trim()) {
      reason += 'Patch text must end with the correct patch suffix.';
    }
    throw new DiffError(reason);
  }
  
  const parser = new PatchParser(orig, lines);
  parser.index = 1;
  parser.parse();
  return [parser.getPatch(), parser.getFuzz()];
}

/**
 * Identify files that need to be loaded for UPDATE and DELETE operations
 */
export function identifyFilesNeeded(text: string): string[] {
  const lines = text.trim().split('\n');
  const result = new Set<string>();
  for (const line of lines) {
    if (line.startsWith(UPDATE_FILE_PREFIX)) {
      result.add(line.slice(UPDATE_FILE_PREFIX.length));
    }
    if (line.startsWith(DELETE_FILE_PREFIX)) {
      result.add(line.slice(DELETE_FILE_PREFIX.length));
    }
  }
  return [...result];
}

/**
 * Identify files that will be added
 */
export function identifyFilesAdded(text: string): string[] {
  const lines = text.trim().split('\n');
  const result = new Set<string>();
  for (const line of lines) {
    if (line.startsWith(ADD_FILE_PREFIX)) {
      result.add(line.slice(ADD_FILE_PREFIX.length));
    }
  }
  return [...result];
}

/**
 * Identify files that will be deleted
 */
export function identifyFilesDeleted(text: string): string[] {
  const lines = text.trim().split('\n');
  const result = new Set<string>();
  for (const line of lines) {
    if (line.startsWith(DELETE_FILE_PREFIX)) {
      result.add(line.slice(DELETE_FILE_PREFIX.length));
    }
  }
  return [...result];
}

/**
 * Identify files that will be updated (not including deleted files)
 */
export function identifyFilesUpdated(text: string): string[] {
  const lines = text.trim().split('\n');
  const result = new Set<string>();
  for (const line of lines) {
    if (line.startsWith(UPDATE_FILE_PREFIX)) {
      result.add(line.slice(UPDATE_FILE_PREFIX.length));
    }
  }
  return [...result];
}