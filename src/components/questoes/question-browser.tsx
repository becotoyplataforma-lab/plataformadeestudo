"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const initialSubjectId = searchParams.get("subject_id") ?? "all";

  const [questions, setQuestions] = React.useState<Question[]>(initialQuestions);
  const [total, setTotal] = React.useState(initialTotal);
  const [page, setPage] = React.useState(1);
  const [subjectId, setSubjectId] = React.useState(initialSubjectId);
  const [banca, setBanca] = React.useState("all");
  const [nivel, setNivel] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const debouncedSearch = useDebounce(search, 400);
  // Guard de requisições obsoletas: se um novo load() disparar antes de um
  // load() antigo concluir, a resposta antiga é descartada (evita sobrescrever
  // a lista filtrada com uma resposta defasada — race condition ao trocar filtros).
  const requestSeq = React.useRef(0);

  async function load(nextPage = page) {
    const seq = ++requestSeq.current;
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
      if (seq !== requestSeq.current) return; // resposta obsoleta — ignora
      setQuestions(data.data ?? []);
      setTotal(data.total ?? 0);
      setPage(nextPage);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
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
      <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.85))] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.5)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-2 inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
              Banco de questões
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white">Questões</h1>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
            <span className="font-semibold text-white">{total}</span> disponíveis
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-300">
          Resolva simulados e veja o gabarito comentado em seguida.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            className="border-white/10 bg-slate-900/70 pl-9 text-white placeholder:text-slate-400"
            placeholder="Buscar por palavra-chave..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger className="border-white/10 bg-slate-900/70 text-white">
            <SelectValue placeholder="Matéria" />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
            <SelectItem value="all" className="focus:bg-white/5">Todas as matérias</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id} className="focus:bg-white/5">
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={banca} onValueChange={setBanca}>
          <SelectTrigger className="border-white/10 bg-slate-900/70 text-white">
            <SelectValue placeholder="Banca" />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
            <SelectItem value="all" className="focus:bg-white/5">Todas as bancas</SelectItem>
            {bancas.map((b) => (
              <SelectItem key={b} value={b} className="focus:bg-white/5">
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={nivel} onValueChange={setNivel}>
          <SelectTrigger className="border-white/10 bg-slate-900/70 text-white">
            <SelectValue placeholder="Dificuldade" />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
            <SelectItem value="all" className="focus:bg-white/5">Todas as dificuldades</SelectItem>
            <SelectItem value="facil" className="focus:bg-white/5">Fácil</SelectItem>
            <SelectItem value="medio" className="focus:bg-white/5">Médio</SelectItem>
            <SelectItem value="dificil" className="focus:bg-white/5">Difícil</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-[24px] border border-white/10 bg-slate-900/70" />
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/10 bg-slate-900/40 py-16 text-center">
            <p className="text-lg font-medium text-white">Nenhuma questão encontrada</p>
            <p className="text-sm text-slate-400">
              Tente ajustar os filtros ou buscar outros termos.
            </p>
          </div>
        ) : (
          questions.map((q) => (
            <QuestionCard key={q.id} question={q} userId={userId} />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pb-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => load(page - 1)}
            className="border-white/10 bg-slate-900/70 text-slate-100 hover:bg-white/5"
          >
            Anterior
          </Button>
          <span className="text-sm text-slate-300">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => load(page + 1)}
            className="border-white/10 bg-slate-900/70 text-slate-100 hover:bg-white/5"
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
