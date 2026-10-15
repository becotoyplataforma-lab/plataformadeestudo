/**
 * Testes do classificador dry-run do migrador R2 (puro, sem rede/banco).
 */
import { describe, it, expect } from "vitest";
import {
  classifyMigratorDoc,
  parseMigratorArgs,
  sha256Hex,
  sha256HexSync,
} from "@/lib/knowledge/storage/migrate-classifier";

describe("sha256Hex", () => {
  it("gera sha256 hex igual ao IngestionService (conteudo conhecido)", async () => {
    const buf = Buffer.from("conteudo-teste");
    const { createHash } = await import("node:crypto");
    const expected = createHash("sha256").update(buf).digest("hex");
    expect(sha256HexSync(buf)).toBe(expected);
    await expect(sha256Hex(buf)).resolves.toBe(expected);
  });
});

describe("parseMigratorArgs", () => {
  it("default: sem limite, batch 100, sem help, sem live", () => {
    expect(parseMigratorArgs([])).toEqual({
      limit: null,
      batchSize: 100,
      help: false,
      liveRequested: false,
    });
  });

  it("parseia --limit e --batch-size", () => {
    const r = parseMigratorArgs(["--limit=50", "--batch-size=25"]);
    expect(r.limit).toBe(50);
    expect(r.batchSize).toBe(25);
  });

  it("--dry-run explícito não ativa live", () => {
    expect(parseMigratorArgs(["--dry-run"]).liveRequested).toBe(false);
  });

  it("--live/--execute/--no-dry-run sinalizam tentativa de escrita (bloqueada)", () => {
    expect(parseMigratorArgs(["--live"]).liveRequested).toBe(true);
    expect(parseMigratorArgs(["--execute"]).liveRequested).toBe(true);
    expect(parseMigratorArgs(["--no-dry-run"]).liveRequested).toBe(true);
  });

  it("--help/-h", () => {
    expect(parseMigratorArgs(["--help"]).help).toBe(true);
    expect(parseMigratorArgs(["-h"]).help).toBe(true);
  });
});

describe("classifyMigratorDoc (dry-run)", () => {
  const baseDoc = {
    id: "doc-1",
    userId: "user-1",
    storagePath: "user-1/doc-1/apostila.pdf",
    storageBackend: "supabase",
  };

  it("ALREADY_R2 quando storage_backend=r2 (não baixa nada)", () => {
    const r = classifyMigratorDoc(
      { ...baseDoc, storageBackend: "r2" },
      { found: false }
    );
    expect(r.code).toBe("ALREADY_R2");
  });

  it("INVALID_METADATA quando id/userId/storagePath ausentes", () => {
    expect(
      classifyMigratorDoc({ ...baseDoc, id: null }, { found: true, buffer: Buffer.from("x") }).code
    ).toBe("INVALID_METADATA");
    expect(
      classifyMigratorDoc({ ...baseDoc, userId: "" }, { found: true, buffer: Buffer.from("x") }).code
    ).toBe("INVALID_METADATA");
    expect(
      classifyMigratorDoc({ ...baseDoc, storagePath: "  " }, { found: true, buffer: Buffer.from("x") }).code
    ).toBe("INVALID_METADATA");
  });

  it("SOURCE_NOT_FOUND quando objeto não existe no Supabase", () => {
    const r = classifyMigratorDoc(baseDoc, { found: false });
    expect(r.code).toBe("SOURCE_NOT_FOUND");
  });

  it("ERROR quando download falha (rede) ou buffer ausente", () => {
    expect(classifyMigratorDoc(baseDoc, { found: false, error: "timeout" }).code).toBe("ERROR");
    expect(classifyMigratorDoc(baseDoc, { found: true, buffer: null }).code).toBe("ERROR");
  });

  it("HASH_MISMATCH quando sha256 difere de file_hash", () => {
    const r = classifyMigratorDoc(
      { ...baseDoc, fileHash: "0".repeat(64), fileSize: 4 },
      { found: true, buffer: Buffer.from("abcd") }
    );
    expect(r.code).toBe("HASH_MISMATCH");
    expect(r.actualSize).toBe(4);
    expect(r.r2Key).toBeUndefined();
  });

  it("SIZE_MISMATCH quando tamanho difere de file_size (hash ok)", () => {
    const buf = Buffer.from("abcd");
    const hash = sha256HexSync(buf);
    const r = classifyMigratorDoc(
      { ...baseDoc, fileHash: hash, fileSize: 999 },
      { found: true, buffer: buf }
    );
    expect(r.code).toBe("SIZE_MISMATCH");
    expect(r.actualHash).toBe(hash);
  });

  it("WOULD_MIGRATE usa MESMO storage_path como r2Key (hash+tamanho ok)", () => {
    const buf = Buffer.from("conteudo");
    const hash = sha256HexSync(buf);
    const r = classifyMigratorDoc(
      { ...baseDoc, fileHash: hash, fileSize: buf.length },
      { found: true, buffer: buf }
    );
    expect(r.code).toBe("WOULD_MIGRATE");
    expect(r.r2Key).toBe("user-1/doc-1/apostila.pdf");
  });

  it("WOULD_MIGRATE quando file_hash/file_size ausentes (sem o que comparar)", () => {
    const r = classifyMigratorDoc(
      { ...baseDoc, fileHash: null, fileSize: null },
      { found: true, buffer: Buffer.from("qualquer") }
    );
    expect(r.code).toBe("WOULD_MIGRATE");
  });
});
