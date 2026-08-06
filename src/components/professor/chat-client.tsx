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
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  reasoning?: string;
}

export function ChatClient({
  userId,
  initialSessions,
  profileName,
  profileLevel,
  profileBanca,
  profileConcurso,
  defaultModel,
  usage,
  subjects,
}: Props) {
  const [sessions, setSessions] = React.useState<ChatSession[]>(initialSessions);
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<LocalMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [model, setModel] = React.useState<"flash" | "pro">(defaultModel);
  const [subjectId, setSubjectId] = React.useState("none");
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
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[480px] overflow-hidden rounded-xl border bg-card">
      {/* Sidebar de conversas */}
      <aside className="hidden w-64 shrink-0 flex-col border-r md:flex">
        <div className="border-b p-3">
          <Button className="w-full" onClick={newConversation}>
            <MessageSquarePlus className="h-4 w-4" /> Nova conversa
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {sessions.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Sem conversas ainda.
              </p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                  activeSessionId === s.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                <button
                  className="min-w-0 flex-1 truncate"
                  onClick={() => selectSession(s.id)}
                >
                  {s.title}
                </button>
                <button
                  onClick={() => deleteConversation(s.id)}
                  className="ml-1 hidden text-muted-foreground hover:text-red-600 group-hover:block"
                  aria-label="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Área do chat */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
              <Bot className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-none">Professor IA</p>
              <p className="text-xs text-muted-foreground">
                Especialista em concursos · pt-BR
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {usageLeft} de {usage.max} msgs hoje
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {model === "flash" ? (
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                  )}
                  {model === "flash" ? "V4 Flash" : "V4 Pro"}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setModel("flash")}>
                  <Zap className="h-4 w-4 text-amber-500" /> V4 Flash — rápido
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setModel("pro")}>
                  <Sparkles className="h-4 w-4 text-violet-500" /> V4 Pro — raciocínio profundo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mensagens */}
        <ScrollArea className="flex-1">
          <div className="space-y-4 p-4">
            {messages.length === 0 && (
              <EmptyState
                name={profileName}
                level={profileLevel}
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
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                    <Bot className="h-3.5 w-3.5" />
                  </span>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted"
                  )}
                >
                  {m.role === "assistant" && m.reasoning && m.content.length === 0 && (
                    <p className="mb-1 flex items-center gap-1.5 text-xs italic text-muted-foreground">
                      <Sparkles className="h-3 w-3 animate-pulse" />
                      Raciocinando...
                    </p>
                  )}
                  {m.role === "assistant" && m.content.length === 0 && !m.reasoning ? (
                    <TypingDots />
                  ) : m.role === "assistant" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content + (m.streaming ? "▍" : "")}
                    </ReactMarkdown>
                  ) : (
                    m.content
                  )}
                </div>
                {m.role === "user" && (
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-muted">
                    <User className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t p-3">
          <div className="mb-2 flex items-center gap-2">
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger className="h-8 w-auto min-w-40 text-xs">
                <SelectValue placeholder="Disciplina em foco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Disciplina geral</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
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
              className="max-h-32 min-h-10 flex-1 resize-none"
              rows={1}
            />
            <Button
              onClick={send}
              disabled={sending || !input.trim() || usageLeft <= 0}
              className="h-10 px-4"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
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
  level,
  banca,
  concurso,
  onSuggestion,
}: {
  name?: string | null;
  level?: string | null;
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
    <div className="mx-auto max-w-lg py-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200 dark:shadow-none">
        <Bot className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold">
        Olá{name ? `, ${name.split(" ")[0]}` : ""}! Sou seu Professor IA 👋
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Estudei para concursos de todas as bancas. Pergunte o que quiser!
        {banca && ` Foco especial na banca ${banca}.`}
        {concurso && ` Preparação para ${concurso}.`}
      </p>
      <div className="mt-6 space-y-2 text-left">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="w-full rounded-xl border p-3 text-left text-sm transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
