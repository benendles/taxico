/**
 * Infrastructure ports for the data layer in the architecture diagram.
 *
 * The MVP ships in-memory implementations so every service runs with zero external
 * dependencies. The interfaces are intentionally narrow so they can be backed by the
 * production stores (PostgreSQL/PostGIS for `Repository`, Redis for `Cache`) without
 * touching service logic.
 */

export interface Repository<T extends { id: string }> {
  all(): T[];
  get(id: string): T | undefined;
  find(predicate: (item: T) => boolean): T | undefined;
  insert(item: T): T;
  remove(id: string): boolean;
}

/** In-memory `Repository` — swap for a PostgreSQL/PostGIS-backed implementation. */
export function createMemoryRepository<T extends { id: string }>(): Repository<T> {
  const store = new Map<string, T>();
  return {
    all: () => [...store.values()],
    get: (id) => store.get(id),
    find: (predicate) => [...store.values()].find(predicate),
    insert: (item) => {
      store.set(item.id, item);
      return item;
    },
    remove: (id) => store.delete(id),
  };
}

export interface Cache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs?: number): void;
  del(key: string): void;
}

/** In-memory, TTL-aware `Cache` — swap for a Redis-backed implementation. */
export function createMemoryCache(): Cache {
  const store = new Map<string, { value: unknown; expiresAt: number | null }>();
  return {
    get<T>(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value as T;
    },
    set<T>(key: string, value: T, ttlMs?: number) {
      store.set(key, { value, expiresAt: ttlMs ? Date.now() + ttlMs : null });
    },
    del(key: string) {
      store.delete(key);
    },
  };
}
