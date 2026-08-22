/**
 * Testes do rate limit em POST /api/auth/recuperar-senha.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetRateLimitStore } from "@/lib/security/rate-limit";

const mockGenerateLink = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        generateLink: (...args: unknown[]) => mockGenerateLink(...args),
      },
    },
  }),
}));

// Evita carregar next-auth (que tem problema de resolução de `next/server`
// no Vitest com Next.js 16). A rota usa apiError/apiOk de @/lib/api/helpers,
// que importa @/lib/auth/auth.
vi.mock("@/lib/auth/auth", () => ({
  auth: async () => null,
}));

import { POST as postRecuperarSenha } from "@/app/api/auth/recuperar-senha/route";

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

describe("POST /api/auth/recuperar-senha (rate limit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStore();
    mockGenerateLink.mockResolvedValue({ error: null });
  });

  it("aceita requisição válida", async () => {
    const res = await postRecuperarSenha(req("foo@bar.com"));
    expect(res.status).toBe(200);
    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
  });

  it("rejeita e-mail inválido com 422", async () => {
    const res = await postRecuperarSenha(req("invalido"));
    expect(res.status).toBe(422);
    expect(mockGenerateLink).not.toHaveBeenCalled();
  });

  it("bloqueia após 3 tentativas para o mesmo e-mail (429)", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await postRecuperarSenha(req("foo@bar.com"));
      expect(res.status).toBe(200);
    }
    const blocked = await postRecuperarSenha(req("foo@bar.com"));
    expect(blocked.status).toBe(429);
    expect(mockGenerateLink).toHaveBeenCalledTimes(3);
  });

  it("bloqueia após 5 tentativas para o mesmo IP (429)", async () => {
    // 5 e-mails diferentes, mesmo IP.
    for (let i = 0; i < 5; i++) {
      const res = await postRecuperarSenha(req(`user${i}@bar.com`));
      expect(res.status).toBe(200);
    }
    const blocked = await postRecuperarSenha(req("outro@bar.com"));
    expect(blocked.status).toBe(429);
  });

  it("e-mails e IPs diferentes não bloqueiam", async () => {
    // 5 requisições com e-mails E IPs diferentes passam.
    for (let i = 0; i < 5; i++) {
      const res = await postRecuperarSenha(req(`user${i}@bar.com`, `10.0.0.${i}`));
      expect(res.status).toBe(200);
    }
  });
});
