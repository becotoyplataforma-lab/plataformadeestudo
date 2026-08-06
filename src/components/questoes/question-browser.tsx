"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import type { Question } from "@/types";
import { QuestionCard } from "@/components/questoes/question-card";

interface Props {
  initialQuestions: Question[];
  initialTotal: number;
  bancas: string[];
  subjects: { id: string; name: string; color: string | null }[];
  userId: string;
}

const PAGE_SIZE = 15;

export function QuestionBrowser({
  initialQuestions,
  initialTotal,
  bancas,
  subjects,
  userId,
}: Props) {
  const [questions, setQuestions] = React.useState<Question[]>(initialQuestions);
  const [total, setTotal] = React.useState(initialTotal);
  const [page, setPage] = React.useState(1);
  const [subjectId, setSubjectId] = React.useState("all");
  const [banca, setBanca] = React.useState("all");
  const [nivel, setNivel] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const debouncedSearch = useDebounce(search, 400);

  async function load(nextPage = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(PAGE_SIZE),
      });
      if (subjectId !== "all") params.set("subject_id", subjectId);
      if (banca !== "all") params.set("banca", banca);
      if (nivel !== "all") params.set("nivel", nivel);
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());

      const res = await fetch(`/api/questoes?${params.toString()}`);
      const data = await res.json();
      setQuestions(data.data ?? []);
      setTotal(data.total ?? 0);
      setPage(nextPage);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    // Padrão legítimo de busca ao mudar filtros (fetch dispara setState de loading).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, banca, nivel, debouncedSearch]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Banco de Questões</h1>
        <p className="text-sm text-muted-foreground">
          {total} questões disponíveis — resolva e veja o gabarito comentado.
        </p>
      </div>

      {/* Filtros */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por palavra-chave..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger>
            <SelectValue placeholder="Matéria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as matérias</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={banca} onValueChange={setBanca}>
          <SelectTrigger>
            <SelectValue placeholder="Banca" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as bancas</SelectItem>
            {bancas.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={nivel} onValueChange={setNivel}>
          <SelectTrigger>
            <SelectValue placeholder="Dificuldade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as dificuldades</SelectItem>
            <SelectItem value="facil">Fácil</SelectItem>
            <SelectItem value="medio">Médio</SelectItem>
            <SelectItem value="dificil">Difícil</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center">
            <p className="text-lg font-medium">Nenhuma questão encontrada</p>
            <p className="text-sm text-muted-foreground">
              Tente ajustar os filtros ou buscar outros termos.
            </p>
          </div>
        ) : (
          questions.map((q) => (
            <QuestionCard key={q.id} question={q} userId={userId} />
          ))
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => load(page - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => load(page + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
