/**
 * Leitura do acervo pela mesma porta da tela (temporário, para conferir número
 * anunciado em teste). Uso: npx tsx --conditions=react-server scripts/lib/audit-acervo.ts
 */
import { CADERNOS } from "../../src/lib/questoes/cadernos";
import {
  aplicarFiltros,
  calcularPagina,
  chipsDeFiltro,
  contagemDaFaceta,
  ehExercicioDeFixacao,
  lerFiltros,
  refinamentosDoContexto,
  removerCopiasIdenticas,
  semFaceta,
  totaisDasAbas,
} from "../../src/lib/questoes/cadernos";
import { carregarCaderno } from "../../src/lib/questoes/dados-caderno";

const caderno = CADERNOS[0]!;
const carga = carregarCaderno(caderno);
if (!carga) throw new Error("dataset ausente: MATERIAIS_DATASET_DIR não resolveu");

const acervo = removerCopiasIdenticas(carga.itens);
const padrao = lerFiltros({});

const dados = {
  linhas: carga.itens.length,
  descartadas: carga.descartadas.length,
  motivos: carga.descartadas.map((d) => `${d.id}: ${d.motivo}`),
  ausentes: carga.ausentes,
  distintas: acervo.itens.length,
  duplicatas: acervo.duplicatas,
  // O que a tela abre hoje: o padrão de qualidade, não o acervo inteiro.
  padrao: aplicarFiltros(acervo.itens, padrao).length,
  chipsDoPadrao: chipsDeFiltro(padrao),
  refinamentos: refinamentosDoContexto(acervo.itens, padrao),
  abas: totaisDasAbas(acervo.itens, padrao).map((a) => ({ aba: a.valor, total: a.total })),
  semGabaritoConfiavel: acervo.semGabaritoConfiavel,
  quarentena: acervo.itens.filter((i) => i.questao.quarantined).length,
  disciplinas: contagemDaFaceta(acervo.itens, "disciplina"),
  assuntos: contagemDaFaceta(acervo.itens, "assunto").length,
  bancas: contagemDaFaceta(acervo.itens, "banca").length,
  topBancas: contagemDaFaceta(acervo.itens, "banca").slice(0, 5),
  orgaos: contagemDaFaceta(acervo.itens, "orgao").length,
  cargos: contagemDaFaceta(acervo.itens, "cargo").length,
  topCargos: contagemDaFaceta(acervo.itens, "cargo").slice(0, 5),
  tipos: contagemDaFaceta(acervo.itens, "tipo"),
  anos: contagemDaFaceta(acervo.itens, "ano").length,
  // Lacunas declaradas: é o que trava filtro no desenho de referência (docs/31 §7.7).
  lacunas: {
    semBanca: semFaceta(acervo.itens, "banca"),
    semOrgao: semFaceta(acervo.itens, "orgao"),
    semCargo: semFaceta(acervo.itens, "cargo"),
    semAno: semFaceta(acervo.itens, "ano"),
    semNivel: acervo.itens.filter((i) => !i.questao.nivel).length,
    comExplicacao: acervo.itens.filter((i) => i.questao.explicacao !== null).length,
    soNaLista: acervo.itens.filter(ehExercicioDeFixacao).length,
  },
  porPagina: calcularPagina({}, aplicarFiltros(acervo.itens, padrao).length).totalPaginas,
};
console.log(JSON.stringify(dados, null, 2));

