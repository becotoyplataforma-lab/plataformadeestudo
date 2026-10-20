"use client";

/**
 * ConcursoAI — Minhas Apostilas (Fase 1)
 *
 * Hierarquia Concurso → Matéria → Apostila, lida de /api/apostilas (DTO validado).
 * O binário nunca é referenciado direto: ler/baixar passam pela rota autenticada.
 */
import * as React from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Download,
  FileText,
  FolderOpen,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ApostilaDto, ApostilasListaDto } from "@/lib/dto/apostilas.dto";
import { ApostilaLeitor } from "./apostila-leitor";

/** Espelha SEM_MATERIA_ID/SEM_MATERIA_NOME do DTO (import type-only evita zod no bundle). */
const SEM_MATERIA_ID = "sem-materia";
const SEM_MATERIA_NOME = "Sem matéria";
const TODOS = "todos";
const TODAS = "todas";

interface ApostilasClientProps {
  initialLista: ApostilasListaDto | null;
}

function formatarTamanho(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function formatarData(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

const ROTULOS_STATUS: Record<ApostilaDto["status"], string> = {
  pending: "pendente",
  processing: "processando",
  processed: "processado",
  chunked: "fatiado",
  indexing: "indexando",
  indexed: "indexado",
  failed: "falhou",
};

export function ApostilasClient({ initialLista }: ApostilasClientProps) {
  const [lista, setLista] = React.useState<ApostilasListaDto | null>(initialLista);
  const [carregando, setCarregando] = React.useState(initialLista === null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [concurso, setConcurso] = React.useState<string>(TODOS);
  const [materia, setMateria] = React.useState<string>(TODAS);
  const [busca, setBusca] = React.useState("");
  const [buscaDebounced, setBuscaDebounced] = React.useState("");
  const [aberta, setAberta] = React.useState<ApostilaDto | null>(null);

  // Estados do Modal de Upload Web
  const [modalUploadAberto, setModalUploadAberto] = React.useState(false);
  const [uploadArquivo, setUploadArquivo] = React.useState<File | null>(null);
  const [uploadTitulo, setUploadTitulo] = React.useState("");
  const [uploadConcurso, setUploadConcurso] = React.useState("CBM-RJ");
  const [uploadMateria, setUploadMateria] = React.useState("Língua Portuguesa");
  const [enviando, setEnviando] = React.useState(false);
  const [msgSucesso, setMsgSucesso] = React.useState<string | null>(null);

  /**
   * Opções de filtro capturadas na resposta SEM filtros: se derivássemos dos
   * dados já filtrados, a lista de matérias encolheria e travaria a seleção.
   */
  const [opcoes, setOpcoes] = React.useState<{
    materias: { id: string; nome: string }[];
    concursos: string[];
  }>({
    materias:
      initialLista?.materias.map((grupo) => ({
        id: grupo.materia_id,
        nome: grupo.materia_nome,
      })) ?? [],
    concursos: initialLista?.concursos ?? [],
  });

  React.useEffect(() => {
    const timer = setTimeout(() => setBuscaDebounced(busca.trim()), 300);
    return () => clearTimeout(timer);
  }, [busca]);

  const carregar = React.useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (materia !== TODAS && materia !== SEM_MATERIA_ID) params.set("materia_id", materia);
      if (concurso !== TODOS) params.set("concurso", concurso);
      if (buscaDebounced) params.set("busca", buscaDebounced);

      const query = params.toString();
      const semFiltros = query === "";
      const resposta = await fetch(`/api/apostilas${query ? `?${query}` : ""}`);

      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => null)) as { error?: string } | null;
        setErro(corpo?.error ?? "Não foi possível carregar suas apostilas.");
        return;
      }

      const dados = (await resposta.json()) as ApostilasListaDto;
      setLista(dados);

      // Snapshot das opções apenas na carga sem filtros (ver comentário do state).
      if (semFiltros) {
        setOpcoes({
          materias: dados.materias.map((grupo) => ({
            id: grupo.materia_id,
            nome: grupo.materia_nome,
          })),
          concursos: dados.concursos,
        });
      }
    } catch (error) {
      console.error("[apostilas] falha ao carregar:", error);
      setErro("Falha na conexão com o servidor.");
    } finally {
      setCarregando(false);
    }
  }, [materia, concurso, buscaDebounced]);

  // Com SSR, a primeira carga não repete o fetch; filtros seguintes sempre recarregam.
  const primeiraExecucao = React.useRef(true);

  React.useEffect(() => {
    if (primeiraExecucao.current) {
      primeiraExecucao.current = false;
      if (initialLista !== null) return;
    }
    void carregar();
  }, [carregar, initialLista]);

  async function executarUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadArquivo) return;
    setEnviando(true);
    setMsgSucesso(null);
    try {
      const data = new FormData();
      data.append("file", uploadArquivo);
      data.append("titulo", uploadTitulo || uploadArquivo.name.replace(/\.[^/.]+$/, ""));
      data.append("concurso", uploadConcurso);
      data.append("materia", uploadMateria);

      const res = await fetch("/api/apostilas/upload", {
        method: "POST",
        body: data,
      });
      const json = await res.json();
      if (res.ok) {
        setMsgSucesso("Apostila enviada com sucesso!");
        setTimeout(() => {
          setModalUploadAberto(false);
          setUploadArquivo(null);
          setUploadTitulo("");
          setMsgSucesso(null);
          void carregar();
        }, 1200);
      } else {
        alert(json.error || "Erro no envio");
      }
    } catch (err: any) {
      alert("Falha na comunicação: " + err.message);
    } finally {
      setEnviando(false);
    }
  }

  const materiasVisiveis = React.useMemo(() => {
    if (!lista) return [];
    if (materia === TODAS) return lista.materias;
    return lista.materias.filter((grupo) => grupo.materia_id === materia);
  }, [lista, materia]);

  const filtrosAtivos = concurso !== TODOS || materia !== TODAS || buscaDebounced !== "";

  function limparFiltros() {
    setConcurso(TODOS);
    setMateria(TODAS);
    setBusca("");
    setBuscaDebounced("");
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-400">
            Knowledge Core
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-white md:text-3xl">
            Minhas Apostilas
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Concurso → Matéria → Apostila, com leitura interativa no navegador.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Stat icone={FileText} rotulo="Apostilas" valor={lista?.total_apostilas ?? 0} />
          <Stat icone={FolderOpen} rotulo="Matérias" valor={lista?.total_materias ?? 0} />
          <Stat icone={BookOpen} rotulo="Concursos" valor={lista?.concursos.length ?? 0} />
          
          <Button
            size="sm"
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold gap-1.5 shadow-sm"
            onClick={() => setModalUploadAberto(true)}
          >
            <Upload className="h-4 w-4" />
            Enviar Apostila
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void carregar()}
            disabled={carregando}
          >
            {carregando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Atualizar
          </Button>
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por título da apostila…"
            className="pl-9"
            aria-label="Buscar apostila"
          />
        </div>

        <Select value={concurso} onValueChange={setConcurso}>
          <SelectTrigger className="w-[200px]" aria-label="Filtrar por concurso">
            <SelectValue placeholder="Concurso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os concursos</SelectItem>
            {opcoes.concursos.map((nome) => (
              <SelectItem key={nome} value={nome}>
                {nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={materia} onValueChange={setMateria}>
          <SelectTrigger className="w-[200px]" aria-label="Filtrar por matéria">
            <SelectValue placeholder="Matéria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas as matérias</SelectItem>
            {opcoes.materias.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtrosAtivos && (
          <Button variant="ghost" size="sm" onClick={limparFiltros}>
            Limpar filtros
          </Button>
        )}
      </section>

      {erro && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{erro}</span>
          <Button variant="outline" size="sm" onClick={() => void carregar()}>
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      )}

      {carregando && (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      )}

      {!carregando && !erro && materiasVisiveis.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Layers className="h-8 w-8 text-slate-500" />
            <p className="text-sm font-semibold text-white">Nenhuma apostila por aqui</p>
            <p className="max-w-sm text-xs text-slate-400">
              {filtrosAtivos
                ? "Nenhum resultado para os filtros escolhidos."
                : "Envie um PDF usando o botão 'Enviar Apostila' e ele aparecerá aqui automaticamente."}
            </p>
            {filtrosAtivos && (
              <Button variant="outline" size="sm" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!carregando &&
        materiasVisiveis.map((grupo) => (
          <Card key={grupo.materia_id}>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
              <span
                className="h-8 w-8 shrink-0 rounded-xl"
                style={{ backgroundColor: grupo.materia_cor ?? "#06b6d4" }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <CardTitle className="truncate text-base">{grupo.materia_nome}</CardTitle>
                <p className="mt-0.5 text-xs text-slate-400">
                  {grupo.total} {grupo.total === 1 ? "apostila" : "apostilas"}
                </p>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {grupo.apostilas.map((apostila) => (
                <LinhaApostila key={apostila.id} apostila={apostila} onAbrir={setAberta} />
              ))}
            </CardContent>
          </Card>
        ))}

      {/* MODAL DE LEITURA INTERATIVA */}
      <Dialog open={aberta !== null} onOpenChange={(novo) => !novo && setAberta(null)}>
        <DialogContent className="max-w-6xl w-[96vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="truncate pr-8 text-base">
              {aberta?.titulo ?? "Apostila"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {aberta?.concurso ?? "Concurso não informado"} ·{" "}
              {aberta?.materia_nome ?? SEM_MATERIA_NOME}
            </DialogDescription>
          </DialogHeader>
          {aberta && (
            <ApostilaLeitor
              url={aberta.arquivo_url}
              pdfUrl={aberta.pdf_url || aberta.download_url}
              titulo={aberta.titulo}
              mimeType={aberta.mime_type ?? "application/pdf"}
              tamanhoBytes={aberta.tamanho_bytes}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE UPLOAD DE APOSTILA */}
      <Dialog open={modalUploadAberto} onOpenChange={setModalUploadAberto}>
        <DialogContent className="max-w-lg bg-slate-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Upload className="h-5 w-5 text-cyan-400" />
              Enviar Nova Apostila
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Faça upload de apostilas (PDF) para indexação e estudo no leitor interativo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={executarUpload} className="flex flex-col gap-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Arquivo PDF
              </label>
              <Input
                type="file"
                accept=".pdf,application/pdf"
                required
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setUploadArquivo(f);
                    if (!uploadTitulo) {
                      setUploadTitulo(f.name.replace(/\.[^/.]+$/, ""));
                    }
                  }
                }}
                className="bg-white/5 border-white/10 file:bg-cyan-600 file:text-white file:border-0 file:rounded-md file:px-2.5 file:py-1 file:mr-3 file:text-xs file:font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Título da Apostila
              </label>
              <Input
                type="text"
                value={uploadTitulo}
                onChange={(e) => setUploadTitulo(e.target.value)}
                placeholder="Ex: CBM-RJ | Português — Aula 03"
                required
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Concurso
                </label>
                <Input
                  type="text"
                  value={uploadConcurso}
                  onChange={(e) => setUploadConcurso(e.target.value)}
                  placeholder="Ex: CBM-RJ"
                  required
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Matéria
                </label>
                <Input
                  type="text"
                  value={uploadMateria}
                  onChange={(e) => setUploadMateria(e.target.value)}
                  placeholder="Ex: Língua Portuguesa"
                  required
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>

            {msgSucesso && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{msgSucesso}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setModalUploadAberto(false)}
                disabled={enviando}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                disabled={enviando || !uploadArquivo}
              >
                {enviando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Enviando…
                  </>
                ) : (
                  "Concluir Upload"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Cartão pequeno de contagem no cabeçalho. */
function Stat({
  icone: Icone,
  rotulo,
  valor,
}: {
  icone: React.ComponentType<{ className?: string }>;
  rotulo: string;
  valor: number;
}) {
  return (
    <div className="flex min-w-[92px] items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <Icone className="h-4 w-4 shrink-0 text-cyan-400" />
      <div className="leading-none">
        <p className="text-sm font-extrabold text-white">{valor}</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          {rotulo}
        </p>
      </div>
    </div>
  );
}

/** Linha de uma apostila: metadados do DTO + ações de ler/baixar pela rota autenticada. */
function LinhaApostila({
  apostila,
  onAbrir,
}: {
  apostila: ApostilaDto;
  onAbrir: (apostila: ApostilaDto) => void;
}) {
  const podeLer =
    (apostila.mime_type ?? "") === "application/pdf" ||
    (apostila.mime_type ?? "") === "text/html" ||
    apostila.tipo === "html" ||
    apostila.arquivo_url.includes(".html");

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5",
        "transition-colors hover:border-cyan-500/30 hover:bg-white/[0.07]"
      )}
    >
      <FileText className="h-4 w-4 shrink-0 text-cyan-400" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{apostila.titulo}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
          <span>{apostila.concurso ?? "Concurso não informado"}</span>
          <span aria-hidden>·</span>
          <span>{apostila.materia_nome ?? SEM_MATERIA_NOME}</span>
          <span aria-hidden>·</span>
          <span>{formatarTamanho(apostila.tamanho_bytes)}</span>
          <span aria-hidden>·</span>
          <span>{formatarData(apostila.criado_em)}</span>
        </p>
      </div>

      <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
        {ROTULOS_STATUS[apostila.status]}
      </Badge>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => onAbrir(apostila)} disabled={!podeLer}>
          Ler
        </Button>
        <Button asChild size="sm" variant="outline" className="hover:border-cyan-500/50 hover:text-cyan-400">
          <a
            href={apostila.pdf_url || apostila.download_url || `/api/apostilas/download?id=${apostila.id}`}
            download
            title="Baixar Apostila Adaptada em PDF"
          >
            <Download className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}
