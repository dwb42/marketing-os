import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { newId } from "../src/lib/ids.js";
import { attributionService } from "../src/services/attribution.service.js";

// Integration test. Requires a live Postgres matching DATABASE_URL in .env.
// Creates a throwaway workspace/brand/product for each file-run so tests
// stay isolated from existing data.

const prisma = new PrismaClient();

const workspaceId = newId("workspace");
const brandId = newId("brand");
const productId = newId("product");

before(async () => {
  await prisma.workspace.create({
    data: { id: workspaceId, slug: `test-attr-${Date.now()}`, name: "Test Attr" },
  });
  await prisma.brand.create({
    data: { id: brandId, workspaceId, slug: "test-brand", name: "Test Brand" },
  });
  await prisma.product.create({
    data: { id: productId, workspaceId, brandId, slug: "test-prod", name: "Test Prod" },
  });
});

after(async () => {
  // Clean up in FK-safe order. onDelete: Cascade does most of it, but we
  // reach from Product to Workspace to tear the whole subtree down.
  await prisma.workspace.delete({ where: { id: workspaceId } });
  await prisma.$disconnect();
});

async function seedClick(occurredAt: Date, sessionRef = `cid_${Math.random().toString(36).slice(2)}`) {
  const id = newId("outcome");
  await prisma.productOutcomeEvent.create({
    data: {
      id,
      productId,
      type: "cta_click",
      occurredAt,
      sessionRef,
      attribution: {},
      payload: {},
    },
  });
  return { id, sessionRef };
}

test("confirmed match when exactly one click is in the 15-min window", async () => {
  const click = await seedClick(new Date("2030-01-01T10:00:00Z"), "testcid1");
  const res = await attributionService.match({
    productId,
    messageHash: "a".repeat(32),
    senderHash: "s".repeat(32),
    occurredAt: new Date("2030-01-01T10:00:10Z"),
  });
  assert.equal(res.confidence, "confirmed");
  assert.equal(res.sessionRef, "testcid1");

  const row = await prisma.productOutcomeEvent.findUnique({ where: { id: click.id } });
  assert.ok(row?.matchedAt, "matchedAt should be set on the claimed event");
});

test("unattributed when no click is in the window", async () => {
  const res = await attributionService.match({
    productId,
    messageHash: "b".repeat(32),
    senderHash: "s".repeat(32),
    occurredAt: new Date("2030-02-01T10:00:00Z"), // no clicks seeded here
  });
  assert.equal(res.confidence, "unattributed");
  assert.equal(res.sessionRef, null);
});

test("ambiguous: two unmatched clicks in the window, nearest wins", async () => {
  const messageTime = new Date("2030-03-01T10:00:00Z");
  // near = 30s before the message; far = 10 minutes before
  const far = await seedClick(new Date(messageTime.getTime() - 10 * 60 * 1000), "far");
  const near = await seedClick(new Date(messageTime.getTime() - 30 * 1000), "near");

  const res = await attributionService.match({
    productId,
    messageHash: "c".repeat(32),
    senderHash: "s".repeat(32),
    occurredAt: messageTime,
  });
  assert.equal(res.confidence, "ambiguous");
  assert.equal(res.sessionRef, "near");

  // The winner is matched; the loser remains claimable for a later message.
  const winner = await prisma.productOutcomeEvent.findUnique({ where: { id: near.id } });
  const loser = await prisma.productOutcomeEvent.findUnique({ where: { id: far.id } });
  assert.ok(winner?.matchedAt);
  assert.equal(loser?.matchedAt, null);
});

test("already-matched clicks are excluded from subsequent matches", async () => {
  const t0 = new Date("2030-04-01T10:00:00Z");
  await seedClick(t0, "once-only");

  const first = await attributionService.match({
    productId,
    messageHash: "d".repeat(32),
    senderHash: "s".repeat(32),
    occurredAt: new Date(t0.getTime() + 5_000),
  });
  assert.equal(first.confidence, "confirmed");

  // Same message-like call just slightly later — no other clicks exist.
  const second = await attributionService.match({
    productId,
    messageHash: "e".repeat(32),
    senderHash: "s".repeat(32),
    occurredAt: new Date(t0.getTime() + 10_000),
  });
  assert.equal(second.confidence, "unattributed");
  assert.equal(second.sessionRef, null);
});

test("every call writes an AttributionMatch row (success or miss)", async () => {
  const beforeCount = await prisma.attributionMatch.count({ where: { productId } });
  await attributionService.match({
    productId,
    messageHash: "f".repeat(32),
    senderHash: "s".repeat(32),
    occurredAt: new Date("2030-05-01T10:00:00Z"),
  });
  const afterCount = await prisma.attributionMatch.count({ where: { productId } });
  assert.equal(afterCount, beforeCount + 1);
});
