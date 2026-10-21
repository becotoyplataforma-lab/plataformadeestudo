import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

import {
  CADERNOS,
  cadernoPorSlug,
  itensDeMenu,
  resolverRef,
  removerCopiasIdenticas,
  type ItemCaderno,
} from "../cadernos";
import { ehIdLocalValido } from "../rotas";
import type { QuestaoExtraida } from "../procedencia";

describe("Caderno de Matemática", () => {
  const mat = cadernoPorSlug("matematica");

  it("caderno está registrado no catálogo com identidade limpa", () => {
    expect(mat).toBeDefined();
    expect(mat?.slug).toBe("matematica");
    expect(mat?.materia).toBe("Matemática");
    expect(mat?.titulo).toBe("Matemática · Banco de Questões");
    expect(mat?.subtitulo).toContain("Caderno de treino de Matemática");
    expect(mat?.lotes).toHaveLength(1);
    expect(mat?.lotes[0]?.arquivo).toBe("questoes_matematica.json");
    expect(mat?.lotes[0]?.origem).toBe("curso-384822");
  });

  it("resolverRef resolve 'matematica' diretamente", () => {
    const resolvido = resolverRef("matematica");
    expect(resolvido).toEqual({ tipo: "caderno", caderno: mat });
  });

  it("itensDeMenu inclui Português e Matemática", () => {
    const menu = itensDeMenu();
    expect(menu).toHaveLength(2);
    expect(menu.map((m) => m.href)).toEqual([
      "/questoes/portugues",
      "/questoes/matematica",
    ]);
    expect(menu.map((m) => m.label)).toEqual([
      "Português · Banco de Questões",
      "Matemática · Banco de Questões",
    ]);
    expect(menu.every((m) => m.badge === "Revisão")).toBe(true);
  });

  it("arquivo físico questoes_matematica.json é íntegro e cobre todas as 20 aulas", () => {
    const caminho = join(process.cwd(), "dataset", "questoes", "questoes_matematica.json");
    const bruto = readFileSync(caminho, "utf-8");
    const questoes: QuestaoExtraida[] = JSON.parse(bruto);

    expect(questoes.length).toBeGreaterThanOrEqual(1500);

    const aulas = new Set<number>();
    const bancas = new Set<string>();
    const assuntos = new Set<string>();

    for (const q of questoes) {
      // 1. Contrato de segurança: explicação de terceiro nunca viaja no artefato
      expect(q.explicacao).toBeNull();

      // 2. Formato do id_local
      expect(ehIdLocalValido(q.id_local)).toBe(true);

      // 3. Enunciado presente
      expect(typeof q.enunciado).toBe("string");
      expect(q.enunciado.length).toBeGreaterThan(0);

      // 4. Alternativas presentes
      expect(typeof q.alternativas).toBe("object");
      expect(Object.keys(q.alternativas).length).toBeGreaterThanOrEqual(2);

      // 5. Gabarito letra A-E ou null
      if (q.gabarito !== null) {
        expect(q.gabarito).toMatch(/^[A-E]$/);
      }

      aulas.add(q.aula);
      if (q.banca) bancas.add(q.banca);
      if (q.assunto) assuntos.add(q.assunto);
    }

    // Cobriu as 20 aulas: de 0 a 19
    for (let aula = 0; aula <= 19; aula++) {
      expect(aulas.has(aula)).toBe(true);
    }

    // Variedade de bancas e assuntos
    expect(bancas.size).toBeGreaterThanOrEqual(10);
    expect(assuntos.size).toBeGreaterThanOrEqual(20);

    // Deduplicação canônica funciona
    const lote = mat!.lotes[0]!;
    const itens: ItemCaderno[] = questoes.map((questao) => ({ questao, lote }));
    const distinto = removerCopiasIdenticas(itens);
    expect(distinto.itens.length).toBeGreaterThan(0);
    expect(distinto.semGabaritoConfiavel).toBeLessThan(100);
  }, 20000);
});
