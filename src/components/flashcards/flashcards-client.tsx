"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Eye, Loader2, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Flashcard } from "@/types";

interface Props {
  initialCards: (Flashcard & { schedule?: { due_date: string; interval_days: number } | null })[];
  dueCount: number;
  subjects: { id: string; name: string; color: string | null }[];
  userId: string;
}

export function FlashcardsClient({ initialCards, dueCount, subjects, userId }: Props) {
  const [cards, setCards] = React.useState(initialCards);
  const [due, setDue] = React.useState(dueCount);
  const [reviewing, setReviewing] = React.useState(false);
  const [reviewQueue, setReviewQueue] = React.useState<Props["initialCards"]>([]);
  const [queueIndex, setQueueIndex] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // Form
  const [front, setFront] = React.useState("");
  const [back, setBack] = React.useState("");
  const [subjectId, setSubjectId] = React.useState("none");
  const [tags, setTags] = React.useState("");

  function startReview() {
    const dueCards = cards.filter(
      (c) => !c.schedule || (c.schedule.due_date ?? "") <= new Date().toISOString().slice(0, 10)
    );
    if (dueCards.length === 0) {
      toast.success("Nenhuma revisão pendente. Ótimo trabalho! 🎉");
      return;
    }
    setReviewQueue(dueCards);
    setQueueIndex(0);
    setFlipped(false);
    setReviewing(true);
  }

  async function rate(rating: "facil" | "medio" | "dificil") {
    const card = reviewQueue[queueIndex];
    if (!card) return;
    setBusy(true);
    try {
      const res = await fetch("/api/flashcards/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flashcard_id: card.id, rating }),
      });
      if (!res.ok) {
        toast.error("Erro ao registrar revisão.");
      }
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setBusy(false);
    }

    // Atualiza estado local
    const updated = cards.map((c) => {
      if (c.id !== card.id) return c;
      const next = new Date();
      next.setDate(next.getDate() + (rating === "facil" ? 3 : rating === "medio" ? 2 : 1));
      return { ...c, schedule: { due_date: next.toISOString().slice(0, 10), interval_days: 0 } };
    });
    setCards(updated);
    setDue((d) => Math.max(0, d - 1));

    if (queueIndex + 1 >= reviewQueue.length) {
      setReviewing(false);
      setReviewQueue([]);
      toast.success("Revisão concluída! 🎉");
    } else {
      setQueueIndex((i) => i + 1);
      setFlipped(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);

    const res = await fetch("/api/flashcards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        front,
        back,
        subject_id: subjectId === "none" ? null : subjectId,
        tags: tagList,
      }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      toast.error(data.error ?? "Erro ao criar flashcard.");
      return;
    }
    toast.success("Flashcard criado!");
    setFront("");
    setBack("");
    setTags("");
    setCreateOpen(false);
    window.location.reload();
  }

  async function handleDelete(card: Flashcard) {
    if (!confirm("Remover este flashcard?")) return;
    const res = await fetch(`/api/flashcards/${card.id}`, { method: "DELETE" });
    if (res.ok) {
      setCards((c) => c.filter((x) => x.id !== card.id));
      toast.success("Flashcard removido.");
    } else {
      toast.error("Erro ao remover.");
    }
  }

  // ---------- Modo revisão ----------
  if (reviewing && reviewQueue.length > 0) {
    const card = reviewQueue[queueIndex];
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Revisão de flashcards</h1>
          <Button variant="ghost" size="sm" onClick={() => setReviewing(false)}>
            <X className="h-4 w-4" /> Sair
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Cartão {queueIndex + 1} de {reviewQueue.length}
        </p>

        <div className="min-h-56">
          <button
            onClick={() => setFlipped((f) => !f)}
            className={cn(
              "flex min-h-56 w-full items-center justify-center rounded-2xl border-2 p-8 text-center transition-all",
              flipped
                ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-blue-300 bg-blue-50 hover:bg-blue-100/70 dark:bg-blue-950/30"
            )}
          >
            <div>
              {flipped ? (
                <>
                  <p className="mb-2 text-xs font-medium uppercase text-emerald-600">
                    Resposta
                  </p>
                  <p className="text-lg font-medium leading-relaxed">{card.back}</p>
                </>
              ) : (
                <>
                  <p className="mb-2 text-xs font-medium uppercase text-blue-600">
                    Frente — clique para virar
                  </p>
                  <p className="text-lg font-semibold leading-relaxed">{card.front}</p>
                </>
              )}
            </div>
          </button>
        </div>

        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
            disabled={!flipped || busy}
            onClick={() => rate("dificil")}
          >
            <X className="h-4 w-4" /> Difícil
          </Button>
          <Button
            variant="outline"
            className="border-amber-300 text-amber-600 hover:bg-amber-50"
            disabled={!flipped || busy}
            onClick={() => rate("medio")}
          >
            <Eye className="h-4 w-4" /> Médio
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={!flipped || busy}
            onClick={() => rate("facil")}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Fácil
          </Button>
        </div>
        {!flipped && (
          <p className="text-center text-sm text-muted-foreground">
            Clique no cartão para ver a resposta antes de avaliar.
          </p>
        )}
      </div>
    );
  }

  // ---------- Lista ----------
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Flashcards</h1>
          <p className="text-sm text-muted-foreground">
            {due} {due === 1 ? "revisão pendente" : "revisões pendentes"} hoje
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={startReview}>
            <RotateCcw className="h-4 w-4" /> Revisar ({due})
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Novo flashcard
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo flashcard</DialogTitle>
                <DialogDescription>
                  Frente (pergunta) e verso (resposta) para revisão espaçada.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fc-front">Frente</Label>
                  <Textarea
                    id="fc-front"
                    value={front}
                    onChange={(e) => setFront(e.target.value)}
                    placeholder="Ex.: O que é responsabilidade civil do Estado?"
                    required
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fc-back">Verso</Label>
                  <Textarea
                    id="fc-back"
                    value={back}
                    onChange={(e) => setBack(e.target.value)}
                    placeholder="Ex.: Regra do art. 37, §6º, da CF/88..."
                    required
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fc-subject">Disciplina</Label>
                    <Select value={subjectId} onValueChange={setSubjectId}>
                      <SelectTrigger id="fc-subject">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem disciplina</SelectItem>
                        {subjects.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fc-tags">Tags (vírgula)</Label>
                    <Input
                      id="fc-tags"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="constitucional, CF88"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Criar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="text-lg font-medium">Nenhum flashcard ainda</p>
          <p className="text-sm text-muted-foreground">
            Crie seus primeiros flashcards para começar a revisar.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <p className="font-medium leading-snug">{card.front}</p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {card.back}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {card.subject && (
                    <Badge
                      variant="outline"
                      style={{
                        backgroundColor: card.subject.color ? `${card.subject.color}22` : undefined,
                        color: card.subject.color ?? undefined,
                      }}
                    >
                      {card.subject.name}
                    </Badge>
                  )}
                  {card.tags?.slice(0, 3).map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-muted-foreground">
                    {card.schedule
                      ? `Revisão: ${new Date(card.schedule.due_date + "T12:00:00").toLocaleDateString("pt-BR")}`
                      : "Sem revisão agendada"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-600"
                    onClick={() => handleDelete(card)}
                    aria-label="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
