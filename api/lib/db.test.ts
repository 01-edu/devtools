// db_test.ts
import { afterEach, beforeEach, describe, it } from "jsr:@std/testing/bdd";
import {
  assert,
  assertEquals,
  assertExists,
  assertRejects,
} from "jsr:@std/assert";
import { createCollection } from "./db.ts";
import { ensureDir } from "jsr:@std/fs";

type User = {
  id: number;
  email: string;
  username: string;
  age?: number | null;
};

let dbDir: string;

beforeEach(async () => {
  dbDir = './db_test';
  await ensureDir(dbDir);
});

afterEach(async () => {
  try {
    await Deno.remove(dbDir, { recursive: true });
  } catch {
    /* ignore */
  }
});

describe("createCollection", () => {
  it("inserts a record with an auto-generated numeric id", async () => {
    const users = createCollection<User, "id">({
      name: "users",
      primaryKey: "id",
      uniqueKeys: ["email", "username"],
      cacheSize: 10,
    });

    await users.init();

    const inserted = await users.insert({
      email: "alice@example.com",
      username: "alice",
      age: 30,
    });
    
    assertEquals(inserted.email, "alice@example.com");
    assertEquals(inserted.username, "alice");
    assertEquals(typeof inserted.id, "number");
  });

  it("finds a record by id", async () => {
    const users = createCollection<User, "id">({
      name: "users",
      primaryKey: "id",
      uniqueKeys: ["email"],
    });
    await users.init();

    const inserted = await users.insert({ email: "bob@example.com", username: "bob" });
    const found = await users.findById(inserted.id);

    assertEquals(found, inserted);
  });

  it("returns null when record not found by id", async () => {
    const users = createCollection<User, "id">({
      name: "users",
      primaryKey: "id",
    });
    await users.init();

    const found = await users.findById(999);
    assertEquals(found, null);
  });

  it("updates a record", async () => {
    const users = createCollection<User, "id">({
      name: "users",
      primaryKey: "id",
      uniqueKeys: ["email"],
    });
    await users.init();

    const inserted = await users.insert({ email: "charlie@example.com", username: "charlie" });
    const updated = await users.update(inserted.id, { age: 25 });

    assertExists(updated);
    assertEquals(updated.age, 25);
    assertEquals(updated.email, "charlie@example.com");
  });

  it("deletes a record", async () => {
    const users = createCollection<User, "id">({
      name: "users",
      primaryKey: "id",
    });
    await users.init();

    const inserted = await users.insert({ email: "dave@example.com", username: "dave" });
    const deleted = await users.delete(inserted.id);
    assert(deleted);

    const found = await users.findById(inserted.id);
    assertEquals(found, null);
  });

  it("finds records using predicate", async () => {
    const users = createCollection<User, "id">({
      name: "users",
      primaryKey: "id",
    });
    await users.init();

    await users.insert({ email: "eve@example.com", username: "eve", age: 20 });
    await users.insert({ email: "frank@example.com", username: "frank", age: 30 });
    await users.insert({ email: "grace@example.com", username: "grace", age: 20 });

    const age20 = await users.find((u) => u.age === 20);
    assertEquals(age20.length, 2);
  });

  it("enforces unique key constraint on insert", async () => {
    const users = createCollection<User, "id">({
      name: "users",
      primaryKey: "id",
      uniqueKeys: ["email"],
    });
    await users.init();

    await users.insert({ email: "hank@example.com", username: "hank" });
    await assertRejects(
      async () => {
        await users.insert({ email: "hank@example.com", username: "other" });
      },
      Error,
      'email "hank@example.com" already exists',
    );
  });

  it("enforces unique key constraint on update", async () => {
    const users = createCollection<User, "id">({
      name: "users",
      primaryKey: "id",
      uniqueKeys: ["email"],
    });
    await users.init();

    const a = await users.insert({ email: "a@example.com", username: "a" });
    await users.insert({ email: "b@example.com", username: "b" });

    await assertRejects(
      async () => {
        await users.update(a.id, { email: "b@example.com" });
      },
      Error,
      'email "b@example.com" already exists',
    );
  });

  it("allows reusing unique value after delete", async () => {
    const users = createCollection<User, "id">({
      name: "users",
      primaryKey: "id",
      uniqueKeys: ["email"],
    });
    await users.init();

    const inserted = await users.insert({ email: "reuse@example.com", username: "reuse" });
    await users.delete(inserted.id);

    const reused = await users.insert({ email: "reuse@example.com", username: "reused" });
    assertEquals(reused.email, "reuse@example.com");
  });

  it("returns null/false for update/delete on non-existent id", async () => {
    const users = createCollection<User, "id">({
      name: "users",
      primaryKey: "id",
    });
    await users.init();

    const updated = await users.update(999, { email: "none@example.com" });
    assertEquals(updated, null);

    const deleted = await users.delete(999);
    assertEquals(deleted, false);
  });

  it("handles null/undefined unique fields gracefully", async () => {
    const users = createCollection<User, "id">({
      name: "users",
      primaryKey: "id",
      uniqueKeys: ["username"],
    });
    await users.init();

    const a = await users.insert({ email: "a@example.com", username: "a", age: null });
    assertExists(a);
    const b = await users.insert({ email: "b@example.com", username: "b", age: undefined });
    assertExists(b);
  });

  it("evicts LRU cache when cacheSize exceeded", async () => {
    const users = createCollection<User, "id">({
      name: "users",
      primaryKey: "id",
      cacheSize: 2,
    });
    await users.init();

    const a = await users.insert({ email: "a@example.com", username: "a" });
     await users.insert({ email: "b@example.com", username: "b" });
     await users.insert({ email: "c@example.com", username: "c" });

    // Access a again to ensure it's reloaded from disk
    const reloadedA = await users.findById(a.id);
    assertEquals(reloadedA?.email, "a@example.com");
  });
});