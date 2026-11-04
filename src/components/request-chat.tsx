"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Lock, MessagesSquare, Send } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { REQUEST_MESSAGE_MAX, type ChatPayload } from "@/lib/request-chat-rules";
import { sendRequestMessageAction } from "@/app/request-chat-actions";

const POLL_MS = 10_000;

/**
 * The chat on a support request, shown on the request (staff and portal) and on its work order (web and field
 * app). Reads through /api/request-chat (polled while the page is visible) and writes through
 * sendRequestMessageAction. Messages can only be added: there is no way to edit or delete one.
 *
 * `initial` = loaded by the page (it is only rendered for participants). Without it (field app) the chat loads
 * itself by `workOrderId` and stays hidden when the job has no request or the user doesn't take part.
 */
export function RequestChat({
  initial,
  workOrderId,
  staff = true,
  className,
}: {
  initial?: ChatPayload;
  workOrderId?: string;
  /** Staff view: messages written from the portal are tagged "Client". */
  staff?: boolean;
  className?: string;
}) {
  const t = useTranslations("requestChat");
  const tc = useTranslations();
  const format = useFormatter();
  const [chat, setChat] = useState<ChatPayload | null>(initial ?? null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const list = useRef<HTMLOListElement>(null);
  const stick = useRef(true);

  const query = initial ? `requestId=${encodeURIComponent(initial.requestId)}` : workOrderId ? `workOrderId=${encodeURIComponent(workOrderId)}` : null;
  const load = useCallback(async () => {
    if (!query) return;
    try {
      const res = await fetch(`/api/request-chat?${query}`, { cache: "no-store" });
      if (res.ok) setChat((await res.json()) as ChatPayload);
      else if (res.status === 404) setChat(null);
    } catch {
      // Offline: keep what is shown.
    }
  }, [query]);

  useEffect(() => {
    // Without data from the page, load straight away (on the next tick), then poll.
    const first = initial ? undefined : setTimeout(() => void load(), 0);
    const timer = setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [initial, load]);

  const count = chat?.messages.length ?? 0;
  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [count]);

  if (!chat) return null;

  const send = () => {
    const text = body.trim();
    if (!text || pending) return;
    setError(null);
    start(async () => {
      try {
        const res = await sendRequestMessageAction(chat.requestId, text);
        if (res.error) {
          setError(tc(res.error as never));
          return;
        }
        setBody("");
        stick.current = true;
        await load();
      } catch {
        setError(t("sendFailed"));
      }
    });
  };

  return (
    <section className={className}>
      <h2 className="mb-1 flex items-center gap-2 font-medium">
        <MessagesSquare className="size-4 text-muted" />
        {t("title", { number: chat.number })}
      </h2>
      <p className="mb-3 flex items-center gap-1.5 text-xs text-muted">
        <Lock className="size-3" />
        {t("permanent")}
      </p>
      <ol
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="mb-3 max-h-96 space-y-3 overflow-y-auto"
        aria-live="polite"
      >
        {chat.messages.length === 0 && <li className="py-4 text-center text-sm text-muted">{t("noMessages")}</li>}
        {chat.messages.map((m) => (
          <li key={m.id} className={cn("flex flex-col", m.mine ? "items-end" : "items-start")}>
            <div className="mb-0.5 text-xs text-muted">
              <span className="mr-1.5 font-medium text-foreground">{m.mine ? t("you") : m.author}</span>
              {staff && m.fromClient && <span className="mr-1.5 rounded bg-amber-100 px-1 text-amber-800">{t("client")}</span>}
              <time dateTime={m.at}>{format.dateTime(new Date(m.at), { dateStyle: "medium", timeStyle: "short" })}</time>
            </div>
            <p
              className={cn(
                "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm",
                m.mine ? "bg-brand text-brand-foreground" : "bg-gray-100",
              )}
            >
              {m.body}
            </p>
          </li>
        ))}
      </ol>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              send();
            }
          }}
          maxLength={REQUEST_MESSAGE_MAX}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          className="min-h-12 flex-1"
        />
        <Button type="submit" disabled={pending || !body.trim()} aria-label={t("send")} title={t("send")}>
          <Send className="size-4" />
        </Button>
      </form>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </section>
  );
}
