export interface ExtensionStorage {
  get<T = unknown>(key: string, scope?: string, scopeKey?: string): T | null;
  set(key: string, value: unknown, scope?: string, scopeKey?: string): void;
  delete(key: string, scope?: string, scopeKey?: string): boolean;
  list(prefix?: string, scope?: string, scopeKey?: string): string[];
  clear(scope?: string, scopeKey?: string): number;
}
