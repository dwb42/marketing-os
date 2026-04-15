import { test } from "node:test";
import assert from "node:assert/strict";
import { newId, isId, ID_PREFIXES } from "../src/lib/ids.js";

test("newId returns a prefixed ULID", () => {
  const id = newId("campaign");
  assert.ok(id.startsWith(`${ID_PREFIXES.campaign}_`));
  assert.equal(isId("cmp", id), true);
  assert.equal(isId("ast", id), false);
});

test("newId values are unique", () => {
  const a = newId("asset");
  const b = newId("asset");
  assert.notEqual(a, b);
});
