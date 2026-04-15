import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionCampaign,
  canTransitionAssetVersion,
} from "../src/domain/policies.js";

test("campaign DRAFT → IN_REVIEW is allowed", () => {
  assert.equal(canTransitionCampaign("DRAFT", "IN_REVIEW"), true);
});

test("campaign DRAFT → SYNCED is not allowed", () => {
  assert.equal(canTransitionCampaign("DRAFT", "SYNCED"), false);
});

test("campaign ARCHIVED is terminal", () => {
  assert.equal(canTransitionCampaign("ARCHIVED", "DRAFT"), false);
  assert.equal(canTransitionCampaign("ARCHIVED", "SYNCED"), false);
});

test("asset version APPROVED → PUBLISHED is allowed", () => {
  assert.equal(canTransitionAssetVersion("APPROVED", "PUBLISHED"), true);
});

test("asset version DRAFT → PUBLISHED is not allowed", () => {
  assert.equal(canTransitionAssetVersion("DRAFT", "PUBLISHED"), false);
});
