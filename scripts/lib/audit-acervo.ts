/**
 * Leitura do acervo pela mesma porta da tela (temporário, para conferir número
 * anunciado em teste). Uso: npx tsx --conditions=react-server scripts/lib/audit-acervo.ts
 */
import { CADERNOS } from "../../src/lib/questoes/cadernos";
import {
  aplicarFiltros,
  calcularPagina,
  contagemDaFaceta,
  lerFiltros,
  removerCopiasIdenticas,
} from "../../src/lib/questoes/cadernos";
import { carregarCaderno } from "../../src/lib/questoes/dados-caderno";

const caderno = CADERNOS[0]!;
const carga = carregarCaderno(caderno);
if (!carga) throw new Error("dataset ausente: MATERIAIS_DATASET_DIR não resolveu");

const acervo = removerCopiasIdenticas(carga.itens);

const dados = {
  linhas: carga.itens.length,
  descartadas: carga.descartadas.length,
  motivos: carga.descartadas.map((d) => `${d.id}: ${d.motivo}`),
  ausentes: carga.ausentes,
  distintas: acervo.itens.length,
  duplicatas: acervo.duplicatas,
  confiaveis: aplicarFiltros(acervo.itens, lerFiltros({ gabarito: "confiavel" })).length,
  semGabaritoConfiavel: acervo.semGabaritoConfiavel,
  quarentena: acervo.itens.filter((i) => i.questao.quarantined).length,
  disciplinas: contagemDaFaceta(acervo.itens, "disciplina"),
  assuntos: contagemDaFaceta(acervo.itens, "assunto").length,
  bancas: contagemDaFaceta(acervo.itens, "banca").length,
  topBancas: contagemDaFaceta(acervo.itens, "banca").slice(0, 5),
  semBanca: acervo.itens.filter((i) => !i.questao.banca).length,
  anos: contagemDaFaceta(acervo.itens, "ano").length,
  tipos: contagemDaFaceta(acervo.itens, "tipo"),
  porPagina: calcularPagina({}, acervo.itens.length).totalPaginas,
};
console.log(JSON.stringify(dados, null, 2));

