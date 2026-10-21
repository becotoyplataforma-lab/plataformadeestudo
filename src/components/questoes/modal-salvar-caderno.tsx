"use client";

import * as React from "react";
import { Bookmark, Check, FolderPlus, Plus, Sparkles, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  alternarQuestaoNoCaderno,
  criarCadernoPersonalizado,
  obterCadernosPersonalizados,
  questaoEstaEmQuaisCadernos,
  type CadernoPersonalizado,
} from "@/lib/questoes/user-storage";

export interface ModalSalvarCadernoProps {
  questaoId: string;
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  enunciadoResumido?: string;
}

const CORES_PALETA = [
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#10b981", // Emerald
];

export function ModalSalvarCaderno({
  questaoId,
  aberto,
  onOpenChange,
  enunciadoResumido,
}: ModalSalvarCadernoProps) {
  const [cadernos, setCadernos] = React.useState<CadernoPersonalizado[]>([]);
  const [cadernosAtivos, setCadernosAtivos] = React.useState<string[]>([]);
  const [criando, setCriando] = React.useState(false);
  const [novoNome, setNovoNome] = React.useState("");
  const [novaCor, setNovaCor] = React.useState(CORES_PALETA[0]!);

  const carregar = React.useCallback(() => {
    const todos = obterCadernosPersonalizados();
    setCadernos(todos);
    setCadernosAtivos(questaoEstaEmQuaisCadernos(questaoId));
  }, [questaoId]);

  React.useEffect(() => {
    if (aberto) {
      carregar();
    }
  }, [aberto, carregar]);

  function alternar(cadernoId: string) {
    alternarQuestaoNoCaderno(cadernoId, questaoId);
    setCadernosAtivos(questaoEstaEmQuaisCadernos(questaoId));
    setCadernos(obterCadernosPersonalizados());
  }

  function salvarNovoCaderno(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    const criado = criarCadernoPersonalizado(novoNome, novaCor);
    alternarQuestaoNoCaderno(criado.id, questaoId);
    setNovoNome("");
    setCriando(false);
    carregar();
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-white/10 text-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-cyan-400" />
            Salvar Questão em um Caderno
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Organize suas questões favoritas, dúvidas e pontos de atenção em listas temáticas.
          </DialogDescription>
        </DialogHeader>

        {enunciadoResumido && (
          <div className="rounded-xl bg-white/5 border border-white/5 p-2.5 text-xs text-slate-300 italic line-clamp-2">
            "{enunciadoResumido}"
          </div>
        )}

        <div className="space-y-2 mt-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Seus Cadernos ({cadernos.length})
          </span>

          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
            {cadernos.map((c) => {
              const selecionado = cadernosAtivos.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => alternar(c.id)}
                  className={`w-full flex items-center justify-between rounded-xl p-3 text-left transition-all border ${
                    selecionado
                      ? "bg-cyan-950/40 border-cyan-500/40 text-white"
                      : "bg-slate-950/60 border-white/5 text-slate-300 hover:bg-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: c.cor }}
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-semibold block truncate">
                        {c.nome}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {c.questoesIds.length} questão(ões) salva(s)
                      </span>
                    </div>
                  </div>

                  <div
                    className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
                      selecionado
                        ? "bg-cyan-500 border-cyan-400 text-slate-950 font-bold"
                        : "border-white/20 bg-white/5 text-transparent"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* FORMULÁRIO DE CRIAÇÃO DE NOVO CADERNO */}
        {criando ? (
          <form
            onSubmit={salvarNovoCaderno}
            className="rounded-xl border border-white/10 bg-slate-950 p-3 space-y-3 mt-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <FolderPlus className="h-3.5 w-3.5 text-cyan-400" />
                Criar Novo Caderno
              </span>
              <button
                type="button"
                onClick={() => setCriando(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <Input
              type="text"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex: Pegadinhas FGV Crase"
              autoFocus
              required
              className="bg-white/5 border-white/10 text-xs text-white placeholder:text-slate-500 h-9"
            />

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {CORES_PALETA.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setNovaCor(cor)}
                    className={`h-5 w-5 rounded-full transition-transform ${
                      novaCor === cor ? "scale-125 ring-2 ring-white" : "opacity-70 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: cor }}
                  />
                ))}
              </div>

              <Button
                type="submit"
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs h-8 px-3"
              >
                Criar e Salvar
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCriando(true)}
            className="w-full border-dashed border-white/20 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 text-xs mt-2 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5 text-cyan-400" />
            Criar novo caderno personalizado
          </Button>
        )}

        <div className="pt-2 border-t border-white/10 flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-4"
          >
            Concluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ModalSalvarCaderno;
