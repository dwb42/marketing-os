import { test } from "node:test";
import assert from "node:assert/strict";

// Boot-Test: Der Server soll sich bauen lassen, ohne eine echte DB zu
// brauchen. Wir setzen DATABASE_URL auf einen Dummy-Wert und bauen die
// Fastify-Instanz. /health darf ohne DB antworten.

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/test";
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error";

test("server builds and responds to /health", async () => {
  const { buildServer } = await import("../src/api/server.js");
  const app = await buildServer();
  try {
    const res = await app.inject({ method: "GET", url: "/health" });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { status: string };
    assert.equal(body.status, "ok");
  } finally {
    await app.close();
  }
});

test("unknown route returns 404", async () => {
  const { buildServer } = await import("../src/api/server.js");
  const app = await buildServer();
  try {
    const res = await app.inject({ method: "GET", url: "/does-not-exist" });
    assert.equal(res.statusCode, 404);
  } finally {
    await app.close();
  }
});
