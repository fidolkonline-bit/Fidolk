import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { redactSensitiveText } from "../lib/ai";
import { applyAction } from "../lib/business";
import { createEmptyWorkspace } from "../lib/seed";

test("AI redaction removes phone, IMEI, email and device credentials", () => {
  const result = redactSensitiveText(
    "Call 0771234567 about IMEI 356789012340001 at user@example.com; PIN: 1234.",
  );
  assert.doesNotMatch(result, /0771234567/);
  assert.doesNotMatch(result, /356789012340001/);
  assert.doesNotMatch(result, /user@example.com/);
  assert.doesNotMatch(result, /1234/);
  assert.match(result, /PHONE REDACTED/);
  assert.match(result, /DEVICE CREDENTIAL REDACTED/);
});

test("AI configuration encrypts the API key and never retains plaintext", () => {
  const workspace = createEmptyWorkspace();
  applyAction(workspace, {
    type: "configureAi",
    requestId: randomUUID(),
    payload: {
      enabled: true,
      apiKey: "test-secret-key-1234",
      primaryModel: "gemini-3.8-flash",
      fallbackModel: "gemini-2.5-flash-lite",
      dailyRequestLimit: 12,
      features: {
        dailyBrief: true,
        repairAssistant: false,
        customerMessages: true,
        invoiceExtraction: true,
        inventoryInsights: true,
        askFido: false,
        anomalyReview: true,
        marketingCopy: true,
      },
    },
  });
  assert.equal(workspace.settings.ai.apiKeyConfigured, true);
  assert.equal(workspace.settings.ai.apiKeyLastFour, "1234");
  assert.equal(workspace.settings.ai.dailyRequestLimit, 12);
  assert.notEqual(
    workspace.settings.ai.apiKeyCiphertext,
    "test-secret-key-1234",
  );
  assert.equal(workspace.settings.ai.features.repairAssistant, false);
});

test("AI quota resets by business date and rejects excess requests", () => {
  const workspace = createEmptyWorkspace();
  workspace.settings.ai.dailyRequestLimit = 2;
  const record = (usageDate: string) =>
    applyAction(workspace, {
      type: "recordAiRequest",
      requestId: randomUUID(),
      payload: { usageDate },
    });
  record("2026-09-21");
  record("2026-09-21");
  assert.throws(() => record("2026-09-21"), /daily AI request limit/i);
  record("2026-09-22");
  assert.equal(workspace.settings.ai.requestsToday, 1);
  assert.equal(workspace.settings.ai.usageDate, "2026-09-22");
});

test("reviewed AI customer copy is queued only through an explicit action", () => {
  const workspace = createEmptyWorkspace();
  applyAction(workspace, {
    type: "queueSms",
    requestId: randomUUID(),
    payload: {
      phone: "0771234567",
      message: "Your repair is ready for collection.",
    },
  });
  assert.equal(workspace.sms.length, 1);
  assert.equal(workspace.sms[0].status, "Pending configuration");
  assert.equal(
    workspace.sms[0].message,
    "Your repair is ready for collection.",
  );
});
