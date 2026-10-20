/**
 * Testes do ApostilasService — "Minhas Apostilas" (Fase 1).
 * Repository e StorageAdapter são mockados: testa-se regra de negócio pura
 * (agrupamento, contagem N:M, posse, Range) sem banco nem disco (.ai/07).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockListByUser = vi.fn();
const mockFindOwnedById = vi.fn();
vi.mock("../../repositories/apostilas.repository", () => ({
  ApostilasRepository: {
    listByUser: (...args: unknown[]) => mockListByUser(...args),
    findOwnedById: (...args: unknown[]) => mockFindOwnedById(...args),
  },
}));

const mockGetStream = vi.fn();
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    driver: "local",
    getStream: (...args: unknown[]) => mockGetStream(...args),
  }),
}));

import {
  ApostilasService,
  agruparPorMateria,
  nomeArquivoDownload,
} from "../apostilas.service";
import type { ApostilaDto } from "@/lib/dto/apostilas.dto";

const USUARIO = "11111111-1111-4111-8111-111111111111";
const OUTRA = "22222222-2222-4222-8222-222222222222";
const APOSTILA = "33333333-3333-4333-8333-333333333333";
const FISICA = "44444444-4444-4444-8444-444444444444";
const PORTUGUES = "55555555-5555-4555-8555-555555555555";
const CAMINHO = `${USUARIO}/${APOSTILA}/apostila.pdf`;

function linha(overrides: Record<string, unknown> = {}) {
  return {
    id: APOSTILA,
    userId: USUARIO,
    type: "pdf",
    title: "Apostila CBM-RJ — Física",
    storagePath: CAMINHO,
    status: "indexed",
    fileSize: 1000,
    mimeType: "application/pdf",
    metadata: { concurso: "CBM-RJ 2026" },
    createdAt: new Date("2026-01-10T12:00:00.000Z"),
    subjectId: FISICA,
    subjectName: "Física",
    subjectColor: "#22d3ee",
    ...overrides,
  };
}

function dto(overrides: Partial<ApostilaDto> = {}): ApostilaDto {
  return {
    id: APOSTILA,
    titulo: "Apostila",
    tipo: "pdf",
    status: "indexed",
    tamanho_bytes: 10,
    mime_type: "application/pdf",
    concurso: "CBM-RJ 2026",
    materia_id: FISICA,
    materia_nome: "Física",
    materia_cor: "#22d3ee",
    arquivo_url: `/api/apostilas/${APOSTILA}/arquivo`,
    criado_em: "2026-01-10T12:00:00.000Z",
    ...overrides,
  };
}

function stream(overrides: Record<string, unknown> = {}) {
  return {
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("%PDF-"));
        controller.close();
      },
    }),
    contentLength: 1000,
    contentType: "application/pdf",
    etag: null,
    lastModified: new Date("2026-01-10T12:00:00.000Z"),
    partial: false,
    rangeStart: 0,
    rangeEnd: 999,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ApostilasService.listar", () => {
  it("agrupa por matéria e conta documentos DISTINTOS na associação N:M", async () => {
    mockListByUser.mockResolvedValue([
      linha({ subjectId: FISICA, subjectName: "Física" }),
      linha({ subjectId: PORTUGUES, subjectName: "Português" }),
    ]);

    const lista = await ApostilasService.listar({ userId: USUARIO });

    expect(lista.total_apostilas).toBe(1);
    expect(lista.total_materias).toBe(2);
    expect(lista.materias.map((grupo) => grupo.materia_nome)).toEqual(["Física", "Português"]);
    expect(lista.materias.every((grupo) => grupo.total === 1)).toBe(true);
    expect(mockListByUser).toHaveBeenCalledWith(USUARIO, { materiaId: undefined, busca: undefined });
  });

  it("não expõe storage_path nem o caminho físico no payload", async () => {
    mockListByUser.mockResolvedValue([linha()]);

    const lista = await ApostilasService.listar({ userId: USUARIO });
    const json = JSON.stringify(lista);

    expect(json).not.toContain("storage");
    expect(json).not.toContain(CAMINHO);
    expect(lista.materias[0].apostilas[0].arquivo_url).toBe(
      `/api/apostilas/${APOSTILA}/arquivo`
    );
  });

  it("filtra por concurso ignorando maiúsculas/minúsculas", async () => {
    mockListByUser.mockResolvedValue([
      linha(),
      linha({
        id: OUTRA,
        metadata: { concurso: "TRF 2025" },
        subjectId: PORTUGUES,
        subjectName: "Português",
      }),
    ]);

    const lista = await ApostilasService.listar({ userId: USUARIO, concurso: "cbm-rj 2026" });

    expect(lista.total_apostilas).toBe(1);
    expect(lista.concursos).toEqual(["CBM-RJ 2026"]);
  });

  it("empurra apostilas sem matéria para o último grupo", async () => {
    mockListByUser.mockResolvedValue([
      linha({ subjectId: null, subjectName: null, subjectColor: null }),
      linha({ id: OUTRA, subjectId: null, subjectName: null, subjectColor: null }),
    ]);

    const lista = await ApostilasService.listar({ userId: USUARIO });

    expect(lista.materias).toHaveLength(1);
    expect(lista.total_apostilas).toBe(2);
    expect(lista.materias[0].materia_nome).toBe("Sem matéria");
    expect(lista.materias[0].materia_id).toBe("sem-materia");
  });
});

describe("ApostilasService.abrirArquivo", () => {
  it("abre o arquivo do dono respeitando o Range pedido", async () => {
    mockFindOwnedById.mockResolvedValue(linha());
    mockGetStream.mockResolvedValue(stream({ partial: true, contentLength: 100 }));

    const resultado = await ApostilasService.abrirArquivo(USUARIO, APOSTILA, "bytes=0-99");

    expect(resultado?.status).toBe("ok");
    if (resultado?.status === "ok") {
      expect(resultado.range).toEqual({ start: 0, end: 99 });
      expect(resultado.arquivo.fileName).toBe("Apostila CBM-RJ — Física.pdf");
      expect(resultado.arquivo.mimeType).toBe("application/pdf");
    }
    expect(mockGetStream).toHaveBeenCalledWith(CAMINHO, { start: 0, end: 99 });
  });

  it("devolve range_nao_satisfeita quando o Range começa além do tamanho", async () => {
    mockFindOwnedById.mockResolvedValue(linha({ fileSize: 500 }));

    const resultado = await ApostilasService.abrirArquivo(USUARIO, APOSTILA, "bytes=900-1200");

    expect(resultado).toEqual({ status: "range_nao_satisfeita", tamanhoTotal: 500 });
    expect(mockGetStream).not.toHaveBeenCalled();
  });

  it("devolve null quando a apostila não pertence ao usuário", async () => {
    mockFindOwnedById.mockResolvedValue(null);

    const resultado = await ApostilasService.abrirArquivo(OUTRA, APOSTILA, null);

    expect(resultado).toBeNull();
    expect(mockFindOwnedById).toHaveBeenCalledWith(OUTRA, APOSTILA);
    expect(mockGetStream).not.toHaveBeenCalled();
  });
});

describe("funções puras do módulo apostilas", () => {
  it("agruparPorMateria deduplica a mesma apostila repetida no grupo", () => {
    const grupos = agruparPorMateria([dto(), dto(), dto({ id: OUTRA })]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].total).toBe(2);
    expect(grupos[0].materia_nome).toBe("Física");
  });

  it("nomeArquivoDownload neutraliza aspas/barras e não duplica a extensão", () => {
    expect(nomeArquivoDownload('a"/b\\c.pdf', "u/d/arquivo.pdf")).toBe("a b c.pdf");
    expect(nomeArquivoDownload("", "u/d/notas.txt")).toBe("apostila.txt");
    expect(nomeArquivoDownload("Matemática Básica", "u/d/arquivo.pdf")).toBe(
      "Matemática Básica.pdf"
    );
  });
});
