"use client";

/**
 * ConcursoAI — Leitor de Apostila (Fase 1)
 *
 * Suporta tanto visualização de PDFs quanto de apostilas interativas em HTML
 * (como a Matriz CBM-RJ Aula 01 com seções #s01 e resolução comentada).
 */
import * as React from "react";
import { AlertTriangle, Download, ExternalLink, Loader2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ApostilaLeitorProps {
  url: string;
  pdfUrl?: string;
  titulo: string;
  mimeType: string;
  tamanhoBytes: number | null;
}

const AVISO_TAMANHO_BYTES = 25 * 1024 * 1024;

function formatarTamanho(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "tamanho desconhecido";
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function ApostilaLeitor({
  url,
  pdfUrl,
  titulo,
  mimeType,
  tamanhoBytes,
}: ApostilaLeitorProps) {
  const [fonte, setFonte] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [carregando, setCarregando] = React.useState(true);

  const isHtml = mimeType === "text/html" || url.includes(".html");
  const linkDownloadPdf =
    pdfUrl ||
    (url.toLowerCase().endsWith(".pdf")
      ? url
      : `/api/apostilas/download?url=${encodeURIComponent(url)}`);

  React.useEffect(() => {
    // Se for HTML direto, não precisa converter para blob em memória
    if (isHtml) {
      setFonte(url);
      setCarregando(false);
      return;
    }

    let objetoUrl: string | null = null;
    let cancelado = false;
    const controller = new AbortController();

    async function carregar() {
      setCarregando(true);
      setErro(null);
      setFonte(null);

      try {
        const resposta = await fetch(url, { signal: controller.signal });

        if (!resposta.ok) {
          const mensagens: Record<number, string> = {
            401: "Sua sessão expirou. Faça login novamente.",
            404: "Esta apostila ainda não tem arquivo disponível.",
            416: "Não foi possível abrir o arquivo neste intervalo.",
            500: "Falha no servidor ao ler o arquivo.",
            502: "O armazenamento de arquivos está indisponível.",
          };
          setErro(mensagens[resposta.status] ?? "Não foi possível abrir esta apostila.");
          return;
        }

        const buffer = await resposta.arrayBuffer();
        if (cancelado) return;

        const blob = new Blob([buffer], { type: mimeType || "application/pdf" });
        objetoUrl = URL.createObjectURL(blob);
        setFonte(objetoUrl);
      } catch (error) {
        if (cancelado) return;
        console.error("[apostila-leitor] falha ao carregar:", error);
        setErro("Falha na conexão com o servidor.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void carregar();

    return () => {
      cancelado = true;
      controller.abort();
      if (objetoUrl) URL.revokeObjectURL(objetoUrl);
    };
  }, [url, mimeType, isHtml]);

  const muitoGrande = tamanhoBytes !== null && tamanhoBytes > AVISO_TAMANHO_BYTES;

  return (
    <div className="flex flex-col gap-3">
      {muitoGrande && !erro && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Arquivo grande ({formatarTamanho(tamanhoBytes)}). O download pode ser mais rápido que a
          leitura aqui.
        </p>
      )}

      {carregando && (
        <div className="flex h-[70vh] items-center justify-center rounded-xl border border-white/10 bg-white/5">
          <div className="flex flex-col items-center gap-2 text-slate-300">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Abrindo “{titulo}”…</p>
          </div>
        </div>
      )}

      {!carregando && erro && (
        <div className="flex h-[70vh] flex-col items-center justify-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-6 text-center">
          <AlertTriangle className="h-7 w-7 text-red-400" />
          <p className="text-sm font-semibold text-red-200">{erro}</p>
          <Button asChild variant="outline" size="sm">
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Tentar novamente
            </a>
          </Button>
        </div>
      )}

      {!carregando && fonte && (
        <>
          {isHtml ? (
            <iframe
              src={fonte}
              className="h-[75vh] w-full rounded-xl border border-white/10 bg-white shadow-inner"
              title={titulo}
            />
          ) : (
            <object
              data={fonte}
              type={mimeType || "application/pdf"}
              className="h-[70vh] w-full rounded-xl border border-white/10 bg-white"
              aria-label={titulo}
            >
              <div className="flex flex-col items-center gap-3 p-8 text-center text-sm text-slate-300">
                <p>Seu navegador não mostrou o PDF automaticamente.</p>
                <Button asChild size="sm">
                  <a href={fonte} download={`${titulo}.pdf`}>
                    <Download className="h-4 w-4" />
                    Baixar apostila
                  </a>
                </Button>
              </div>
            </object>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-xs text-slate-400">
              {formatarTamanho(tamanhoBytes)} · leitura completa no navegador com gabarito oficial e resolução comentada
            </p>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                <a href={url} target="_blank" rel="noreferrer">
                  <Maximize2 className="h-3.5 w-3.5" />
                  Abrir Leitor em Tela Cheia
                </a>
              </Button>
              <Button asChild size="sm" variant="secondary" className="h-8 gap-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-medium">
                <a href={linkDownloadPdf} download title="Baixar Apostila Adaptada em formato PDF">
                  <Download className="h-3.5 w-3.5" />
                  Baixar Apostila Adaptada (PDF)
                </a>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
