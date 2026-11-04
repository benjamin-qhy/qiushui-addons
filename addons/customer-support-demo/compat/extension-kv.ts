export type KvScope = "chat" | "global";

export interface ExtensionStorage {
  get<T = unknown>(key: string, scope?: KvScope, scopeKey?: string): T | null;
  set(key: string, value: unknown, scope?: KvScope, scopeKey?: string): void;
  delete(key: string, scope?: KvScope, scopeKey?: string): boolean;
  list(prefix?: string, scope?: KvScope, scopeKey?: string): string[];
  clear(scope?: KvScope, scopeKey?: string): number;
}

// Keep standalone tests lightweight, but never silently downgrade to memory when
// QiushuiAI exposes its runtime bridge.
class InMemoryStorage implements ExtensionStorage {
  private store = new Map<string, string>();
  constructor(private extensionId: string) {}
  private key(key: string, scope = "chat", scopeKey = ""): string {
    return `${this.extensionId}\0${scope}\0${scopeKey}\0${key}`;
  }
  get<T>(key: string, scope?: KvScope, scopeKey?: string): T | null {
    const value = this.store.get(this.key(key, scope, scopeKey));
    return value === undefined ? null : JSON.parse(value) as T;
  }
  set(key: string, value: unknown, scope?: KvScope, scopeKey?: string): void {
    this.store.set(this.key(key, scope, scopeKey), JSON.stringify(value));
  }
  delete(key: string, scope?: KvScope, scopeKey?: string): boolean {
    return this.store.delete(this.key(key, scope, scopeKey));
  }
  list(prefix = "", scope?: KvScope, scopeKey?: string): string[] {
    const base = this.key("", scope, scopeKey);
    return [...this.store.keys()].filter((key) => key.startsWith(base)).map((key) => key.slice(base.length)).filter((key) => key.startsWith(prefix)).sort();
  }
  clear(scope?: KvScope, scopeKey?: string): number {
    const base = scopeKey ? `${this.extensionId}\0${scope || "chat"}\0${scopeKey}\0` : scope ? `${this.extensionId}\0${scope}\0` : `${this.extensionId}\0`;
    let count = 0;
    for (const key of [...this.store.keys()]) if (key.startsWith(base)) { this.store.delete(key); count += 1; }
    return count;
  }
}

interface RuntimeKvStore {
  get<T>(extensionId: string, key: string, scope?: KvScope, scopeKey?: string): T | null;
  set(extensionId: string, key: string, value: unknown, scope?: KvScope, scopeKey?: string): void;
  delete(extensionId: string, key: string, scope?: KvScope, scopeKey?: string): boolean;
  list(extensionId: string, prefix?: string, scope?: KvScope, scopeKey?: string): string[];
  clear(extensionId: string, scope?: KvScope, scopeKey?: string): number;
}

class RuntimeBackedStorage implements ExtensionStorage {
  constructor(private extensionId: string, private store: RuntimeKvStore) {}
  get<T>(key: string, scope?: KvScope, scopeKey?: string): T | null { return this.store.get<T>(this.extensionId, key, scope, scopeKey); }
  set(key: string, value: unknown, scope?: KvScope, scopeKey?: string): void { this.store.set(this.extensionId, key, value, scope, scopeKey); }
  delete(key: string, scope?: KvScope, scopeKey?: string): boolean { return this.store.delete(this.extensionId, key, scope, scopeKey); }
  list(prefix?: string, scope?: KvScope, scopeKey?: string): string[] { return this.store.list(this.extensionId, prefix, scope, scopeKey); }
  clear(scope?: KvScope, scopeKey?: string): number { return this.store.clear(this.extensionId, scope, scopeKey); }
}

type RuntimeInterop = {
  createAddonStorage?: (extensionId: string) => ExtensionStorage;
  getExtensionKvStore?: () => RuntimeKvStore;
};

function getRuntimeInterop(): RuntimeInterop | null {
  return (globalThis as { __qiushuiaiRuntimeInterop?: RuntimeInterop }).__qiushuiaiRuntimeInterop || null;
}

export function createExtensionStorage(extensionId: string): ExtensionStorage {
  const runtime = getRuntimeInterop();
  if (runtime?.createAddonStorage) return runtime.createAddonStorage(extensionId);
  if (runtime?.getExtensionKvStore) return new RuntimeBackedStorage(extensionId, runtime.getExtensionKvStore());
  if (runtime) throw new Error("QiushuiAI add-on persistent storage is unavailable; refusing in-memory fallback.");
  return new InMemoryStorage(extensionId);
}
