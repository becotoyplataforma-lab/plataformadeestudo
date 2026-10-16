"use client";

import { useCallback, useEffect, useState } from "react";

interface ContestOption {
  id: string;
  title: string;
}

interface PositionOption {
  id: string;
  name: string;
  editalId: string | null;
}

const SELECT_CLASS =
  "w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200";

/**
 * Seletor de escopo de compartilhamento (concurso -> cargo) para o upload de
 * apostilas.
 *
 * O form envia apenas `position_id`: a rota confirma que o cargo existe, esta
 * vivo e pertence ao concurso informado, e herda o edital vinculado a ele. Sem
 * cargo selecionado o documento fica privado - compartilhar nunca e implicito.
 */
export function ScopeSelect({
  positionId,
  onPositionChange,
}: {
  positionId: string;
  onPositionChange: (id: string) => void;
}) {
  const [contests, setContests] = useState<ContestOption[]>([]);
  const [contestId, setContestId] = useState("");
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/contests")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (alive) setContests(Array.isArray(data) ? (data as ContestOption[]) : []);
      })
      .catch(() => {
        if (alive) setContests([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const loadPositions = useCallback(async (id: string) => {
    if (!id) {
      setPositions([]);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/positions?contest_id=${encodeURIComponent(id)}`);
      const data: unknown = r.ok ? await r.json() : [];
      setPositions(Array.isArray(data) ? (data as PositionOption[]) : []);
    } catch {
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-400">
        Escopo de compartilhamento (opcional)
      </p>
      <select
        aria-label="Concurso do escopo"
        value={contestId}
        onChange={(e) => {
          const next = e.target.value;
          setContestId(next);
          onPositionChange("");
          void loadPositions(next);
        }}
        className={SELECT_CLASS}
      >
        <option value="">{contests.length ? "Concurso" : "Nenhum concurso cadastrado"}</option>
        {contests.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <select
        aria-label="Cargo do escopo"
        value={positionId}
        onChange={(e) => onPositionChange(e.target.value)}
        disabled={!contestId || loading}
        className={SELECT_CLASS}
      >
        <option value="">
          {loading
            ? "Carregando cargos..."
            : contestId
              ? "Nao compartilhar (so dono e admin veem)"
              : "Cargo (escolha o concurso antes)"}
        </option>
        {positions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-slate-500">
        Com cargo, a apostila fica disponivel para os alunos desse cargo (e do
        edital vinculado). Sem cargo, permanece privada.
      </p>
    </div>
  );
}