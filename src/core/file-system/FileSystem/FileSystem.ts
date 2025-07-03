import * as fs from 'fs/promises';
import { IFileSystem } from '../types';

export class FileSystem implements IFileSystem {
  async read(path: string): Promise<string> {
    return await fs.readFile(path, 'utf-8');
  }

  async readAsJson<T = unknown>(path: string): Promise<T> {
    const content = await this.read(path);
    return JSON.parse(content);
  }

  async write(path: string, content: string): Promise<void> {
    await fs.writeFile(path, content, 'utf-8');
  }

  async delete(path: string): Promise<void> {
    await fs.unlink(path);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await fs.mkdir(path, options);
  }
}
