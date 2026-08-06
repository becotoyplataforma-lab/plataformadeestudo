"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Plus,
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
import type { StudyTask, Subject } from "@/types";
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

export function CronogramaClient({ subjects, initialTasks, week }: Props) {
  const [tasks, setTasks] = React.useState<StudyTask[]>(initialTasks);
  const [range, setRange] = React.useState(week);
  const [addTaskOpen, setAddTaskOpen] = React.useState(false);
  const [addSubjectOpen, setAddSubjectOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

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
    const res = await fetch("/api/cronograma/tarefas");
    if (res.ok) {
      const data = await res.json();
      setTasks(data.data ?? []);
    }
  }

  const doneCount = tasks.filter((t) => t.status === "concluida").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cronograma</h1>
          <p className="text-sm text-muted-foreground">
            {doneCount} de {tasks.length} tarefas concluídas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftWeek(-1)} aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRange(week)}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => shiftWeek(1)} aria-label="Próxima semana">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Dialog open={addSubjectOpen} onOpenChange={setAddSubjectOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4" /> Disciplina
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova disciplina</DialogTitle>
                <DialogDescription>
                  Adicione uma disciplina ao seu cronograma.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateSubject} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject-name">Nome da disciplina</Label>
                  <Input
                    id="subject-name"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    placeholder="Ex.: Direito Constitucional"
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={busy}>
                    Criar disciplina
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
            <DialogTrigger asChild>
              <Button>
                <CalendarPlus className="h-4 w-4" /> Nova tarefa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova tarefa de estudo</DialogTitle>
                <DialogDescription>
                  Planeje uma atividade no seu cronograma.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="task-title">Título</Label>
                  <Input
                    id="task-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex.: Estudar Direitos Fundamentais"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-desc">Descrição (opcional)</Label>
                  <Textarea
                    id="task-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detalhes da atividade..."
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="task-subject">Disciplina</Label>
                    <Select value={subjectId} onValueChange={setSubjectId}>
                      <SelectTrigger id="task-subject">
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
                    <Label htmlFor="task-date">Data</Label>
                    <Input
                      id="task-date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-duration">Duração (minutos)</Label>
                  <Input
                    id="task-duration"
                    type="number"
                    min={5}
                    max={720}
                    step={5}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={busy}>
                    Salvar tarefa
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Grade semanal */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day) => {
          const dayTasks = tasksByDate.get(day.date) ?? [];
          const isPast = day.date < range.today;
          return (
            <div
              key={day.date}
              className={cn(
                "rounded-xl border bg-card",
                day.isToday && "border-blue-500 ring-1 ring-blue-500/30"
              )}
            >
              <div
                className={cn(
                  "border-b px-3 py-2",
                  day.isToday && "rounded-t-xl bg-blue-50 dark:bg-blue-950/40"
                )}
              >
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {day.name}
                </p>
                <p className="text-sm font-bold">
                  {new Date(day.date + "T12:00:00").getDate()}
                </p>
              </div>
              <div className="space-y-2 p-2">
                {dayTasks.length === 0 && (
                  <p className="px-1 py-2 text-xs text-muted-foreground">
                    Sem tarefas
                  </p>
                )}
                {dayTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "group rounded-lg border p-2",
                      task.status === "concluida" && "border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <button
                        onClick={() => handleToggle(task)}
                        className="flex items-start gap-1.5 text-left"
                        title={task.status === "concluida" ? "Reabrir" : "Concluir"}
                      >
                        {task.status === "concluida" ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span
                          className={cn(
                            "text-xs font-medium leading-snug",
                            task.status === "concluida" && "line-through text-muted-foreground"
                          )}
                        >
                          {task.title}
                        </span>
                      </button>
                      <button
                        onClick={() => handleDelete(task)}
                        className="hidden text-muted-foreground hover:text-red-600 group-hover:block"
                        aria-label="Remover tarefa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-[22px]">
                      {task.subject && (
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                          {task.subject.name}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {formatMinutes(task.duration_min)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumo das disciplinas */}
      {subjects.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-3 text-sm font-semibold">Suas disciplinas</h3>
            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => (
                <Badge
                  key={s.id}
                  className="px-3 py-1"
                  style={{
                    backgroundColor: s.color ? `${s.color}22` : undefined,
                    color: s.color ?? undefined,
                  }}
                >
                  {s.name}
                  <span className="ml-1 opacity-60">P{s.priority}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
