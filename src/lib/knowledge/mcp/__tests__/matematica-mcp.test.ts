import { describe, expect, it } from "vitest";
import { apostilaMcpProvider } from "../providers/apostila-mcp";
import { DEMO_APOSTILAS_LISTA } from "@/lib/constants/demo-apostilas";
import { APOSTILAS_PDF_CATALOG, obterInfoPdf } from "@/lib/apostilas/scanner";

describe("Apostilas de Matemática & MCP", () => {
  const arquivosMatematica = [
    "curso-384822-aula-00-0b26-completo.pdf",
    "curso-384822-aula-01-15f1-completo.pdf",
    "curso-384822-aula-02-c597-completo.pdf",
    "curso-384822-aula-03-08e5-completo.pdf",
    "curso-384822-aula-04-cd39-completo.pdf",
    "curso-384822-aula-05-19a8-grifado.pdf",
    "curso-384822-aula-06-fc03-completo.pdf",
    "curso-384822-aula-07-06c6-completo.pdf",
    "curso-384822-aula-08-47df-completo.pdf",
    "curso-384822-aula-09-2a3f-completo.pdf",
    "curso-384822-aula-10-c014-completo.pdf",
    "curso-384822-aula-11-48f5-completo.pdf",
    "curso-384822-aula-12-44a0-completo.pdf",
    "curso-384822-aula-13-1f5c-completo.pdf",
    "curso-384822-aula-14-1c1a-completo.pdf",
    "curso-384822-aula-15-c9c4-completo.pdf",
    "curso-384822-aula-16-2f1f-completo.pdf",
    "curso-384822-aula-17-8d2a-completo.pdf",
    "curso-384822-aula-18-somente-em-pdf-e866-completo.pdf",
    "curso-384822-aula-19-f337-completo.pdf",
  ];

  it("todas as 20 apostilas de matemática são aceitas e planejadas pelo apostila-mcp", async () => {
    for (let i = 0; i < arquivosMatematica.length; i++) {
      const fileName = arquivosMatematica[i]!;
      const plan = await apostilaMcpProvider.plan({
        fileName,
        mimeType: "application/pdf",
        sizeBytes: 1024 * 1024 * 3,
        sha256: "0".repeat(64),
      });

      expect(plan.classification).toBe("supported");
      expect(plan.lessonOrder).toBe(i);

      if (fileName.includes("grifado")) {
        expect(plan.variant).toBe("grifado");
        expect(plan.indexedByDefault).toBe(false);
      } else {
        expect(plan.indexedByDefault).toBe(true);
      }
    }
  });

  it("DEMO_APOSTILAS_LISTA contém Matemática com as 20 aulas", () => {
    expect(DEMO_APOSTILAS_LISTA.total_materias).toBe(2);
    expect(DEMO_APOSTILAS_LISTA.total_apostilas).toBe(33);

    const mat = DEMO_APOSTILAS_LISTA.materias.find((m) => m.materia_nome === "Matemática");
    expect(mat).toBeDefined();
    expect(mat?.total).toBe(20);
    expect(mat?.apostilas).toHaveLength(20);

    for (let i = 0; i < 20; i++) {
      const num = String(i).padStart(2, "0");
      const a = mat?.apostilas.find((ap) => ap.arquivo_url.includes(`aula-${num}`));
      expect(a).toBeDefined();
      expect(a?.concurso).toBe("CBM-RJ");
      expect(a?.materia_nome).toBe("Matemática");
      expect(a?.pdf_url).toContain(`aula=${num}`);
    }
  });

  it("APOSTILAS_PDF_CATALOG cataloga as 20 apostilas de Matemática", () => {
    const matItems = APOSTILAS_PDF_CATALOG.filter((i) => i.materia === "Matemática");
    expect(matItems).toHaveLength(20);

    for (let i = 0; i < 20; i++) {
      const num = String(i).padStart(2, "0");
      const item = matItems.find((it) => it.aula === num);
      expect(item).toBeDefined();
      expect(item?.arquivo).toContain(`aula-${num}`);
    }
  });

  it("obterInfoPdf encontra as apostilas de matemática por ID", () => {
    const info00 = obterInfoPdf("m0000000-0000-4000-8000-000000000000");
    expect(info00).not.toBeNull();
    expect(info00?.downloadFileName).toContain("aula-00");

    const info19 = obterInfoPdf("m0000000-0000-4000-8000-000000000019");
    expect(info19).not.toBeNull();
    expect(info19?.downloadFileName).toContain("aula-19");
  });
});
