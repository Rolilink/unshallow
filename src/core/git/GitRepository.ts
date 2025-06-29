import { exec } from 'child_process';
import { promisify } from 'util';
import { IGitRepository } from './types';

const execAsync = promisify(exec);

export class GitRepository implements IGitRepository {
  async getRoot(): Promise<string> {
    try {
      const { stdout } = await execAsync('git rev-parse --show-toplevel');
      return stdout.trim();
    } catch (error) {
      // If not in a git repo, return current working directory
      return process.cwd();
    }
  }
}
