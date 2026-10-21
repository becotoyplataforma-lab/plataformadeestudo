"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  FolderPlus,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  criarCadernoPersonalizado,
  limparCadernoDeErros,
  obterCadernosPersonalizados,
  obterIdsComErro,
  removerCadernoPersonalizado,
  type CadernoPersonalizado,
} from "@/lib/questoes/user-storage";

const CORES_PALETA = [
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#10b981", // Emerald
];

export function GerenciadorCadernosAluno() {
  const [cadernos, setCadernos] = React.useState<CadernoPersonalizado[]>([]);
  const [errosCount, setErrosCount] = React.useState(0);
  const [modalCriarAberto, setModalCriarAberto] = React.useState(false);
  const [novoNome, setNovoNome] = React.useState("");
  const [novaDesc, setNovaDesc] = React.useState("");
  const [novaCor, setNovaCor] = React.useState(CORES_PALETA[0]!);

  const carregar = React.useCallback(() => {
    setCadernos(obterCadernosPersonalizados());
    setErrosCount(obterIdsComErro().length);
  }, []);

  React.useEffect(() => {
    carregar();
    const handleUpdate = () => carregar();
    window.addEventListener("concursoai_cadernos_atualizado", handleUpdate);
    window.addEventListener("concursoai_progresso_atualizado", handleUpdate);
    return () => {
      window.removeEventListener("concursoai_cadernos_atualizado", handleUpdate);
      window.removeEventListener("concursoai_progresso_atualizado", handleUpdate);
    };
  }, [carregar]);

  function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    criarCadernoPersonalizado(novoNome, novaCor, novaDesc);
    setNovoNome("");
    setNovaDesc("");
    setModalCriarAberto(false);
    carregar();
  }

  function handleExcluir(id: string, nome: string) {
    if (confirm(`Tem certeza que deseja excluir o caderno "${nome}"?`)) {
      removerCadernoPersonalizado(id);
      carregar();
    }
  }

  return (
    <div className="space-y-8">
      {/* 1. CADERNO DE ERROS AUTOMÁTICO - DESTAQUE */}
      <section className="rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-950 p-6 sm:p-7 shadow-xl shadow-rose-950/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 px-3 py-1 text-xs font-bold text-rose-300">
              <AlertCircle className="h-3.5 w-3.5" />
              Recuperação Ativa & Retenção
            </div>
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              Caderno de Erros Automático
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Toda questão que você erra nas listas e simulados cai aqui automaticamente.
              Refaça os itens até acertar para eliminá-los da lista de erros e garantir fixação total do conteúdo.
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-3 shrink-0">
            <div className="text-left sm:text-right">
              <span className="text-3xl font-black text-white tabular-nums">
                {errosCount}
              </span>
              <span className="text-xs text-rose-300 block font-semibold">
                {errosCount === 1 ? "questão com erro" : "questões com erro"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {errosCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Deseja zerar seu caderno de erros?")) {
                      limparCadernoDeErros();
                      carregar();
                    }
                  }}
                  className="text-xs text-slate-400 hover:text-white hover:bg-white/10"
                >
                  Zerar erros
                </Button>
              )}
              <Link
                href="/questoes?status=errei"
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm px-5 py-2.5 shadow-md shadow-rose-950 transition-all"
              >
                <span>Praticar Erros</span>
                <span>&rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. MEUS CADERNOS PERSONALIZADOS */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-cyan-400" />
              <h3 className="text-lg font-bold text-white">
                Meus Cadernos Personalizados
              </h3>
              <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-400 tabular-nums">
                {cadernos.length}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Listas criadas por você para organizar questões por temas, fórmulas ou favoritos.
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => setModalCriarAberto(true)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Criar Novo Caderno
          </Button>
        </div>

        {cadernos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/50 p-8 text-center">
            <Bookmark className="mx-auto h-8 w-8 text-slate-500" />
            <p className="mt-2 text-sm text-slate-300 font-semibold">
              Nenhum caderno personalizado criado ainda
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Crie cadernos para agrupar questões pelo card ou clique no botão acima para começar.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cadernos.map((cad) => (
              <div
                key={cad.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-sm hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-950/20 transition-all"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
                      style={{
                        backgroundColor: `${cad.cor}20`,
                        borderColor: `${cad.cor}40`,
                        color: cad.cor,
                        borderWidth: 1,
                      }}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: cad.cor }}
                      />
                      {cad.questoesIds.length}{" "}
                      {cad.questoesIds.length === 1 ? "questão" : "questões"}
                    </span>

                    {/* Não permite deletar favoritos padrão se quiser, ou permite tudo */}
                    <button
                      type="button"
                      onClick={() => handleExcluir(cad.id, cad.nome)}
                      title="Excluir caderno"
                      className="text-slate-500 hover:text-rose-400 p-1 rounded-md hover:bg-white/5 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <h4 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {cad.nome}
                  </h4>

                  {cad.descricao && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {cad.descricao}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {cad.questoesIds.length === 0
                      ? "Vazio — adicione pelo card"
                      : "Pronto para treino"}
                  </span>
                  <Link
                    href={`/questoes?caderno=${encodeURIComponent(cad.id)}`}
                    className="text-xs font-bold text-cyan-400 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all inline-flex items-center gap-1"
                  >
                    Estudar &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODAL CRIAR CADERNO */}
      <Dialog open={modalCriarAberto} onOpenChange={setModalCriarAberto}>
        <DialogContent className="max-w-md bg-slate-900 border-white/10 text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-cyan-400" />
              Novo Caderno Personalizado
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Dê um nome e escolha uma cor para organizar suas questões de estudo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCriar} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nome do Caderno *
              </label>
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex: Fórmulas de Geometria, Pegadinhas FGV..."
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-xs"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Descrição (opcional)
              </label>
              <Input
                value={novaDesc}
                onChange={(e) => setNovaDesc(e.target.value)}
                placeholder="Ex: Questões para revisar na véspera da prova..."
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Cor de Identificação
              </label>
              <div className="flex items-center gap-2">
                {CORES_PALETA.map((cor) => {
                  const sel = novaCor === cor;
                  return (
                    <button
                      key={cor}
                      type="button"
                      onClick={() => setNovaCor(cor)}
                      className={`h-7 w-7 rounded-full transition-transform ${
                        sel ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-slate-900" : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: cor }}
                      aria-label={`Cor ${cor}`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setModalCriarAberto(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
              >
                Criar Caderno
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
