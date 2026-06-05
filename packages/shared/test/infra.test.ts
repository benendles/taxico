import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMemoryRepository, createMemoryCache } from "../src/infra";

interface Item {
  id: string;
  name: string;
}

describe("createMemoryRepository", () => {
  it("starts empty", () => {
    const repo = createMemoryRepository<Item>();
    expect(repo.all()).toEqual([]);
  });

  it("inserts and retrieves by id", () => {
    const repo = createMemoryRepository<Item>();
    repo.insert({ id: "a", name: "Alpha" });
    expect(repo.get("a")).toEqual({ id: "a", name: "Alpha" });
  });

  it("returns undefined for a missing id", () => {
    const repo = createMemoryRepository<Item>();
    expect(repo.get("nope")).toBeUndefined();
  });

  it("finds by predicate", () => {
    const repo = createMemoryRepository<Item>();
    repo.insert({ id: "a", name: "Alpha" });
    repo.insert({ id: "b", name: "Beta" });
    expect(repo.find((i) => i.name === "Beta")?.id).toBe("b");
  });

  it("lists all inserted items", () => {
    const repo = createMemoryRepository<Item>();
    repo.insert({ id: "a", name: "Alpha" });
    repo.insert({ id: "b", name: "Beta" });
    expect(repo.all()).toHaveLength(2);
  });

  it("overwrites an item inserted with an existing id", () => {
    const repo = createMemoryRepository<Item>();
    repo.insert({ id: "a", name: "Alpha" });
    repo.insert({ id: "a", name: "Updated" });
    expect(repo.get("a")?.name).toBe("Updated");
    expect(repo.all()).toHaveLength(1);
  });

  it("removes an item and reports success", () => {
    const repo = createMemoryRepository<Item>();
    repo.insert({ id: "a", name: "Alpha" });
    expect(repo.remove("a")).toBe(true);
    expect(repo.get("a")).toBeUndefined();
  });

  it("returns false when removing a missing id", () => {
    const repo = createMemoryRepository<Item>();
    expect(repo.remove("ghost")).toBe(false);
  });
});

describe("createMemoryCache", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stores and retrieves a value", () => {
    const cache = createMemoryCache();
    cache.set("k", 42);
    expect(cache.get<number>("k")).toBe(42);
  });

  it("returns undefined for a missing key", () => {
    const cache = createMemoryCache();
    expect(cache.get("missing")).toBeUndefined();
  });

  it("deletes a key", () => {
    const cache = createMemoryCache();
    cache.set("k", "v");
    cache.del("k");
    expect(cache.get("k")).toBeUndefined();
  });

  it("keeps values with no TTL indefinitely", () => {
    const cache = createMemoryCache();
    cache.set("k", "v");
    vi.advanceTimersByTime(1_000_000);
    expect(cache.get("k")).toBe("v");
  });

  it("expires values after their TTL", () => {
    const cache = createMemoryCache();
    cache.set("k", "v", 1000);
    expect(cache.get("k")).toBe("v");
    vi.advanceTimersByTime(1500);
    expect(cache.get("k")).toBeUndefined();
  });
});
