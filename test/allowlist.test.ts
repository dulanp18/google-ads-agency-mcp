import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCustomerId,
  getAllowedCustomerIds,
  isAllowedCustomer,
} from "../src/google-ads-client.js";
import type { Env } from "../src/types.js";

function envWith(allowed: string): Env {
  return { ALLOWED_CUSTOMER_IDS: allowed } as Env;
}

test("normalizeCustomerId strips dashes and non-digits", () => {
  assert.equal(normalizeCustomerId("123-456-7890"), "1234567890");
  assert.equal(normalizeCustomerId("1234567890"), "1234567890");
  assert.equal(normalizeCustomerId(" 123 456 7890 "), "1234567890");
  assert.equal(normalizeCustomerId(""), "");
});

test("getAllowedCustomerIds parses, normalises, and drops blanks", () => {
  const ids = getAllowedCustomerIds(envWith("123-456-7890, 0987654321"));
  assert.deepEqual([...ids].sort(), ["0987654321", "1234567890"]);

  assert.equal(getAllowedCustomerIds(envWith("")).size, 0);
  assert.equal(getAllowedCustomerIds(envWith("  ,  ")).size, 0);
  assert.equal(getAllowedCustomerIds({} as Env).size, 0);
});

test("isAllowedCustomer matches regardless of formatting", () => {
  const env = envWith("1234567890");
  assert.equal(isAllowedCustomer(env, "123-456-7890"), true);
  assert.equal(isAllowedCustomer(env, "1234567890"), true);
  assert.equal(isAllowedCustomer(env, "0987654321"), false);
});

test("isAllowedCustomer denies everything when allowlist is empty (fail-safe)", () => {
  assert.equal(isAllowedCustomer(envWith(""), "1234567890"), false);
  assert.equal(isAllowedCustomer({} as Env, "1234567890"), false);
});
