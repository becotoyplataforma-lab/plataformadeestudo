"use client";

import * as React from "react";
import { Check, HardDrive } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Nota do aluno sobre a questão, guardada no próprio navegador.
 *
 * Não existe tabela de comentário no banco, e inventar uma aqui significaria
 * criar API de escrita numa tela que o smoke E2E verifica por zero POST. A
 * sanfona diz isso com todas as letras: o que for escrito é local e não
 * sincroniza com nada.
 *
 * `localStorage` é sistema externo, então a leitura vai por
 * `useSyncExternalStore` — não por `setState` dentro de `useEffect`, que
 * causaria um segundo render por card (e o lint do projeto barra isso). O
 * `getServerSnapshot` devolve string vazia: no servidor não há janela, e
 * renderizar a nota lida do disco do aluno produziria mismatch de hidratação.
 */

export function chaveDaNota(idLocal: string): string {
  return `questao-nota:${idLocal}`;
}

function lerNota(chave: string): string {
  try {
    return window.localStorage.getItem(chave) ?? "";
  } catch {
    // Modo privado / storage bloqueado: a tela continua usando o campo, só não
    // persiste. O aviso aparece quando o aluno tenta salvar.
    return "";
  }
}

function useNotaSalva(idLocal: string): string {
  const chave = React.useCallback(() => chaveDaNota(idLocal), [idLocal]);
  return React.useSyncExternalStore(
    React.useCallback(
      (onStoreChange) => {
        // O evento "storage" dispara nas OUTRAS abas; na mesma aba quem muda o
        // valor é o próprio botão Salvar, que já re-renderiza.
        const handler = (evento: StorageEvent) => {
          if (evento.key === chave()) onStoreChange();
        };
        window.addEventListener("storage", handler);
        return () => window.removeEventListener("storage", handler);
      },
      [chave]
    ),
    () => lerNota(chave()),
    () => ""
  );
}

export interface NotaDoAlunoProps {
  idLocal: string;
}

export function NotaDoAluno({ idLocal }: NotaDoAlunoProps) {
  const salva = useNotaSalva(idLocal);
  // Rascunho é o que o aluno está escrevendo agora; null significa "ainda não
  // editado", então o campo mostra o que está guardado.
  const [rascunho, setRascunho] = React.useState<string | null>(null);
  const [estado, setEstado] = React.useState<"idle" | "guardado" | "bloqueado">("idle");

  const valor = rascunho ?? salva;

  function salvar() {
    try {
      const chave = chaveDaNota(idLocal);
      if (valor.trim().length === 0) window.localStorage.removeItem(chave);
      else window.localStorage.setItem(chave, valor);
      setRascunho(null);
      setEstado(valor.trim().length === 0 ? "idle" : "guardado");
    } catch {
      setEstado("bloqueado");
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        aria-label="Sua nota sobre esta questão"
        value={valor}
        onChange={(evento) => {
          setRascunho(evento.target.value);
          setEstado("idle");
        }}
        rows={3}
        placeholder="Sua anotação fica só neste navegador."
        className="min-h-[72px] bg-muted/40 text-sm"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={salvar}>
          Salvar
        </Button>
        {estado === "guardado" && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            Salvo neste navegador
          </span>
        )}
        {estado === "bloqueado" && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-400">
            <HardDrive className="h-3.5 w-3.5" />
            Este navegador bloqueou armazenamento local; a nota não foi guardada.
          </span>
        )}
      </div>
      <p className="text-xs">
        Comentário de terceiros não é publicado: o espaço é seu. Nada aqui sobe
        para o banco nem aparece para outro aluno.
      </p>
    </div>
  );
}

export default NotaDoAluno;
