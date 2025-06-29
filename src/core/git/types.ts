export interface IGitRepository {
  getRoot(): Promise<string>;
}
