import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { loadEnv } from "../config/env.js";

// AES-256-GCM Credential Encryption für IntegrationAccount.credentials.
// Key liegt in MOS_CREDENTIAL_KEY als base64 (32 Byte).
// Format: base64(iv ‖ authTag ‖ ciphertext).

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const env = loadEnv();
  if (!env.MOS_CREDENTIAL_KEY) {
    throw new Error("MOS_CREDENTIAL_KEY is not set. Generate with: openssl rand -base64 32");
  }
  const key = Buffer.from(env.MOS_CREDENTIAL_KEY, "base64");
  if (key.length !== 32) {
    throw new Error("MOS_CREDENTIAL_KEY must decode to 32 bytes");
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(ciphertextB64: string): string {
  const key = getKey();
  const buf = Buffer.from(ciphertextB64, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

// Guard to prevent accidental logging of secret payloads.
export function redactCredentials<T extends object>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (key, value) => (key === "credentials" ? "[REDACTED]" : value)),
  );
}
