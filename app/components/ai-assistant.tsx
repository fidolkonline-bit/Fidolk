"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Check,
  Clipboard,
  FileScan,
  Lightbulb,
  LoaderCircle,
  MessageSquareText,
  PackageSearch,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import type { AiFeature, AiSettings } from "@/lib/types";
import styles from "./ai-assistant.module.css";

type AiResult = {
  title: string;
  summary: string;
  sections: { heading: string; items: string[] }[];
  draft?: string | null;
  fields?: {
    label: string;
    value: string;
    confidence?: "high" | "medium" | "low";
  }[];
  lines?: {
    description: string;
    sku?: string | null;
    quantity?: number | null;
    unitCost?: number | null;
    total?: number | null;
  }[];
  warnings: string[];
  model: string;
};

const features: Array<{
  id: AiFeature;
  label: string;
  description: string;
  prompt: string;
  placeholder: string;
  icon: typeof Bot;
  optional?: boolean;
}> = [
  {
    id: "dailyBrief",
    label: "Daily brief",
    description: "Today’s performance and priorities",
    prompt: "What should the owner focus on today?",
    placeholder:
      "Add a focus area or leave this blank for a complete briefing.",
    icon: Sparkles,
    optional: true,
  },
  {
    id: "repairAssistant",
    label: "Repair assistant",
    description: "Safe intake and inspection guidance",
    prompt: "Describe the device and reported fault",
    placeholder:
      "Example: Samsung A54 was exposed to water. Screen flickers and fingerprint reader is not responding.",
    icon: Wrench,
  },
  {
    id: "customerMessages",
    label: "Customer message",
    description: "Reviewable SMS or WhatsApp copy",
    prompt: "What should the customer know?",
    placeholder:
      "Include only confirmed facts, such as repair status, collection instructions, or payment reminder details.",
    icon: MessageSquareText,
  },
  {
    id: "invoiceExtraction",
    label: "Invoice / GRN",
    description: "Extract a supplier document",
    prompt: "Upload an invoice and add an optional note",
    placeholder:
      "Optional: identify the supplier or clarify hard-to-read details.",
    icon: FileScan,
    optional: true,
  },
  {
    id: "inventoryInsights",
    label: "Inventory insights",
    description: "Stock risk and reorder priorities",
    prompt: "What would you like to understand?",
    placeholder: "Optional: focus on low stock, stock value, or a department.",
    icon: PackageSearch,
    optional: true,
  },
  {
    id: "askFido",
    label: "Ask Fido",
    description: "Questions about business summaries",
    prompt: "Ask a business question",
    placeholder: "Example: Why is today’s sales performance below target?",
    icon: Bot,
  },
  {
    id: "anomalyReview",
    label: "Anomaly review",
    description: "Explain operational warning signals",
    prompt: "Review current warning signals",
    placeholder:
      "Optional: ask the assistant to focus on stock, repairs, or sales.",
    icon: AlertTriangle,
    optional: true,
  },
  {
    id: "marketingCopy",
    label: "Marketing copy",
    description: "Truthful product and campaign copy",
    prompt: "Provide approved product or campaign facts",
    placeholder:
      "Include the product, verified specifications, price or offer, audience, and preferred channel.",
    icon: Lightbulb,
  },
];

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("The selected image could not be read."));
    reader.readAsDataURL(file);
  });

export function AiAssistant({
  settings,
  action,
  allowedFeatures,
  canQueueSms = false,
}: {
  settings: AiSettings;
  action: (type: string, payload: Record<string, unknown>) => Promise<unknown>;
  allowedFeatures?: AiFeature[];
  canQueueSms?: boolean;
}) {
  const availableFeatures = useMemo(
    () =>
      features.filter(
        (feature) =>
          settings.features[feature.id] &&
          (!allowedFeatures || allowedFeatures.includes(feature.id)),
      ),
    [allowedFeatures, settings.features],
  );
  const [featureId, setFeatureId] = useState<AiFeature>(
    availableFeatures[0]?.id || "dailyBrief",
  );
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState("English");
  const [customerPhone, setCustomerPhone] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [queueStatus, setQueueStatus] = useState("");
  const [usage, setUsage] = useState({
    requestsToday: settings.requestsToday,
    dailyRequestLimit: settings.dailyRequestLimit,
  });
  const fileInput = useRef<HTMLInputElement | null>(null);
  const active =
    availableFeatures.find((feature) => feature.id === featureId) ||
    availableFeatures[0] ||
    features[0];
  const requiresImage = active.id === "invoiceExtraction";
  const canGenerate =
    settings.enabled &&
    settings.apiKeyConfigured &&
    settings.features[active.id] &&
    !loading &&
    (active.optional || input.trim().length > 0) &&
    (!requiresImage || !!file);

  function selectFeature(id: AiFeature) {
    setFeatureId(id);
    setInput("");
    setFile(null);
    setCustomerPhone("");
    setResult(null);
    setError("");
    setCopied(false);
    setQueueStatus("");
    if (fileInput.current) fileInput.current.value = "";
  }

  async function generate() {
    if (!canGenerate) return;
    setLoading(true);
    setError("");
    setCopied(false);
    setQueueStatus("");
    try {
      const image = file
        ? { mimeType: file.type, data: await readFile(file) }
        : undefined;
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "run",
          feature: active.id,
          input,
          language,
          image,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "The assistant could not complete this request.",
        );
      setResult(body.result);
      if (body.usage) setUsage(body.usage);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The assistant could not complete this request.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyDraft() {
    if (!result?.draft) return;
    try {
      await navigator.clipboard.writeText(result.draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(
        "Copying is unavailable in this browser. Select the draft manually.",
      );
    }
  }

  async function queueMessage() {
    if (
      !result?.draft ||
      !/^\+?[0-9][0-9\s-]{8,14}$/.test(customerPhone.trim())
    )
      return;
    setQueueing(true);
    setQueueStatus("");
    try {
      const saved = await action("queueSms", {
        phone: customerPhone.trim(),
        message: result.draft,
      });
      if (saved)
        setQueueStatus(
          "Approved and added to the SMS outbox for delivery processing.",
        );
    } finally {
      setQueueing(false);
    }
  }

  if (!availableFeatures.length) {
    return (
      <section
        className={styles.unavailable}
        aria-labelledby="ai-unavailable-title"
      >
        <Bot size={26} />
        <h2 id="ai-unavailable-title">No AI workflows are enabled</h2>
        <p>An owner can enable individual workflows from Settings.</p>
      </section>
    );
  }

  return (
    <section className={styles.workspace} aria-label="AI assistant workspace">
      <aside className={styles.featureRail} aria-label="AI workflows">
        <div className={styles.railHeading}>
          <span>WORKFLOWS</span>
          <small>{availableFeatures.length} enabled</small>
        </div>
        <div className={styles.featureList} role="list">
          {availableFeatures.map((feature) => {
            const Icon = feature.icon;
            const selected = active.id === feature.id;
            return (
              <button
                key={feature.id}
                type="button"
                className={selected ? styles.featureActive : styles.feature}
                aria-pressed={selected}
                onClick={() => selectFeature(feature.id)}
                disabled={loading}
              >
                <span className={styles.featureIcon}>
                  <Icon size={18} />
                </span>
                <span>
                  <strong>{feature.label}</strong>
                  <small>{feature.description}</small>
                </span>
              </button>
            );
          })}
        </div>
        <div className={styles.usage}>
          <span>
            Today <strong>{usage.requestsToday}</strong> /{" "}
            {usage.dailyRequestLimit}
          </span>
          <progress
            aria-label="Daily AI request usage"
            max={Math.max(usage.dailyRequestLimit, 1)}
            value={Math.min(usage.requestsToday, usage.dailyRequestLimit)}
          />
        </div>
      </aside>

      <div className={styles.console}>
        <section
          className={styles.composer}
          aria-labelledby="ai-composer-title"
        >
          <div className={styles.composerHeading}>
            <div>
              <span className={styles.kicker}>AI ASSISTANT</span>
              <h2 id="ai-composer-title">{active.label}</h2>
              <p>{active.description}</p>
            </div>
            <label className={styles.language}>
              <span>Response language</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                disabled={loading}
              >
                <option>English</option>
                <option>Sinhala</option>
                <option>Tamil</option>
              </select>
            </label>
          </div>

          {!settings.enabled || !settings.apiKeyConfigured ? (
            <div className={styles.configurationNotice} role="status">
              <ShieldCheck size={20} />
              <div>
                <strong>
                  {!settings.apiKeyConfigured
                    ? "Connect Gemini to use the assistant"
                    : "AI is currently paused"}
                </strong>
                <p>
                  An owner can{" "}
                  {settings.apiKeyConfigured ? "enable AI" : "add an API key"}{" "}
                  in Settings → AI & automation.
                </p>
              </div>
            </div>
          ) : (
            <>
              <label className={styles.promptLabel} htmlFor="ai-request-input">
                {active.prompt}
                {active.optional && <small>Optional</small>}
              </label>
              <textarea
                id="ai-request-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={active.placeholder}
                disabled={loading}
                rows={active.id === "repairAssistant" ? 5 : 4}
                maxLength={12000}
              />

              {active.id === "customerMessages" && (
                <label
                  className={styles.phoneField}
                  htmlFor="ai-customer-phone"
                >
                  <span>
                    Customer phone <small>Optional until approval</small>
                  </span>
                  <input
                    id="ai-customer-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={customerPhone}
                    onChange={(event) => {
                      setCustomerPhone(event.target.value);
                      setQueueStatus("");
                    }}
                    placeholder="07X XXX XXXX"
                    disabled={loading || queueing}
                  />
                  <small>
                    The phone number is not sent to Gemini. It is used only if
                    you approve and queue the finished draft.
                  </small>
                </label>
              )}

              {requiresImage && (
                <div className={styles.uploadArea}>
                  <input
                    ref={fileInput}
                    id="ai-invoice-image"
                    className={styles.fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={loading}
                    onChange={(event) => {
                      const selected = event.target.files?.[0] || null;
                      if (selected && selected.size > 4_000_000) {
                        event.target.value = "";
                        setFile(null);
                        setError("Choose an image smaller than 4 MB.");
                        return;
                      }
                      setFile(selected);
                      setError("");
                    }}
                  />
                  <label htmlFor="ai-invoice-image">
                    <FileScan size={22} />
                    <span>
                      <strong>
                        {file ? file.name : "Choose invoice image"}
                      </strong>
                      <small>JPG, PNG or WebP · maximum 4 MB</small>
                    </span>
                  </label>
                  {file && (
                    <button
                      type="button"
                      aria-label="Remove invoice image"
                      onClick={() => {
                        setFile(null);
                        if (fileInput.current) fileInput.current.value = "";
                      }}
                      disabled={loading}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              )}

              <div className={styles.composerFooter}>
                <p>
                  Do not include phone numbers, IMEIs, PINs, passwords, or
                  unlock patterns.
                </p>
                <button
                  type="button"
                  className={styles.generate}
                  onClick={generate}
                  disabled={!canGenerate}
                >
                  {loading ? (
                    <>
                      <LoaderCircle className={styles.spinner} size={17} />{" "}
                      Preparing…
                    </>
                  ) : (
                    <>
                      Generate <Send size={16} />
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </section>

        <section
          className={styles.resultPanel}
          aria-labelledby="ai-result-title"
        >
          <div className={styles.reviewStrip}>
            <span>
              <Sparkles size={14} /> AI prepares
            </span>
            <i />
            <span>
              <ShieldCheck size={14} /> Fido verifies
            </span>
            <i />
            <strong>
              <Check size={14} /> You approve
            </strong>
          </div>

          <div aria-live="polite" aria-atomic="true">
            {loading && (
              <div className={styles.loadingState}>
                <LoaderCircle className={styles.spinner} size={28} />
                <strong>Preparing a reviewable result</strong>
                <p>
                  Gemini may use the fallback model if the primary model is
                  busy.
                </p>
              </div>
            )}
            {!loading && error && (
              <div className={styles.errorState} role="alert">
                <AlertTriangle size={24} />
                <div>
                  <strong>AI request could not be completed</strong>
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={generate}
                    disabled={!canGenerate}
                  >
                    <RefreshCw size={15} /> Try again
                  </button>
                </div>
              </div>
            )}
            {!loading && !error && !result && (
              <div className={styles.emptyState}>
                <BarChart3 size={29} />
                <strong id="ai-result-title">
                  Your result will appear here
                </strong>
                <p>
                  Choose a workflow and generate a suggestion. Nothing is saved,
                  sent, or posted automatically.
                </p>
              </div>
            )}
          </div>

          {!loading && result && (
            <article className={styles.result}>
              <header>
                <div>
                  <span className={styles.kicker}>ADVISORY RESULT</span>
                  <h2 id="ai-result-title">{result.title}</h2>
                  <p>{result.summary}</p>
                </div>
                <span className={styles.model}>{result.model}</span>
              </header>

              {!!result.warnings?.length && (
                <section
                  className={styles.warnings}
                  aria-label="Items to verify"
                >
                  <strong>
                    <AlertTriangle size={16} /> Review before use
                  </strong>
                  <ul>
                    {result.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </section>
              )}

              {!!result.fields?.length && (
                <section
                  className={styles.fields}
                  aria-label="Extracted fields"
                >
                  {result.fields.map((field, index) => (
                    <div key={`${field.label}-${index}`}>
                      <span>{field.label}</span>
                      <strong>{field.value || "—"}</strong>
                      {field.confidence && (
                        <small>{field.confidence} confidence</small>
                      )}
                    </div>
                  ))}
                </section>
              )}

              {!!result.lines?.length && (
                <section
                  className={styles.lines}
                  aria-label="Extracted invoice lines"
                >
                  <h3>Extracted lines</h3>
                  <div className={styles.tableWrap}>
                    <table>
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>SKU</th>
                          <th>Qty</th>
                          <th>Unit cost</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.lines.map((line, index) => (
                          <tr key={index}>
                            <td>{line.description}</td>
                            <td>{line.sku || "—"}</td>
                            <td>{line.quantity ?? "—"}</td>
                            <td>{line.unitCost ?? "—"}</td>
                            <td>{line.total ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {!!result.sections?.length && (
                <div className={styles.sections}>
                  {result.sections.map((section, index) => (
                    <section key={`${section.heading}-${index}`}>
                      <h3>{section.heading}</h3>
                      <ul>
                        {section.items.map((item, itemIndex) => (
                          <li key={itemIndex}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}

              {result.draft && (
                <section className={styles.draft} aria-label="AI draft">
                  <div>
                    <h3>Draft for review</h3>
                    <span className={styles.draftActions}>
                      <button type="button" onClick={copyDraft}>
                        {copied ? <Check size={15} /> : <Clipboard size={15} />}
                        {copied ? "Copied" : "Copy draft"}
                      </button>
                      {active.id === "customerMessages" && canQueueSms && (
                        <button
                          type="button"
                          className={styles.approve}
                          onClick={queueMessage}
                          disabled={
                            queueing ||
                            !/^\+?[0-9][0-9\s-]{8,14}$/.test(
                              customerPhone.trim(),
                            )
                          }
                        >
                          {queueing ? (
                            <LoaderCircle
                              className={styles.spinner}
                              size={15}
                            />
                          ) : (
                            <Send size={15} />
                          )}
                          {queueing ? "Queueing…" : "Approve & queue SMS"}
                        </button>
                      )}
                    </span>
                  </div>
                  <pre>{result.draft}</pre>
                  {active.id === "customerMessages" &&
                    canQueueSms &&
                    !customerPhone.trim() && (
                      <p className={styles.queueHint}>
                        Add the customer phone above to approve this draft for
                        the SMS outbox.
                      </p>
                    )}
                  {queueStatus && (
                    <p className={styles.queueSuccess} role="status">
                      <Check size={14} /> {queueStatus}
                    </p>
                  )}
                </section>
              )}

              <footer>
                AI output can be incomplete or incorrect. Verify names, figures,
                dates, stock, warranty terms, and customer-facing claims before
                use.
              </footer>
            </article>
          )}
        </section>
      </div>
    </section>
  );
}
