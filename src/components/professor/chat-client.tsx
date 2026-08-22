"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import {
  Bot,
  ChevronDown,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatSession } from "@/types";

interface Props {
  userId: string;
  initialSessions: ChatSession[];
  profileName?: string | null;
  profileLevel?: string | null;
  profileBanca?: string | null;
  profileConcurso?: string | null;
  defaultModel: "flash" | "pro";
  usage: { used: number; max: number; canSend: boolean };
  subjects: { id: string; name: string }[];
  documents?: { id: string; title: string }[];
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  reasoning?: string;
}

export function ChatClient({
  initialSessions,
  profileName,
  profileBanca,
  profileConcurso,
  defaultModel,
  usage,
  subjects,
  documents = [],
}: Props) {
  const [sessions, setSessions] = React.useState<ChatSession[]>(initialSessions);
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<LocalMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [model, setModel] = React.useState<"flash" | "pro">(defaultModel);
  const [subjectId, setSubjectId] = React.useState("none");
  const [documentId, setDocumentId] = React.useState("none");
  const [sending, setSending] = React.useState(false);
  const [usageLeft, setUsageLeft] = React.useState(usage.max - usage.used);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // Scroll automático ao final
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function selectSession(id: string) {
    setActiveSessionId(id);
    setMessages([]);
    setSending(false);
    try {
      const res = await fetch(`/api/chat/sessions/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(
          (data.data as ChatMessage[])
            .filter((m) => m.role !== "system")
            .map(
              (m): LocalMessage => ({
                id: m.id,
                role: m.role === "assistant" ? "assistant" : "user",
                content: m.content,
              })
            )
        );
      }
    } catch {
      toast.error("Erro ao carregar conversa.");
    }
  }

  function newConversation() {
    setActiveSessionId(null);
    setMessages([]);
  }

  async function deleteConversation(id: string) {
    if (!confirm("Excluir esta conversa?")) return;
    const res = await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSessions((s) => s.filter((x) => x.id !== id));
      if (activeSessionId === id) newConversation();
      toast.success("Conversa excluída.");
    } else {
      toast.error("Erro ao excluir.");
    }
  }

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    if (usageLeft <= 0) {
      toast.error("Você atingiu o limite diário de mensagens do seu plano.");
      return;
    }

    // Adiciona a mensagem do usuário imediatamente
    const userMsg: LocalMessage = { id: `user-${Date.now()}`, role: "user", content };
    const assistantMsg: LocalMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      streaming: true,
      reasoning: "",
    };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setInput("");
    setSending(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: activeSessionId,
          message: content,
          model,
          subject_id: subjectId === "none" ? null : subjectId,
          document_id: documentId === "none" ? null : documentId,
        }),
        signal: controller.signal,
      });

      if (res.status === 429) {
        toast.error("Limite diário de mensagens atingido.");
        setMessages((m) => m.filter((x) => x.id !== assistantMsg.id));
        setSending(false);
        return;
      }

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Erro ao enviar mensagem.");
        setMessages((m) => m.filter((x) => x.id !== assistantMsg.id));
        setSending(false);
        return;
      }

      // Parsing de SSE
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let newSessionId = activeSessionId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const rawEvent of events) {
          const eventLine = rawEvent.split("\n").find((l) => l.startsWith("event: "));
          const dataLine = rawEvent.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine.slice(6));

          const type = eventLine?.slice(7) ?? "delta";
          if (type === "start") {
            newSessionId = payload.session_id;
            setActiveSessionId(newSessionId);
            setUsageLeft((u) => u - 1);
          } else if (type === "reasoning") {
            setMessages((m) =>
              m.map((x) =>
                x.id === assistantMsg.id
                  ? { ...x, reasoning: (x.reasoning ?? "") + payload.text }
                  : x
              )
            );
          } else if (type === "delta") {
            setMessages((m) =>
              m.map((x) =>
                x.id === assistantMsg.id
                  ? { ...x, content: x.content + payload.text }
                  : x
              )
            );
          } else if (type === "done") {
            // finaliza
          } else if (type === "error") {
            toast.error(payload.message ?? "Erro na geração.");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error("Erro de conexão com o Professor IA.");
      }
    } finally {
      setMessages((m) =>
        m.map((x) => (x.id === assistantMsg.id ? { ...x, streaming: false } : x))
      );
      setSending(false);
      abortRef.current = null;

      // Recarrega a lista de sessões (pode ter criado uma nova)
      fetchSessions();
    }
  }

  async function fetchSessions() {
    try {
      const res = await fetch("/api/chat/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.data ?? []);
      }
    } catch {
      // silencioso
    }
  }

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[520px] overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.9))] shadow-[0_20px_60px_rgba(15,23,42,0.5)]">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-white/10 bg-slate-950/70 md:flex">
        <div className="border-b border-white/10 p-3">
          <Button
            className="w-full border border-cyan-400/30 bg-gradient-to-r from-cyan-500/10 to-blue-600/10 text-white hover:bg-cyan-500/15"
            onClick={newConversation}
          >
            <MessageSquarePlus className="h-4 w-4" /> Nova conversa
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {sessions.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-400">
                Sem conversas ainda.
              </p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  activeSessionId === s.id
                    ? "bg-cyan-500/10 text-white ring-1 ring-inset ring-cyan-400/20"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <button
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => selectSession(s.id)}
                >
                  {s.title}
                </button>
                <button
                  onClick={() => deleteConversation(s.id)}
                  className="ml-1 hidden text-slate-400 hover:text-red-400 group-hover:block"
                  aria-label="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-950/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-600 text-white shadow-lg shadow-cyan-500/30">
              <Bot className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-none text-white">Professor IA</p>
              <p className="text-xs text-slate-400">Especialista em concursos · pt-BR</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="border border-cyan-400/20 bg-cyan-500/10 text-cyan-200 text-xs">
              {usageLeft} de {usage.max} msgs hoje
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10">
                  {model === "flash" ? (
                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                  )}
                  {model === "flash" ? "DeepSeek V4 Flash" : "DeepSeek V4 Pro"}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-white/10 bg-slate-950 text-slate-100">
                <DropdownMenuItem onClick={() => setModel("flash")} className="text-slate-100 focus:bg-white/5">
                  <Zap className="h-4 w-4 text-amber-400" /> DeepSeek V4 Flash — rápido
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setModel("pro")} className="text-slate-100 focus:bg-white/5">
                  <Sparkles className="h-4 w-4 text-violet-400" /> DeepSeek V4 Pro — raciocínio profundo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-4">
            {messages.length === 0 && (
              <EmptyState
                name={profileName}
                banca={profileBanca}
                concurso={profileConcurso}
                onSuggestion={(t) => setInput(t)}
              />
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex gap-3",
                  m.role === "user" && "justify-end"
                )}
              >
                {m.role === "assistant" && (
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-600 text-white shadow-lg shadow-cyan-500/20">
                    <Bot className="h-4 w-4" />
                  </span>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-lg",
                    m.role === "user"
                      ? "rounded-br-sm bg-gradient-to-r from-cyan-400 to-blue-600 text-white"
                      : "rounded-bl-sm border border-white/10 bg-slate-900/80 text-slate-100"
                  )}
                >
                  {m.role === "assistant" && m.reasoning && m.content.length === 0 && (
                    <p className="mb-1 flex items-center gap-1.5 text-xs italic text-cyan-200">
                      <Sparkles className="h-3 w-3 animate-pulse" />
                      Raciocinando...
                    </p>
                  )}
                  {m.role === "assistant" && m.content.length === 0 && !m.reasoning ? (
                    <TypingDots />
                  ) : m.role === "assistant" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-invert max-w-none prose-p:my-1.5 prose-li:my-1">
                      {m.content + (m.streaming ? "▍" : "")}
                    </ReactMarkdown>
                  ) : (
                    m.content
                  )}
                </div>
                {m.role === "user" && (
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-800">
                    <User className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-white/10 bg-slate-950/40 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger className="h-8 w-auto min-w-40 border-white/10 bg-white/5 text-xs text-slate-100">
                <SelectValue placeholder="Disciplina em foco" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
                <SelectItem value="none" className="focus:bg-white/5">Disciplina geral</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="focus:bg-white/5">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {documents.length > 0 && (
              <Select value={documentId} onValueChange={setDocumentId}>
                <SelectTrigger className="h-8 w-auto min-w-40 border-white/10 bg-white/5 text-xs text-slate-100">
                  <SelectValue placeholder="Apostila (RAG)" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
                  <SelectItem value="none" className="focus:bg-white/5">Sem apostila</SelectItem>
                  {documents.map((d) => (
                    <SelectItem key={d.id} value={d.id} className="focus:bg-white/5">
                      {d.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-slate-400">
              O Professor IA adapta a resposta ao contexto selecionado.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Pergunte sobre qualquer conteúdo do edital..."
              className="max-h-32 min-h-10 flex-1 resize-none border-white/10 bg-slate-900/80 text-white placeholder:text-slate-400"
              rows={1}
            />
            <Button
              onClick={send}
              disabled={sending || !input.trim() || usageLeft <= 0}
              className="h-10 px-4 bg-gradient-to-r from-cyan-400 to-blue-600 text-white hover:from-cyan-300 hover:to-blue-500"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-slate-400">
            A IA pode cometer erros. Confira informações importantes em fontes oficiais.
          </p>
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0.3s]" />
    </span>
  );
}

function EmptyState({
  name,
  banca,
  concurso,
  onSuggestion,
}: {
  name?: string | null;
  banca?: string | null;
  concurso?: string | null;
  onSuggestion: (t: string) => void;
}) {
  const suggestions = [
    "Explique o que é responsabilidade civil do Estado, com exemplo de prova.",
    "Quais são os princípios da Administração Pública no art. 37 da CF?",
    "Monte um plano de estudos de 2 semanas para a banca CEBRASPE.",
    "Qual a diferença entre anulação e revogação de ato administrativo?",
  ];

  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 text-white shadow-[0_16px_40px_rgba(59,130,246,0.35)]">
        <Bot className="h-7 w-7" />
      </div>
      <h3 className="text-2xl font-semibold text-white">
        Olá{name ? `, ${name.split(" ")[0]}` : ""}! Sou seu Professor IA 👋
      </h3>
      <p className="mt-2 text-sm text-slate-300">
        Estudei para concursos de todas as bancas. Pergunte o que quiser!
        {banca && ` Foco especial na banca ${banca}.`}
        {concurso && ` Preparação para ${concurso}.`}
      </p>
      <div className="mt-6 space-y-2 text-left">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 p-3 text-left text-sm text-slate-200 transition-all duration-200 hover:border-sky-400/50 hover:bg-sky-500/10 hover:text-white"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
