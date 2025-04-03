import { FileState } from './index.js';

/**
 * Interface for the result returned by workflow nodes
 */
export interface NodeResult {
  file: Partial<FileState>;
}
