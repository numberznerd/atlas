"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Loader2, Send, Sparkles } from "lucide-react";
import { askAction } from "@/app/(app)/chat/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Citation } from "@/lib/types/database";

interface Msg {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  mode?: "hybrid" | "keyword";
}

const SUGGESTIONS = [
  "How does our firm handle SR&ED claims?",
  "What did we decide at the last meeting?",
  "What follow-ups are outstanding for this client?",
];

export function ChatPanel({
  clients,
  defaultClientId,
}: {
  clients: { id: string; name: string }[];
  defaultClientId?: string;
}) {
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, start] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  function ask(question: string) {
    if (!question.trim() || pending) return;
    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");
    start(async () => {
      const res = await askAction(question, clientId || null);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.answer, citations: res.citations, mode: res.mode },
      ]);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    });
  }

  const scopeName = clientId ? clients.find((c) => c.id === clientId)?.name : null;

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col rounded-xl border border-border bg-card">
      {/* Scope selector */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="text-sm text-muted-foreground">Scope</span>
        <div className="w-64">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Firm-wide (all clients + SOPs)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        {scopeName ? <Badge variant="secondary">{scopeName}</Badge> : <Badge variant="accent">Firm-wide</Badge>}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto scrollbar-thin p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Sparkles className="size-6" />
            </div>
            <p className="mt-3 font-medium text-foreground">Ask anything about a client or your firm</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Answers are grounded in your firm&apos;s records and always cite their sources.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                    : "max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-foreground"
                }
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.citations && m.citations.length > 0 ? (
                  <div className="mt-3 space-y-1.5 border-t border-border/60 pt-2">
                    <p className="text-xs font-medium text-muted-foreground">Sources</p>
                    {m.citations.map((c, j) => (
                      <div key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <FileText className="mt-0.5 size-3 shrink-0" />
                        <span>
                          <span className="font-medium text-foreground">[{j + 1}] {c.title}</span>
                          {c.snippet ? <span className="block opacity-80">{c.snippet}…</span> : null}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
        {pending ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Searching the firm&apos;s records…
            </div>
          </div>
        ) : null}
      </div>

      {/* Input */}
      <form
        className="flex items-center gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={scopeName ? `Ask about ${scopeName}…` : "Ask about any client or firm procedure…"}
          className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="icon" disabled={pending || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
