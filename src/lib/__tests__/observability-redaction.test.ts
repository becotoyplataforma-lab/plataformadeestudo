/**
 * FASE B2 - Redacao centralizada de credencial no log.
 *
 * O contrato e duplo: o texto enviado ao console nao pode carregar segredo e o
 * diagnostico util (escopo, nivel, codigo, medida) continua la. Nenhum teste toca
 * rede ou banco.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  REDACTED_PLACEHOLDER,
  logger,
  redactLogEntry,
  redactSecrets,
  safeErrorLog,
} from "../observability";

const SECRET = "senha-super-secreta";
const ANON_JWT =
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnopqrstuvwxyz0123456789";
const REF = "abcdefghijklmnopqrstuvwxyz".slice(0, 20);

describe("redactSecrets", () => {
  it("remove usuario e senha de string de conexao", () => {
    const out = redactSecrets("postgres://postgres:" + SECRET + "@db." + REF + ".supabase.co:5432/postgres");
    expect(out).not.toContain(SECRET);
    expect(out).toContain(REDACTED_PLACEHOLDER);
  });

  it("remove Bearer, api key, token, senha e cookie com valores", () => {
    const samples = [
      "Authorization: Bearer " + ANON_JWT,
      "x-api-key=AKIAIOSFODNN7EXAMPLE",
      "DEEPSEEK_API_KEY=" + SECRET,
      "{\"password\":\"" + SECRET + "\"}",
      "set-cookie: session=abc123; Path=/",
      "service_role_key: " + ANON_JWT,
    ];
    for (const sample of samples) {
      const out = redactSecrets(sample);
      expect(out, sample).not.toContain(SECRET);
      expect(out, sample).not.toContain(ANON_JWT);
      expect(out, sample).not.toContain("AKIAIOSFODNN7EXAMPLE");
    }
  });

  it("redige project ref de host Supabase", () => {
    const out = redactSecrets("falha em " + REF + ".supabase.co:5432");
    expect(out).not.toContain(REF);
  });

  it("preserva texto inofensivo e diagnostico", () => {
    const message = "upload falhou apos 3 tentativas";
    expect(redactSecrets(message)).toBe(message);
  });

  it("texto vazio volta vazio", () => {
    expect(redactSecrets("")).toBe("");
  });
});

describe("redactLogEntry", () => {
  it("redige chave cujo nome e segredo", () => {
    const clean = redactLogEntry({ SUPABASE_SERVICE_ROLE_KEY: ANON_JWT, userId: "u1" }, "ok");
    expect(clean.fields.SUPABASE_SERVICE_ROLE_KEY).toBe(REDACTED_PLACEHOLDER);
    expect(clean.fields.userId).toBe("u1");
  });

  it("desce um nivel em objetos e arrays", () => {
    const clean = redactLogEntry({
      meta: { api_key: SECRET, keep: 1 },
      list: [{ token: SECRET }, "nada"],
    }, "ok");
    const json = JSON.stringify(clean);
    expect(json).not.toContain(SECRET);
    expect(clean.fields.meta).toMatchObject({ keep: 1 });
    expect(clean.fields.list).toContainEqual("nada");
  });

  it("aceita Error sem despejar stack no log", () => {
    const clean = redactLogEntry({ err: new Error("postgres://user:" + SECRET + "@host/db") }, "falhou");
    expect(JSON.stringify(clean)).not.toContain(SECRET);
    expect(clean.fields.err).toHaveProperty("name", "Error");
  });
});

describe("logger", () => {
  const spies: Record<string, ReturnType<typeof vi.fn>> = {};

  beforeEach(() => {
    spies.log = vi.spyOn(console, "log").mockImplementation(() => {});
    spies.warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    spies.error = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emite JSON util sem credencial", () => {
    logger.error("rag", "provedor falhou", {
      model: "deepseek-chat",
      providerTimeMs: 120,
      Authorization: "Bearer " + ANON_JWT,
    });

    const line = spies.error.mock.calls[0][0] as string;
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed.level).toBe("error");
    expect(parsed.scope).toBe("rag");
    expect(parsed.message).toBe("provedor falhou");
    expect(parsed.model).toBe("deepseek-chat");
    expect(parsed.providerTimeMs).toBe(120);
    expect(line).not.toContain(ANON_JWT);
    expect(line).not.toContain(SECRET);
  });

  it("redige a propria mensagem quando ela carrega segredo", () => {
    logger.warn("storage", "upload recusado: api_key=" + SECRET);
    const line = spies.warn.mock.calls[0][0] as string;
    expect(line).not.toContain(SECRET);
  });
});

describe("safeErrorLog", () => {
  it("mantem nome e codigo de dominio, redige a mensagem", () => {
    const thrown = new Error("bucket documents: token=" + SECRET);
    thrown.name = "StorageError";
    (thrown as { code?: string }).code = "UPLOAD_FAILED";
    const summary = safeErrorLog(thrown);
    expect(summary.name).toBe("StorageError");
    expect(summary.code).toBe("UPLOAD_FAILED");
    expect(summary.message).not.toContain(SECRET);
  });

  it("trata erro nao-Error sem crash", () => {
    expect(safeErrorLog("string solta").message).toBe("string solta");
  });
});
