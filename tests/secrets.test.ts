import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/test";
process.env.MOS_CREDENTIAL_KEY = randomBytes(32).toString("base64");

const { encryptSecret, decryptSecret, redactCredentials } = await import(
  "../src/lib/secrets.js"
);

test("encryptSecret/decryptSecret round-trip", () => {
  const plain = "refresh_token_abc_xyz_12345";
  const ct = encryptSecret(plain);
  assert.notEqual(ct, plain);
  assert.equal(decryptSecret(ct), plain);
});

test("encryptSecret produces different ciphertexts for same plaintext", () => {
  const plain = "same";
  assert.notEqual(encryptSecret(plain), encryptSecret(plain));
});

test("redactCredentials hides the credentials field", () => {
  const obj = { id: "ica_x", credentials: { refresh: "secret" } };
  const redacted = redactCredentials(obj);
  assert.equal(redacted.credentials, "[REDACTED]");
  assert.equal(redacted.id, "ica_x");
});
