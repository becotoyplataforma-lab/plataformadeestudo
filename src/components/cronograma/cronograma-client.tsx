"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
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
import { cn, formatMinutes } from "@/lib/utils";
import type {
  StudyTask,
  Subject,
  PlannerGenerateResponse,
  PlannerPriority,
} from "@/types";
import {
  actionCreateSubject,
  actionCreateTask,
  actionDeleteTask,
  actionToggleTask,
} from "@/app/(dashboard)/cronograma/actions";

interface WeekRange {
  from: string;
  to: string;
  today: string;
}

interface Props {
  subjects: Subject[];
  initialTasks: StudyTask[];
  week: WeekRange;
}

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// --- Helpers do planejador inteligente ---

function priorityDot(priority: number): string {
  if (priority >= 5) return "🔴";
  if (priority >= 3) return "🟡";
  return "🟢";
}

function priorityBadge(priority: number): string {
  if (priority >= 5) return "border-red-400/30 bg-red-500/15 text-red-300";
  if (priority >= 3) return "border-amber-400/30 bg-amber-500/15 text-amber-300";
  return "border-emerald-400/30 bg-emerald-500/15 text-emerald-300";
}

function priorityReason(p: PlannerPriority): string {
  const parts: string[] = [];
  if (p.performance && p.performance.total > 0) {
    parts.push(`${p.performance.accuracy_pct}% de acerto`);
  }
  if (p.factors.total_questions > 0) {
    parts.push(`${p.factors.total_questions} questões respondidas`);
  }
  if (p.factors.trend === "down") parts.push("desempenho caindo");
  else if (p.factors.trend === "up") parts.push("desempenho subindo");
  else parts.push("desempenho estável");
  if (p.factors.days_since_last_task === 0) parts.push("estudado hoje");
  else if (p.factors.days_since_last_task === 1) parts.push("1 dia sem estudar");
  else if (p.factors.days_since_last_task < 999) {
    parts.push(`${p.factors.days_since_last_task} dias sem estudar`);
  }
  // Banca (Grupo C) — só aparece quando há banca alvo configurada
  if (p.factors.banca_target) {
    const s = p.factors.banca_score;
    if (s > 0.05) parts.push(`banca ${p.factors.banca_target} — alta incidência`);
    else if (s < -0.05) parts.push(`banca ${p.factors.banca_target} — baixa incidência`);
    else parts.push(`banca ${p.factors.banca_target} — incidência média`);
  }
  return parts.join(" · ");
}

export function CronogramaClient({ subjects, initialTasks, week }: Props) {
  const [tasks, setTasks] = React.useState<StudyTask[]>(initialTasks);
  const [range, setRange] = React.useState(week);
  const [addTaskOpen, setAddTaskOpen] = React.useState(false);
  const [addSubjectOpen, setAddSubjectOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [plannerBusy, setPlannerBusy] = React.useState(false);
  const [plannerPriorities, setPlannerPriorities] = React.useState<PlannerPriority[]>([]);

  // Formulário de nova tarefa
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [subjectId, setSubjectId] = React.useState<string>("none");
  const [scheduledDate, setScheduledDate] = React.useState(week.today);
  const [duration, setDuration] = React.useState(60);

  // Formulário de nova disciplina
  const [subjectName, setSubjectName] = React.useState("");

  // Gera os 7 dias do range atual
  const days = React.useMemo(() => {
    const list: { date: string; name: string; isToday: boolean }[] = [];
    const start = new Date(range.from + "T12:00:00");
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      list.push({
        date: iso,
        name: DAY_NAMES[d.getDay()],
        isToday: iso === range.today,
      });
    }
    return list;
  }, [range]);

  const tasksByDate = React.useMemo(() => {
    const map = new Map<string, StudyTask[]>();
    for (const t of tasks) {
      const arr = map.get(t.scheduled_date) ?? [];
      arr.push(t);
      map.set(t.scheduled_date, arr);
    }
    return map;
  }, [tasks]);

  function shiftWeek(direction: number) {
    const start = new Date(range.from + "T12:00:00");
    start.setDate(start.getDate() + direction * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    setRange({
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
      today: week.today,
    });
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await actionCreateTask({
      title,
      description: description || null,
      subject_id: subjectId === "none" ? null : subjectId,
      scheduled_date: scheduledDate,
      duration_min: duration,
    });
    setBusy(false);
    if (result.success) {
      toast.success(result.message);
      setTitle("");
      setDescription("");
      setAddTaskOpen(false);
      refreshTasks();
    } else {
      toast.error(result.message);
    }
  }

  async function handleCreateSubject(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await actionCreateSubject({ name: subjectName });
    setBusy(false);
    if (result.success) {
      toast.success(result.message);
      setSubjectName("");
      setAddSubjectOpen(false);
      window.location.reload();
    } else {
      toast.error(result.message);
    }
  }

  async function handleToggle(task: StudyTask) {
    const result = await actionToggleTask(task.id, task.status);
    if (result.success) refreshTasks();
    else toast.error(result.message);
  }

  async function handleDelete(task: StudyTask) {
    if (!confirm(`Remover a tarefa "${task.title}"?`)) return;
    const result = await actionDeleteTask(task.id);
    if (result.success) {
      toast.success(result.message);
      refreshTasks();
    } else {
      toast.error(result.message);
    }
  }

  async function refreshTasks() {
    const res = await fetch("/api/study/tasks");
    if (res.ok) {
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    }
  }

  async function handleReplan() {
    setPlannerBusy(true);
    const loading = toast.loading("Analisando seu desempenho...");
    try {
      const res = await fetch("/api/study/planner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: range.from,
          active_days: [1, 2, 3, 4, 5],
        }),
      });
      toast.dismiss(loading);
      if (!res.ok) throw new Error("Falha ao gerar planejamento");
      const data: PlannerGenerateResponse = await res.json();
      setPlannerPriorities(data.priorities);
      toast.success(
        `Cronograma atualizado! ${data.priorities.length} matérias analisadas · ${data.tasks_created} tarefas reorganizadas.`
      );
      await refreshTasks();
    } catch (error) {
      console.error("[cronograma] replan", error);
      toast.dismiss(loading);
      toast.error("Erro ao replanejar. Tente novamente.");
    } finally {
      setPlannerBusy(false);
    }
  }

  const doneCount = tasks.filter((t) => t.status === "concluida").length;

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),transparent_26%),linear-gradient(135deg,rgba(15,23,42,0.97),rgba(15,23,42,0.85))] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.5)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-2 inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-200">
              Cronograma
            </p>
            <h1 className="text-3xl font-extrabold tracking-[-0.06em] text-white">Seu plano de estudos</h1>
          </div>
          <p className="text-sm text-slate-300">
            {doneCount} de {tasks.length} tarefas concluídas
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftWeek(-1)} aria-label="Semana anterior" className="border-white/10 bg-slate-900/70 text-slate-100 hover:bg-white/5">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRange(week)} className="border-white/10 bg-slate-900/70 text-slate-100 hover:bg-white/5">
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => shiftWeek(1)} aria-label="Próxima semana" className="border-white/10 bg-slate-900/70 text-slate-100 hover:bg-white/5">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button
              onClick={handleReplan}
              disabled={plannerBusy}
              className="bg-gradient-to-r from-emerald-400 to-teal-600 text-white hover:from-emerald-300 hover:to-teal-500"
            >
              {plannerBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {plannerBusy ? "Analisando..." : "Replanejar com IA"}
            </Button>
            <Dialog open={addSubjectOpen} onOpenChange={setAddSubjectOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-white/10 bg-slate-900/70 text-slate-100 hover:bg-white/5">
                  <Plus className="h-4 w-4" /> Disciplina
                </Button>
              </DialogTrigger>
              <DialogContent className="border-white/10 bg-slate-950 text-slate-100">
                <DialogHeader>
                  <DialogTitle>Nova disciplina</DialogTitle>
                  <DialogDescription className="text-slate-400">Adicione uma disciplina ao seu cronograma.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateSubject} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject-name" className="text-slate-200">Nome da disciplina</Label>
                    <Input id="subject-name" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Ex.: Direito Constitucional" required className="border-white/10 bg-slate-900 text-white placeholder:text-slate-400" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={busy} className="bg-gradient-to-r from-cyan-400 to-blue-600 text-white hover:from-cyan-300 hover:to-blue-500">
                      Criar disciplina
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-cyan-400 to-blue-600 text-white hover:from-cyan-300 hover:to-blue-500">
                  <CalendarPlus className="h-4 w-4" /> Nova tarefa
                </Button>
              </DialogTrigger>
              <DialogContent className="border-white/10 bg-slate-950 text-slate-100">
                <DialogHeader>
                  <DialogTitle>Nova tarefa de estudo</DialogTitle>
                  <DialogDescription className="text-slate-400">Planeje uma atividade no seu cronograma.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateTask} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="task-title" className="text-slate-200">Título</Label>
                    <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Estudar Direitos Fundamentais" required className="border-white/10 bg-slate-900 text-white placeholder:text-slate-400" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-desc" className="text-slate-200">Descrição (opcional)</Label>
                    <Textarea id="task-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes da atividade..." rows={2} className="border-white/10 bg-slate-900 text-white placeholder:text-slate-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="task-subject" className="text-slate-200">Disciplina</Label>
                      <Select value={subjectId} onValueChange={setSubjectId}>
                        <SelectTrigger id="task-subject" className="border-white/10 bg-slate-900 text-white">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
                          <SelectItem value="none" className="focus:bg-white/5">Sem disciplina</SelectItem>
                          {subjects.map((s) => (
                            <SelectItem key={s.id} value={s.id} className="focus:bg-white/5">
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="task-date" className="text-slate-200">Data</Label>
                      <Input id="task-date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} required className="border-white/10 bg-slate-900 text-white" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-duration" className="text-slate-200">Duração (minutos)</Label>
                    <Input id="task-duration" type="number" min={5} max={720} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="border-white/10 bg-slate-900 text-white" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={busy} className="bg-gradient-to-r from-cyan-400 to-blue-600 text-white hover:from-cyan-300 hover:to-blue-500">
                      Salvar tarefa
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day) => {
          const dayTasks = tasksByDate.get(day.date) ?? [];
          return (
            <div key={day.date} className={cn("rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))]", day.isToday && "border-cyan-400/50 ring-1 ring-cyan-400/25")}>
              <div className={cn("border-b border-white/10 px-3 py-2", day.isToday && "rounded-t-[22px] bg-cyan-500/10")}>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{day.name}</p>
                <p className="mt-1 text-sm font-extrabold text-white">{new Date(day.date + "T12:00:00").getDate()}</p>
              </div>
              <div className="space-y-2 p-2">
                {dayTasks.length === 0 && (
                  <p className="px-1 py-2 text-xs text-slate-400">Sem tarefas</p>
                )}
                {dayTasks.map((task) => (
                  <div key={task.id} className={cn("group rounded-xl border border-white/10 bg-slate-900/55 p-2", task.status === "concluida" && "border-emerald-400/20 bg-emerald-500/10")}>
                    <div className="flex items-start justify-between gap-1">
                      <button onClick={() => handleToggle(task)} className="flex items-start gap-1.5 text-left" title={task.status === "concluida" ? "Reabrir" : "Concluir"}>
                        {task.status === "concluida" ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                        ) : (
                          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        <span className={cn("text-xs font-semibold leading-snug text-slate-100", task.status === "concluida" && "line-through text-slate-400")}>{task.title}</span>
                      </button>
                      <button onClick={() => handleDelete(task)} className="hidden text-slate-400 hover:text-red-400 group-hover:block" aria-label="Remover tarefa">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-[22px]">
                      {task.subject && (
                        <Badge variant="outline" className="border-white/10 bg-white/5 px-1.5 py-0 text-[10px] text-slate-200">{task.subject.name}</Badge>
                      )}
                      <span className="text-[10px] text-slate-400">{formatMinutes(task.duration_min)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {subjects.length > 0 && (
        <Card className="border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] shadow-[0_14px_35px_rgba(15,23,42,0.35)]">
          <CardContent className="pt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-200">Suas disciplinas</h3>
              {plannerPriorities.length > 0 && (
                <Badge variant="outline" className="border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                  <Sparkles className="mr-1 h-3 w-3" /> Planejamento inteligente
                </Badge>
              )}
            </div>

            {plannerPriorities.length > 0 && (
              <div className="mb-4 space-y-2 rounded-xl border border-white/10 bg-slate-900/60 p-3">
                <p className="text-xs text-slate-400">
                  Seu cronograma é ajustado automaticamente conforme seu desempenho.
                </p>
                {plannerPriorities
                  .slice()
                  .sort((a, b) => b.priority - a.priority)
                  .map((p) => (
                    <div key={p.subject_id} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <p className="font-semibold text-slate-100">
                          {priorityDot(p.priority)} {p.subject_name}
                        </p>
                        <p className="text-xs text-slate-400">{priorityReason(p)}</p>
                      </div>
                      <Badge className={priorityBadge(p.priority)}>Prioridade {p.priority}</Badge>
                    </div>
                  ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => {
                const planner = plannerPriorities.find((p) => p.subject_id === s.id);
                const priority = planner?.priority ?? s.priority;
                return (
                  <Badge key={s.id} className="px-3 py-1 border border-white/10 bg-slate-900/60 text-slate-100" style={{ backgroundColor: s.color ? `${s.color}22` : undefined, color: s.color ?? undefined }}>
                    {priorityDot(priority)} {s.name}
                    <span className="ml-1 opacity-60">P{priority}</span>
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
