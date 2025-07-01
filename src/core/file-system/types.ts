export interface IFileSystem {
  read(path: string): Promise<string>;
  readAsJson<T = unknown>(path: string): Promise<T>;
}

export interface IPatchFileSystem extends IFileSystem {
  write(path: string, content: string): Promise<void>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
}
