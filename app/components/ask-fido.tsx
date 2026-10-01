"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowUp,
  Check,
  Copy,
  ImagePlus,
  MessageCircle,
  RotateCcw,
  Sparkles,
  SquarePen,
  X,
} from "lucide-react";
import styles from "./ask-fido.module.css";

type Language = "English" | "Sinhala" | "Tamil";
type Message = {
  id: string;
  role: "user" | "model";
  text: string;
  at: string;
  draft?: { label: string; text: string } | null;
  followUps?: string[];
  imageName?: string;
  failed?: boolean;
};
export type Suggestion = { icon: ReactNode; title: string; prompt: string };

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "English", label: "English" },
  { value: "Sinhala", label: "සිංහල" },
  { value: "Tamil", label: "தமிழ்" },
];
const MAX_HISTORY = 20;
const newId = () => Math.random().toString(36).slice(2);

/** Bold, bullets and numbered lists — rendered as elements, never as HTML. */
function Rich({ text }: { text: string }) {
  const inline = (line: string) =>
    line
      .split(/(\*\*[^*]+\*\*)/g)
      .map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      );
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((item, i) => <li key={i}>{inline(item)}</li>);
    blocks.push(
      list.ordered ? (
        <ol key={blocks.length}>{items}</ol>
      ) : (
        <ul key={blocks.length}>{items}</ul>
      ),
    );
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet || numbered)![1]);
      continue;
    }
    flush();
    if (line) blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className={styles.rich}>{blocks}</div>;
}

function Draft({ draft }: { draft: { label: string; text: string } }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={styles.draft}>
      <div className={styles.draftHead}>
        <span>{draft.label}</span>
        <small>Check it before you send</small>
      </div>
      <p>{draft.text}</p>
      <div className={styles.draftActions}>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(draft.text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {}
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(draft.text)}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={16} /> WhatsApp
        </a>
      </div>
    </div>
  );
}

export function AskFido({
  userId,
  userName,
  ready,
  notReadyReason,
  canConfigure,
  usage,
  suggestions,
  question,
  onQuestionUsed,
  onOpenSettings,
}: {
  userId: string;
  userName: string;
  ready: boolean;
  notReadyReason: string;
  canConfigure: boolean;
  usage: { today: number; limit: number };
  suggestions: Suggestion[];
  /** A question typed in the scan bar, sent as soon as the chat opens. */
  question?: string;
  onQuestionUsed?: () => void;
  onOpenSettings: () => void;
}) {
  const storageKey = `fido-chat-${userId}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState<Language>("English");
  const [image, setImage] = useState<{
    name: string;
    mimeType: "image/jpeg" | "image/png" | "image/webp";
    data: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [used, setUsed] = useState(usage.today);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setMessages(JSON.parse(saved));
      const lang = localStorage.getItem("fido-chat-language");
      if (lang === "English" || lang === "Sinhala" || lang === "Tamil")
        setLanguage(lang);
    } catch {}
  }, [storageKey]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)));
    } catch {}
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, storageKey]);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [input]);

  const send = useCallback(
    async (text: string, history: Message[] = messages) => {
      const question = text.trim();
      if (!question || busy || !ready) return;
      const mine: Message = {
        id: newId(),
        role: "user",
        text: question,
        at: new Date().toISOString(),
        imageName: image?.name,
      };
      const thread = [...history.filter((m) => !m.failed), mine];
      setMessages(thread);
      setInput("");
      setBusy(true);
      const attached = image;
      setImage(null);
      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation: "chat",
            language,
            messages: thread.slice(-MAX_HISTORY).map((m) => ({
              role: m.role,
              text:
                m.role === "model" && m.draft
                  ? `${m.text}\n\n${m.draft.label}:\n${m.draft.text}`
                  : m.text,
            })),
            image: attached
              ? { mimeType: attached.mimeType, data: attached.data }
              : undefined,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Fido could not answer.");
        setUsed(body.usage?.requestsToday ?? used + 1);
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "model",
            text: body.reply.reply,
            draft: body.reply.draft ?? null,
            followUps: body.reply.followUps ?? [],
            at: new Date().toISOString(),
          },
        ]);
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "model",
            text: (error as Error).message,
            at: new Date().toISOString(),
            failed: true,
          },
        ]);
      } finally {
        setBusy(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [busy, ready, image, language, messages, used],
  );

  useEffect(() => {
    if (!question || !ready) return;
    onQuestionUsed?.();
    void send(question);
    // Only react to a new question arriving from the scan bar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, ready]);

  const lastReply = [...messages].reverse().find((m) => m.role === "model");
  const firstName = userName.split(" ")[0] || "there";

  return (
    <section className={styles.chat} aria-label="Ask Fido">
      <header className={styles.bar}>
        <div className={styles.title}>
          <span className={styles.mark} aria-hidden="true">
            <Sparkles size={20} />
          </span>
          <div>
            <h1>Ask Fido</h1>
            <small>
              Knows today's numbers, stock, repairs and parcels. It can't change
              anything.
            </small>
          </div>
        </div>
        <div className={styles.barActions}>
          <div
            className={styles.languages}
            role="radiogroup"
            aria-label="Reply language"
          >
            {LANGUAGES.map((l) => (
              <button
                type="button"
                role="radio"
                key={l.value}
                aria-checked={language === l.value}
                className={language === l.value ? styles.on : ""}
                onClick={() => {
                  setLanguage(l.value);
                  try {
                    localStorage.setItem("fido-chat-language", l.value);
                  } catch {}
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.newChat}
            disabled={!messages.length || busy}
            onClick={() => {
              setMessages([]);
              setInput("");
              setImage(null);
              inputRef.current?.focus();
            }}
          >
            <SquarePen size={16} /> New chat
          </button>
        </div>
      </header>

      <div className={styles.scroll}>
        <div className={styles.column}>
          {!ready ? (
            <div className={styles.setup}>
              <span className={styles.bigMark} aria-hidden="true">
                <Sparkles size={30} />
              </span>
              <h2>Fido isn't switched on yet</h2>
              <p>{notReadyReason}</p>
              {canConfigure ? (
                <button
                  type="button"
                  className="primary"
                  onClick={onOpenSettings}
                >
                  Open AI settings
                </button>
              ) : (
                <p className={styles.muted}>Ask the owner to set it up.</p>
              )}
            </div>
          ) : !messages.length ? (
            <div className={styles.welcome}>
              <span className={styles.bigMark} aria-hidden="true">
                <Sparkles size={30} />
              </span>
              <h2>Hi {firstName}. What do you need?</h2>
              <p>
                Ask in English, Sinhala or Tamil. Fido answers from the shop's
                own numbers and writes messages for you to send.
              </p>
              <div className={styles.suggestions}>
                {suggestions.map((s) => (
                  <button
                    type="button"
                    key={s.title}
                    onClick={() => void send(s.prompt)}
                  >
                    <span className={styles.suggestionIcon}>{s.icon}</span>
                    <strong>{s.title}</strong>
                    <small>{s.prompt}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className={styles.thread} aria-live="polite">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={m.role === "user" ? styles.mine : styles.theirs}
                >
                  {m.role === "model" && (
                    <span className={styles.avatar} aria-hidden="true">
                      <Sparkles size={16} />
                    </span>
                  )}
                  <div className={styles.bubbleWrap}>
                    <div
                      className={`${styles.bubble} ${m.failed ? styles.failed : ""}`}
                    >
                      {m.role === "user" ? (
                        <>
                          {m.imageName && (
                            <span className={styles.attachedTag}>
                              <ImagePlus size={14} /> {m.imageName}
                            </span>
                          )}
                          <p>{m.text}</p>
                        </>
                      ) : (
                        <Rich text={m.text} />
                      )}
                      {m.draft && <Draft draft={m.draft} />}
                      {m.failed && (
                        <button
                          type="button"
                          className={styles.retry}
                          onClick={() => {
                            const index = messages.indexOf(m);
                            const question = messages
                              .slice(0, index)
                              .reverse()
                              .find((x) => x.role === "user");
                            if (question)
                              void send(
                                question.text,
                                messages.slice(0, messages.indexOf(question)),
                              );
                          }}
                        >
                          <RotateCcw size={14} /> Try again
                        </button>
                      )}
                    </div>
                    <time dateTime={m.at}>
                      {new Date(m.at).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Colombo",
                      })}
                    </time>
                    {m === lastReply &&
                      !busy &&
                      !m.failed &&
                      !!m.followUps?.length && (
                        <div className={styles.followUps}>
                          {m.followUps.map((f) => (
                            <button
                              type="button"
                              key={f}
                              onClick={() => void send(f)}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                </li>
              ))}
              {busy && (
                <li className={styles.theirs}>
                  <span className={styles.avatar} aria-hidden="true">
                    <Sparkles size={16} />
                  </span>
                  <div className={`${styles.bubble} ${styles.typing}`}>
                    <span />
                    <span />
                    <span />
                    <em className={styles.srOnly}>Fido is thinking</em>
                  </div>
                </li>
              )}
            </ol>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <div className={styles.column}>
          {image && (
            <span className={styles.attachment}>
              <ImagePlus size={15} /> {image.name}
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setImage(null)}
              >
                <X size={14} />
              </button>
            </span>
          )}
          <div className={styles.box}>
            <label className={styles.attach} title="Attach a photo">
              <ImagePlus size={20} />
              <span className={styles.srOnly}>Attach a photo</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={!ready || busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (file.size > 4_000_000) {
                    alert("Choose a photo smaller than 4 MB.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () =>
                    setImage({
                      name: file.name,
                      mimeType: file.type as "image/jpeg",
                      data: String(reader.result).split(",")[1],
                    });
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              disabled={!ready}
              aria-label="Message Fido"
              placeholder={
                ready ? "Ask Fido anything…" : "Fido is not switched on"
              }
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send(input);
                }
              }}
            />
            <button
              type="submit"
              className={styles.send}
              aria-label="Send"
              disabled={!ready || busy || !input.trim()}
            >
              <ArrowUp size={20} />
            </button>
          </div>
          <small className={styles.footnote}>
            Fido can be wrong — check numbers before acting on them. {used} of{" "}
            {usage.limit} questions used today.
          </small>
        </div>
      </form>
    </section>
  );
}
