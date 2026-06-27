import "@testing-library/jest-dom/vitest";

// jsdom 27 はオプトイン無しでは localStorage / sessionStorage を露出しない。
// テストが Web Storage に依存するため、未定義時のみ最小実装を注入する。
class MemoryStorage implements Storage {
  #store = new Map<string, string>();

  get length(): number {
    return this.#store.size;
  }

  clear(): void {
    this.#store.clear();
  }

  getItem(key: string): string | null {
    return this.#store.has(key) ? this.#store.get(key)! : null;
  }

  key(index: number): string | null {
    return [...this.#store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#store.set(key, String(value));
  }
}

function ensureStorage(name: "localStorage" | "sessionStorage") {
  if (typeof globalThis[name] !== "undefined") return;
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, name, { value: storage, configurable: true });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, name, { value: storage, configurable: true });
  }
}

ensureStorage("localStorage");
ensureStorage("sessionStorage");
