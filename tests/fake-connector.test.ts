import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeConnector } from "../src/connectors/fake/index.js";

test("fake connector yields deterministic rows", async () => {
  const conn = new FakeConnector(["camp-a", "camp-b"]);
  const handle = await conn.authenticate({
    id: "ica_test",
    channel: "google_ads",
    externalId: "acct-1",
    credentialsEncrypted: "",
  });
  const res = await conn.pullPerformance({
    connection: handle,
    from: new Date("2026-04-01T00:00:00Z"),
    to: new Date("2026-04-02T00:00:00Z"),
  });
  assert.equal(res.rows.length, 4);

  // Gleicher Aufruf → gleiche Ergebnisse (deterministisch)
  const res2 = await conn.pullPerformance({
    connection: handle,
    from: new Date("2026-04-01T00:00:00Z"),
    to: new Date("2026-04-02T00:00:00Z"),
  });
  assert.deepEqual(
    res.rows.map((r) => r.impressions),
    res2.rows.map((r) => r.impressions),
  );
});

test("fake connector rows carry bigint costMicros", async () => {
  const conn = new FakeConnector(["camp-a"]);
  const handle = await conn.authenticate({
    id: "ica_test",
    channel: "google_ads",
    externalId: "acct-1",
    credentialsEncrypted: "",
  });
  const res = await conn.pullPerformance({
    connection: handle,
    from: new Date("2026-04-01T00:00:00Z"),
    to: new Date("2026-04-01T00:00:00Z"),
  });
  assert.equal(typeof res.rows[0]!.costMicros, "bigint");
});
