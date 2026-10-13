/**
 * ConcursoAI — Onde mora o acervo local (resolução pura de ambiente).
 *
 * Separado do carregador (`dados-caderno.ts`) porque este é conhecimento que
 * outros consumidores precisam sem arrastar `fs` nem `server-only`: o teste de
 * dry-run da importação e o script `scripts/importar-aula-14.ts`. Enquanto a
 * precedência morou dentro de um módulo de servidor, cada um desses lia só o
 * nome legado — e o guarda de importação passava a `describe.skip` silencioso
 * num ambiente configurado com o nome genérico. Precedência uma vez, no claro.
 *
 * `MATERIAIS_DATASET_DIR` é o nome atual; `QUESTOES_AULA14_DIR` continua aceita
 * porque o `.env.local` de quem já roda o projeto não precisa mudar. Sem valor
 * padrão embutido: caminho de máquina pertence ao ambiente, não ao código — um
 * literal `H:\...` no tronco já quebrou `output: standalone` no build.
 */

export const VARIAVEL_DATASET_GENERICA = "MATERIAIS_DATASET_DIR";
export const VARIAVEL_DATASET_LEGADA = "QUESTOES_AULA14_DIR";

export interface DirecaoDataset {
  caminho: string;
  /** Qual das duas variáveis produziu o caminho — para a tela dizer a origem. */
  variavel: string;
}

export function direcaoDataset(
  ambiente: Record<string, string | undefined> = process.env
): DirecaoDataset | null {
  const generica = ambiente[VARIAVEL_DATASET_GENERICA]?.trim();
  if (generica) return { caminho: generica, variavel: VARIAVEL_DATASET_GENERICA };
  const legado = ambiente[VARIAVEL_DATASET_LEGADA]?.trim();
  if (legado) return { caminho: legado, variavel: VARIAVEL_DATASET_LEGADA };
  return null;
}
