import fs from "node:fs";
import path from "node:path";

export interface ApostilaPdfItem {
  aula: string;
  arquivo: string;
  id: string;
  titulo: string;
  materia?: string;
  tamanhoEsperado?: number;
}

export const APOSTILAS_PDF_CATALOG: ApostilaPdfItem[] = [
  {
    aula: "01",
    arquivo: "curso-384118-aula-01-f2d1-completo.pdf",
    id: "a0000000-0000-4000-8000-000000000001",
    titulo: "CBM-RJ | Português — Aula 01: Ortografia Oficial e Acentuação",
  },
  {
    aula: "02",
    arquivo: "curso-384118-aula-02-937a-completo.pdf",
    id: "45660fdc-4270-4b9c-949c-452aedb19088",
    titulo: "CBM-RJ | Português — Aula 02: Classes de Palavras I & Pronomes",
  },
  {
    aula: "03",
    arquivo: "curso-384118-aula-03-f129-completo.pdf",
    id: "7820a1bc-3184-472d-9a88-29471f000003",
    titulo: "CBM-RJ | Português — Aula 03: Classes de Palavras II — Verbos",
  },
  {
    aula: "04",
    arquivo: "curso-384118-aula-04-6fe6-completo.pdf",
    id: "9c381e4a-2510-410a-bf19-813471000004",
    titulo: "CBM-RJ | Português — Aula 04: Sintaxe do Período Simples",
  },
  {
    aula: "05",
    arquivo: "curso-384118-aula-05-5077-completo.pdf",
    id: "b4172f3e-8902-45a1-9a72-683100000005",
    titulo: "CBM-RJ | Português — Aula 05: Sintaxe do Período Composto",
  },
  {
    aula: "06",
    arquivo: "curso-384118-aula-06-15f7-completo.pdf",
    id: "c5283a4f-9013-46b2-a083-794200000006",
    titulo: "CBM-RJ | Português — Aula 06: Pontuação e Emprego da Crase",
  },
  {
    aula: "07",
    arquivo: "curso-384118-aula-07-3752-completo.pdf",
    id: "d6394b50-0124-47c3-b194-805300000007",
    titulo: "CBM-RJ | Português — Aula 07: Concordância Verbal e Nominal",
  },
  {
    aula: "08",
    arquivo: "curso-384118-aula-08-a7e5-completo.pdf",
    id: "e74a5c61-1235-48d4-c205-916400000008",
    titulo: "CBM-RJ | Português — Aula 08: Regência Verbal e Nominal",
  },
  {
    aula: "09",
    arquivo: "curso-384118-aula-09-a7c3-completo.pdf",
    id: "f85b6d72-2346-49e5-d316-027500000009",
    titulo: "CBM-RJ | Português — Aula 09: Semântica e Figuras de Linguagem",
  },
  {
    aula: "10",
    arquivo: "curso-384118-aula-10-8788-completo.pdf",
    id: "a96c7e83-3457-4af6-e427-138600000010",
    titulo: "CBM-RJ | Português — Aula 10: Coesão e Coerência Textual",
  },
  {
    aula: "11",
    arquivo: "curso-384118-aula-11-a3e2-completo.pdf",
    id: "ba7d8f94-4568-4b07-f538-249700000011",
    titulo: "CBM-RJ | Português — Aula 11: Tipologia e Gêneros Textuais",
  },
  {
    aula: "12",
    arquivo: "curso-384118-aula-12-2fe8-completo.pdf",
    id: "cb8e90a5-5679-4c18-a649-350800000012",
    titulo: "CBM-RJ | Português — Aula 12: Compreensão e Interpretação",
  },
  {
    aula: "13",
    arquivo: "curso-384118-aula-13-70e8-completo.pdf",
    id: "dc9fa1b6-6780-4d29-b750-461900000013",
    titulo: "CBM-RJ | Português — Aula 13: Redação Oficial (Presidência)",
    materia: "Língua Portuguesa",
  },
  // --- APOSTILAS DE MATEMÁTICA (AULAS 00 A 19) ---
  {
    aula: "00",
    arquivo: "curso-384822-aula-00-0b26-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000000",
    titulo: "CBM-RJ | Matemática — Aula 00: Conjuntos Numéricos",
    materia: "Matemática",
  },
  {
    aula: "01",
    arquivo: "curso-384822-aula-01-15f1-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000001",
    titulo: "CBM-RJ | Matemática — Aula 01: Operações Fundamentais & Situações Problemas & Expressões Numéricas",
    materia: "Matemática",
  },
  {
    aula: "02",
    arquivo: "curso-384822-aula-02-c597-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000002",
    titulo: "CBM-RJ | Matemática — Aula 02: Unidades de comprimento, massa, capacidade, área e volume & Unidade de Tempo",
    materia: "Matemática",
  },
  {
    aula: "03",
    arquivo: "curso-384822-aula-03-08e5-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000003",
    titulo: "CBM-RJ | Matemática — Aula 03: Frações & Razão e Proporção.",
    materia: "Matemática",
  },
  {
    aula: "04",
    arquivo: "curso-384822-aula-04-cd39-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000004",
    titulo: "CBM-RJ | Matemática — Aula 04: Regra de Três Simples & Regra de Três Composta",
    materia: "Matemática",
  },
  {
    aula: "05",
    arquivo: "curso-384822-aula-05-19a8-grifado.pdf",
    id: "m0000000-0000-4000-8000-000000000005",
    titulo: "CBM-RJ | Matemática — Aula 05: Porcentagem",
    materia: "Matemática",
  },
  {
    aula: "06",
    arquivo: "curso-384822-aula-06-fc03-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000006",
    titulo: "CBM-RJ | Matemática — Aula 06: Elementos de uma Operação de Juros. & Regime de Capitalização e Aspectos Conceituais. & Capitalização Simples - Aspectos Matemáticos.",
    materia: "Matemática",
  },
  {
    aula: "07",
    arquivo: "curso-384822-aula-07-06c6-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000007",
    titulo: "CBM-RJ | Matemática — Aula 07: Capitalização Composta - Aspectos Matemáticos. & Taxa Nominal e Efetiva. & Taxas Equivalentes.",
    materia: "Matemática",
  },
  {
    aula: "08",
    arquivo: "curso-384822-aula-08-47df-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000008",
    titulo: "CBM-RJ | Matemática — Aula 08: Equações de Primeiro Grau & Equações do Segundo Grau & Inequações de Primeiro Grau",
    materia: "Matemática",
  },
  {
    aula: "09",
    arquivo: "curso-384822-aula-09-2a3f-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000009",
    titulo: "CBM-RJ | Matemática — Aula 09: Introdução ao Estudo das Funções",
    materia: "Matemática",
  },
  {
    aula: "10",
    arquivo: "curso-384822-aula-10-c014-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000010",
    titulo: "CBM-RJ | Matemática — Aula 10: Domínio e Imagem & Coeficientes & Estudo dos Sinais",
    materia: "Matemática",
  },
  {
    aula: "11",
    arquivo: "curso-384822-aula-11-48f5-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000011",
    titulo: "CBM-RJ | Matemática — Aula 11: Forma Fatorada & Raízes por Soma e Produto & Vértice da Parábola",
    materia: "Matemática",
  },
  {
    aula: "12",
    arquivo: "curso-384822-aula-12-44a0-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000012",
    titulo: "CBM-RJ | Matemática — Aula 12: Função Exponencial",
    materia: "Matemática",
  },
  {
    aula: "13",
    arquivo: "curso-384822-aula-13-1f5c-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000013",
    titulo: "CBM-RJ | Matemática — Aula 13: Logaritmo & Função Logarítmica",
    materia: "Matemática",
  },
  {
    aula: "14",
    arquivo: "curso-384822-aula-14-1c1a-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000014",
    titulo: "CBM-RJ | Matemática — Aula 14: Sequências numéricas & Progressão Aritmética & Progressão Geométrica",
    materia: "Matemática",
  },
  {
    aula: "15",
    arquivo: "curso-384822-aula-15-c9c4-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000015",
    titulo: "CBM-RJ | Matemática — Aula 15: Noções Elementares. & Circunferência. & Triângulos.",
    materia: "Matemática",
  },
  {
    aula: "16",
    arquivo: "curso-384822-aula-16-2f1f-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000016",
    titulo: "CBM-RJ | Matemática — Aula 16: Noções Introdutórias de Geometria Espacial & Prisma. & Pirâmide.",
    materia: "Matemática",
  },
  {
    aula: "17",
    arquivo: "curso-384822-aula-17-8d2a-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000017",
    titulo: "CBM-RJ | Matemática — Aula 17: Trigonometria & Equações Trigonométricas & Inequações Trigonométricas",
    materia: "Matemática",
  },
  {
    aula: "18",
    arquivo: "curso-384822-aula-18-somente-em-pdf-e866-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000018",
    titulo: "CBM-RJ | Matemática — Aula 18: Geometria Espacial (Prismas, Pirâmides, Cilindros, Cones e Esferas)",
    materia: "Matemática",
  },
  {
    aula: "19",
    arquivo: "curso-384822-aula-19-f337-completo.pdf",
    id: "m0000000-0000-4000-8000-000000000019",
    titulo: "CBM-RJ | Matemática — Aula 19: Introdução Análise Combinatória. & Princípios Fundamentais de Contagem. & Fatorial de um Número Natural.",
    materia: "Matemática",
  },
];

export const DIR_ORIGEM_MATEMATICA = path.join(
  "H:",
  "Meu Drive",
  "plataforma de estudo",
  "cbm-rj",
  "matematica"
);

export const DIR_ORIGEM_APOSTILAS = path.join(
  "H:",
  "Meu Drive",
  "plataforma de estudo",
  "cbm-rj",
  "portugues",
  "apostila"
);

/**
 * Escaneia o acervo e sincroniza todos os 13 PDFs originais para public/apostilas.
 */
export function escanearDiretorios() {
  const dirDestino = path.join(process.cwd(), "public", "apostilas");
  if (!fs.existsSync(dirDestino)) {
    fs.mkdirSync(dirDestino, { recursive: true });
  }

  const statusCopia: Record<string, string> = {};

  for (const item of APOSTILAS_PDF_CATALOG) {
    const isMat = item.materia === "Matemática";
    const dirOrigem = isMat ? DIR_ORIGEM_MATEMATICA : DIR_ORIGEM_APOSTILAS;
    const src = path.join(dirOrigem, item.arquivo);
    const dest = path.join(dirDestino, item.arquivo);
    const destAlias = path.join(
      dirDestino,
      isMat ? `matematica-aula-${item.aula}.pdf` : `aula-${item.aula}.pdf`
    );

    try {
      if (fs.existsSync(src)) {
        const srcStat = fs.statSync(src);
        const precisaCopiar = !fs.existsSync(dest) || fs.statSync(dest).size !== srcStat.size;

        if (precisaCopiar) {
          fs.copyFileSync(src, dest);
          statusCopia[item.aula] = `copiado (${srcStat.size} bytes)`;
        } else {
          statusCopia[item.aula] = `ja_sincronizado (${srcStat.size} bytes)`;
        }

        // Garante também o alias limpo aula-XX.pdf
        if (!fs.existsSync(destAlias) || fs.statSync(destAlias).size !== srcStat.size) {
          try {
            fs.copyFileSync(src, destAlias);
          } catch (_) {}
        }
      } else if (fs.existsSync(dest)) {
        statusCopia[item.aula] = `presente_em_public (${fs.statSync(dest).size} bytes)`;
      } else {
        statusCopia[item.aula] = "nao_encontrado_em_H";
      }
    } catch (err: any) {
      statusCopia[item.aula] = `erro: ${err.message}`;
    }
  }

  const outPath = path.join(process.cwd(), "public", "scan-apostilas.json");
  const data = {
    dirApostilas: DIR_ORIGEM_APOSTILAS,
    statusCopia,
    timestamp: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("[scanner] Erro gravando scan-apostilas.json:", err);
  }

  return data;
}

/**
 * Resolve e retorna o caminho físico e nome para download do PDF original.
 */
export function obterInfoPdf(identificador: string): {
  filePath: string;
  downloadFileName: string;
  titulo: string;
  materia?: string;
  tamanhoBytes: number;
} | null {
  const limpo = identificador.trim().toLowerCase();

  // 1. Tenta achar no catálogo por aula, id ou arquivo
  let encontrado = APOSTILAS_PDF_CATALOG.find(
    (item) =>
      item.aula === limpo ||
      item.aula === limpo.padStart(2, "0") ||
      item.id.toLowerCase() === limpo ||
      item.arquivo.toLowerCase() === limpo ||
      item.arquivo.toLowerCase().includes(limpo)
  );

  // 2. Se for número direto (1..13)
  if (!encontrado) {
    const num = parseInt(limpo.replace(/\D/g, ""), 10);
    if (!isNaN(num) && num >= 1 && num <= 13) {
      const numStr = String(num).padStart(2, "0");
      encontrado = APOSTILAS_PDF_CATALOG.find((i) => i.aula === numStr);
    }
  }

  if (!encontrado) {
    return null;
  }

  // Verifica caminho em public/apostilas primeiro, depois H:\...
  const pathPublic = path.join(process.cwd(), "public", "apostilas", encontrado.arquivo);
  const dirOrigem = encontrado.materia === "Matemática" ? DIR_ORIGEM_MATEMATICA : DIR_ORIGEM_APOSTILAS;
  const pathDrive = path.join(dirOrigem, encontrado.arquivo);

  let targetPath = "";
  if (fs.existsSync(pathPublic)) {
    targetPath = pathPublic;
  } else if (fs.existsSync(pathDrive)) {
    // Copia para public sob demanda para ficar em cache
    try {
      fs.mkdirSync(path.dirname(pathPublic), { recursive: true });
      fs.copyFileSync(pathDrive, pathPublic);
      targetPath = pathPublic;
    } catch (_) {
      targetPath = pathDrive;
    }
  }

  if (!targetPath || !fs.existsSync(targetPath)) {
    return null;
  }

  const stat = fs.statSync(targetPath);
  return {
    filePath: targetPath,
    downloadFileName: encontrado.arquivo,
    titulo: encontrado.titulo,
    tamanhoBytes: stat.size,
  };
}

// Execução inicial automática (apenas em runtime de servidor, nunca em testes ou builds)
if (typeof window === "undefined" && process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  try {
    escanearDiretorios();
  } catch (e) {
    console.warn("[scanner] Erro auto-exec:", e);
  }
}
