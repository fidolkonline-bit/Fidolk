"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  KeyRound,
  LoaderCircle,
  PlugZap,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { AiFeature, AiSettings } from "@/lib/types";
import styles from "./ai-settings.module.css";

const featureOptions: Array<{
  id: AiFeature;
  label: string;
  description: string;
}> = [
  {
    id: "dailyBrief",
    label: "Daily brief",
    description: "Owner priorities and performance",
  },
  {
    id: "repairAssistant",
    label: "Repair assistant",
    description: "Intake and inspection guidance",
  },
  {
    id: "customerMessages",
    label: "Customer messages",
    description: "Reviewable customer drafts",
  },
  {
    id: "invoiceExtraction",
    label: "Invoice / GRN",
    description: "Document field extraction",
  },
  {
    id: "inventoryInsights",
    label: "Inventory insights",
    description: "Stock and reorder guidance",
  },
  {
    id: "askFido",
    label: "Ask Fido",
    description: "Business summary questions",
  },
  {
    id: "anomalyReview",
    label: "Anomaly review",
    description: "Operational warning review",
  },
  {
    id: "marketingCopy",
    label: "Marketing copy",
    description: "Product and campaign copy",
  },
];

type Action = (
  type: string,
  payload: Record<string, unknown>,
) => Promise<unknown>;

export function AiSettingsPanel({
  settings,
  action,
  busy,
}: {
  settings: AiSettings;
  action: Action;
  busy: boolean;
}) {
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<
    { type: "success" | "error"; message: string } | undefined
  >();
  const [removing, setRemoving] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [features, setFeatures] = useState(settings.features);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => setFeatures(settings.features), [settings.features]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const key = String(form.get("apiKey") || "").trim();
    const saved = await action("configureAi", {
      enabled: form.get("enabled") === "on",
      ...(key ? { apiKey: key } : {}),
      primaryModel: form.get("primaryModel"),
      fallbackModel: form.get("fallbackModel"),
      dailyRequestLimit: Number(form.get("dailyRequestLimit")),
      features,
    });
    if (saved) {
      element.reset();
      setApiKeyDraft("");
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestStatus(undefined);
    try {
      const form = formRef.current ? new FormData(formRef.current) : null;
      const candidateKey = String(form?.get("apiKey") || "").trim();
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "test",
          ...(candidateKey ? { apiKey: candidateKey } : {}),
          model: String(form?.get("primaryModel") || settings.primaryModel),
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Connection test failed.",
        );
      setTestStatus({
        type: "success",
        message: `Connection succeeded with ${body.model || "Gemini"}.`,
      });
    } catch (error) {
      setTestStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "Connection test failed.",
      });
    } finally {
      setTesting(false);
    }
  }

  async function removeKey() {
    setRemoving(true);
    try {
      await action("configureAi", {
        enabled: false,
        clearApiKey: true,
        primaryModel: settings.primaryModel,
        fallbackModel: settings.fallbackModel,
        dailyRequestLimit: settings.dailyRequestLimit,
        features,
      });
      setTestStatus(undefined);
    } finally {
      setRemoving(false);
    }
  }

  const usagePercent = Math.min(
    100,
    Math.round(
      (settings.requestsToday / Math.max(settings.dailyRequestLimit, 1)) * 100,
    ),
  );

  return (
    <section className={styles.panel} aria-labelledby="ai-settings-title">
      <div className={styles.heading}>
        <div className={styles.title}>
          <span className={styles.icon}>
            <Bot size={20} />
          </span>
          <div>
            <span className={styles.eyebrow}>INTELLIGENCE LAYER</span>
            <h2 id="ai-settings-title">AI & automation</h2>
            <p>
              Connect Gemini and choose which advisory tools your team can use.
            </p>
          </div>
        </div>
        <div className={styles.status}>
          <i
            className={
              settings.enabled && settings.apiKeyConfigured
                ? styles.statusOn
                : styles.statusOff
            }
          />
          <span>
            <strong>
              {settings.enabled && settings.apiKeyConfigured
                ? "Connected and enabled"
                : settings.apiKeyConfigured
                  ? "Connected, currently paused"
                  : "Not connected"}
            </strong>
            <small>
              {settings.apiKeyConfigured
                ? `Stored key ••••${settings.apiKeyLastFour || ""}`
                : "Add a Gemini API key to begin"}
            </small>
          </span>
        </div>
      </div>

      <form ref={formRef} onSubmit={submit}>
        <div className={styles.configGrid}>
          <div className={styles.connectionColumn}>
            <div className={styles.sectionHeading}>
              <h3>Connection</h3>
              <label className={styles.masterSwitch}>
                <input
                  name="enabled"
                  type="checkbox"
                  defaultChecked={settings.enabled}
                  disabled={
                    busy || (!settings.apiKeyConfigured && !apiKeyDraft.trim())
                  }
                />
                <span>Enable AI</span>
              </label>
            </div>

            <label className={styles.field}>
              <span>Gemini API key</span>
              <div className={styles.keyField}>
                <KeyRound size={16} />
                <input
                  name="apiKey"
                  type="password"
                  autoComplete="new-password"
                  placeholder={
                    settings.apiKeyConfigured
                      ? "Leave blank to keep the stored key"
                      : "Paste a new API key"
                  }
                  aria-describedby="ai-key-help"
                  disabled={busy}
                  value={apiKeyDraft}
                  onChange={(event) => setApiKeyDraft(event.target.value)}
                />
              </div>
              <small id="ai-key-help">
                Write-only: the stored key is encrypted and is never sent back
                to this browser.
              </small>
            </label>

            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span>Primary model</span>
                <input
                  name="primaryModel"
                  defaultValue={settings.primaryModel}
                  required
                  pattern="gemini-[A-Za-z0-9.-]+"
                  disabled={busy}
                />
              </label>
              <label className={styles.field}>
                <span>Fallback model</span>
                <input
                  name="fallbackModel"
                  defaultValue={settings.fallbackModel}
                  required
                  pattern="gemini-[A-Za-z0-9.-]+"
                  disabled={busy}
                />
              </label>
            </div>

            <label className={styles.field}>
              <span>Daily request limit</span>
              <input
                name="dailyRequestLimit"
                type="number"
                min={1}
                max={10000}
                defaultValue={settings.dailyRequestLimit}
                required
                disabled={busy}
              />
              <small>
                This Fido limit prevents unexpected usage. Provider quotas still
                apply.
              </small>
            </label>

            <div className={styles.usage}>
              <div>
                <span>Today’s usage</span>
                <strong>
                  {settings.requestsToday} / {settings.dailyRequestLimit}{" "}
                  requests
                </strong>
              </div>
              <progress
                max={100}
                value={usagePercent}
                aria-label="AI daily usage percentage"
              />
            </div>

            {(settings.lastSuccessAt || settings.lastError) && (
              <div className={styles.connectionHistory}>
                {settings.lastSuccessAt && (
                  <span>
                    <Check size={14} />
                    Last success{" "}
                    {new Date(settings.lastSuccessAt).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Colombo",
                    })}
                  </span>
                )}
                {settings.lastError && (
                  <span className={styles.lastError}>
                    <AlertTriangle size={14} /> Latest error:{" "}
                    {settings.lastError}
                  </span>
                )}
              </div>
            )}
          </div>

          <fieldset className={styles.features}>
            <legend>Enabled workflows</legend>
            <p>Turn off any workflow that your team should not use.</p>
            <div className={styles.featureList}>
              {featureOptions.map((feature) => (
                <label key={feature.id}>
                  <span>
                    <strong>{feature.label}</strong>
                    <small>{feature.description}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={features[feature.id]}
                    onChange={(event) =>
                      setFeatures((current) => ({
                        ...current,
                        [feature.id]: event.target.checked,
                      }))
                    }
                    disabled={busy}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className={styles.notices}>
          <div>
            <ShieldCheck size={18} />
            <p>
              <strong>Privacy boundary</strong>
              Sensitive customer data, phone numbers, IMEIs and credentials are
              redacted where possible. Staff should never paste PINs, passwords
              or unlock patterns.
            </p>
          </div>
          <div>
            <PlugZap size={18} />
            <p>
              <strong>Automatic fallback</strong>
              If the primary model is rate-limited or temporarily unavailable,
              Fido tries the fallback model. Keys from the same Google project
              usually share a quota.
            </p>
          </div>
        </div>

        {testStatus && (
          <div
            className={
              testStatus.type === "success"
                ? styles.testSuccess
                : styles.testError
            }
            role={testStatus.type === "error" ? "alert" : "status"}
          >
            {testStatus.type === "success" ? (
              <Check size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            {testStatus.message}
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.save}
            disabled={busy || removing || testing}
          >
            <Save size={16} /> Save AI configuration
          </button>
          <button
            type="button"
            className={styles.test}
            onClick={testConnection}
            disabled={
              busy ||
              testing ||
              removing ||
              (!settings.apiKeyConfigured && !apiKeyDraft.trim())
            }
          >
            {testing ? (
              <LoaderCircle className={styles.spinner} size={16} />
            ) : (
              <PlugZap size={16} />
            )}
            {testing ? "Testing…" : "Test connection"}
          </button>
          {settings.apiKeyConfigured && (
            <button
              type="button"
              className={styles.remove}
              onClick={removeKey}
              disabled={busy || removing || testing}
            >
              {removing ? (
                <LoaderCircle className={styles.spinner} size={16} />
              ) : (
                <Trash2 size={16} />
              )}
              Remove key
            </button>
          )}
          <small className={styles.testHint}>
            Tests use one Gemini request and do not save a pasted key.
          </small>
        </div>
      </form>
    </section>
  );
}
