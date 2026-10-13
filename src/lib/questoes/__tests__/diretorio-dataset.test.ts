/**
 * Precedência do diretório do acervo.
 *
 * Este é o único lugar que decide qual variável de ambiente aponta os lotes, e
 * é lido por três consumidores (a tela, o guarda de importação e o script de
 * import). Se a ordem mudar aqui, muda para todos — e é exatamente por isto que
 * ela está travada em teste: quando cada um tinha sua própria leitura, configurar
 * só o nome genérico desligava 8 casos de importação em silêncio.
 */
import { describe, it, expect } from "vitest";

import {
  VARIAVEL_DATASET_GENERICA,
  VARIAVEL_DATASET_LEGADA,
  direcaoDataset,
} from "../diretorio-dataset";

describe("direcaoDataset", () => {
  it("a genérica tem precedência sobre a legada", () => {
    const diretorio = direcaoDataset({
      [VARIAVEL_DATASET_GENERICA]: "H:\\acervo",
      [VARIAVEL_DATASET_LEGADA]: "C:\\antigo",
    });
    expect(diretorio).toEqual({
      caminho: "H:\\acervo",
      variavel: VARIAVEL_DATASET_GENERICA,
    });
  });

  it("a legada continua valendo sozinha", () => {
    expect(direcaoDataset({ [VARIAVEL_DATASET_LEGADA]: "C:\\antigo" })).toEqual({
      caminho: "C:\\antigo",
      variavel: VARIAVEL_DATASET_LEGADA,
    });
  });

  it("vazio em branco não é diretório configurado", () => {
    expect(direcaoDataset({ [VARIAVEL_DATASET_GENERICA]: "   " })).toBeNull();
    expect(direcaoDataset({})).toBeNull();
  });

  it("não há caminho padrão embutido no código", () => {
    // Um literal de disco no tronco quebra `output: standalone` no build: o
    // file-tracing do Next tentaria copiar arquivo que só existe numa máquina.
    expect(direcaoDataset({})).toBeNull();
    expect(VARIAVEL_DATASET_GENERICA).toBe("MATERIAIS_DATASET_DIR");
  });
});
