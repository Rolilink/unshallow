import * as fs from 'fs/promises';
import { IFileSystem } from './types';

export class FileSystem implements IFileSystem {
  async read(path: string): Promise<string> {
    return await fs.readFile(path, 'utf-8');
  }

  async readAsJson<T = unknown>(path: string): Promise<T> {
    const content = await this.read(path);
    return JSON.parse(content);
  }
}
