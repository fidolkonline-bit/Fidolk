import { test } from "node:test";
import assert from "node:assert/strict";
import { chatContext, chatRequestSchema } from "../lib/ai-chat";
import { createSeed } from "../lib/seed";
import type { AuthUser } from "../lib/types";

const owner: AuthUser = {
  id: "owner",
  name: "Fido Owner",
  username: "owner",
  active: true,
  role: "Owner",
  permissions: ["*"],
};
const cashier: AuthUser = {
  ...owner,
  id: "cashier",
  name: "Kasun Perera",
  role: "Cashier",
  permissions: ["dashboard.view", "sales.view"],
};

test("Fido only sees what the person asking may see", () => {
  const s = createSeed();
  const full = chatContext(s, owner);
  for (const key of ["today", "stock", "repairsInShop", "customerBalances"])
    assert.ok(key in full, `owner should see ${key}`);
  const limited = chatContext(s, cashier);
  assert.ok("today" in limited);
  for (const key of ["stock", "repairsInShop", "customerBalances", "reloads"])
    assert.ok(!(key in limited), `cashier should not see ${key}`);
  assert.deepEqual(limited.askedBy, { name: "Kasun", role: "Cashier" });
});

test("the business data sent to the model has no phone numbers or IMEIs", () => {
  const s = createSeed();
  s.repairs[0].device = "Galaxy A54 imei 356789012345678";
  s.repairs[0].issue = "Customer 0771234567 says screen flickers";
  const text = JSON.stringify(chatContext(s, owner));
  assert.doesNotMatch(text, /\b(?:\+?94|0)7\d{8}\b/);
  assert.doesNotMatch(text, /\b\d{15}\b/);
  for (const customer of s.customers)
    if (customer.phone) assert.ok(!text.includes(customer.phone));
});

test("a chat must end with the person's message and stay within limits", () => {
  assert.throws(() =>
    chatRequestSchema.parse({
      messages: [{ role: "model", text: "Hello" }],
    }),
  );
  assert.throws(() =>
    chatRequestSchema.parse({
      messages: Array.from({ length: 31 }, () => ({
        role: "user",
        text: "hi",
      })),
    }),
  );
  const ok = chatRequestSchema.parse({
    messages: [{ role: "user", text: "How are sales today?" }],
  });
  assert.equal(ok.language, "English");
});
