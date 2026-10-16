/**
 * Testes de POST /api/auth/recuperar-senha.
 *
 * Cobertura: rate limit por e-mail e por IP, validacao de entrada, uso do metodo
 * oficial de envio (resetPasswordForEmail) e honestidade da resposta - o corpo nunca
 * revela se o e-mail existe nem traz link, token ou mensagem crua do provedor.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetRateLimitStore } from "@/lib/security/rate-limit";

const mockResetPasswordForEmail = vi.fn();
const mockCreateClient = vi.fn(() => ({
  auth: {
    resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => mockCreateClient(),
}));

// A rota usa apiError/apiOk de @/lib/api/helpers, que importa @/lib/auth/auth.
// O mock evita carregar next-auth (problema de resolucao de next/server no Vitest).
vi.mock("@/lib/auth/auth", () => ({
  auth: async () => null,
}));

import { POST as postRecuperarSenha } from "@/app/api/auth/recuperar-senha/route";

const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_APP_URL",
  "PASSWORD_RECOVERY_ENABLED",
] as const;

const snapshot: Record<string, string | undefined> = {};

function req(email: string, ip = "1.2.3.4"): Request {
  return new Request("http://localhost/api/auth/recuperar-senha", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({ email }),
  });
}

describe("POST /api/auth/recuperar-senha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStore();
    for (const key of ENV_KEYS) {
      snapshot[key] = process.env[key];
    }
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://testproject.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-de-teste";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.PASSWORD_RECOVERY_ENABLED = "true";
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = snapshot[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("aceita requisicao valida", async () => {
    const res = await postRecuperarSenha(req("foo@bar.com"));
    expect(res.status).toBe(200);
    expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);
  });

  it("pede o envio oficial com o destino de conclusao", async () => {
    await postRecuperarSenha(req("foo@bar.com"));
    const [email, options] = mockResetPasswordForEmail.mock.calls[0];
    expect(email).toBe("foo@bar.com");
    expect(options).toStrictEqual({ redirectTo: "http://localhost:3000/redefinir-senha" });
  });

  it("normaliza e-mail antes de enviar", async () => {
    await postRecuperarSenha(req("Foo@Bar.COM"));
    expect(mockResetPasswordForEmail.mock.calls[0][0]).toBe("foo@bar.com");
  });

  it("rejeita e-mail invalido com 422", async () => {
    const res = await postRecuperarSenha(req("invalido"));
    expect(res.status).toBe(422);
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("bloqueia apos 3 tentativas para o mesmo e-mail (429)", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await postRecuperarSenha(req("foo@bar.com"));
      expect(res.status).toBe(200);
    }
    const blocked = await postRecuperarSenha(req("foo@bar.com"));
    expect(blocked.status).toBe(429);
    expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(3);
  });

  it("bloqueia apos 5 tentativas para o mesmo IP (429)", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await postRecuperarSenha(req(`user${i}@bar.com`));
      expect(res.status).toBe(200);
    }
    const blocked = await postRecuperarSenha(req("outro@bar.com"));
    expect(blocked.status).toBe(429);
  });

  it("e-mails e IPs diferentes nao bloqueiam", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await postRecuperarSenha(req(`user${i}@bar.com`, `10.0.0.${i}`));
      expect(res.status).toBe(200);
    }
  });

  it("responde 503 sem tocar o provedor quando o transporte nao esta confirmado", async () => {
    delete process.env.PASSWORD_RECOVERY_ENABLED;
    const res = await postRecuperarSenha(req("foo@bar.com"));
    expect(res.status).toBe(503);
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.error).toContain("neste ambiente");
  });

  it("mesma resposta para e-mail existente ou nao: nada vaza para o cliente", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: "User not found" } });
    const found = await postRecuperarSenha(req("existe@bar.com", "10.1.1.1"));
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    const missing = await postRecuperarSenha(req("naoexiste@bar.com", "10.1.1.2"));

    expect(found.status).toBe(missing.status);
    expect(await found.json()).toStrictEqual(await missing.json());
  });

  it("falha de transporte nao devolve mensagem crua ao cliente", async () => {
    mockResetPasswordForEmail.mockRejectedValue(new Error("connect failed anon-key-de-teste"));
    const res = await postRecuperarSenha(req("foo@bar.com", "10.2.2.2"));
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("anon-key-de-teste");
    expect(text).not.toContain("connect failed");
  });
});
