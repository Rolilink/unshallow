export interface IFileSystem {
  read(path: string): Promise<string>;
  readAsJson<T = unknown>(path: string): Promise<T>;
}
