/**
 * FASE B1 - Solicitacao de recuperacao de senha (servico).
 *
 * O ponto central: generateLink nao envia e-mail. O servico passou a usar o metodo
 * oficial resetPasswordForEmail e so oferece o envio quando o ambiente confirma o
 * transporte. Nenhum e-mail, token ou mensagem crua do provedor chega ao log.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const warn = vi.fn();
const error = vi.fn();
const info = vi.fn();

vi.mock("@/lib/observability", () => ({
  logger: {
    debug: vi.fn(),
    info: (...args: unknown[]) => info(...args),
    warn: (...args: unknown[]) => warn(...args),
    error: (...args: unknown[]) => error(...args),
  },
}));

import {
  PASSWORD_RECOVERY_UNAVAILABLE,
  recoveryRedirectUrl,
  requestPasswordRecovery,
  resolveRecoveryTransportState,
} from "../password-recovery";

const EMAIL = "candidato@exemplo.test";

function baseEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    NEXT_PUBLIC_SUPABASE_URL: "https://testproject.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-de-teste",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000/",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveRecoveryTransportState", () => {
  it("bloqueia sem URL de Supabase configurada", () => {
    expect(resolveRecoveryTransportState(baseEnv({ NEXT_PUBLIC_SUPABASE_URL: "" }))).toStrictEqual({
      enabled: false,
      code: "SUPABASE_URL_NOT_CONFIGURED",
    });
  });

  it("bloqueia com o placeholder do schema de ambiente", () => {
    expect(
      resolveRecoveryTransportState(baseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co" }))
    ).toStrictEqual({ enabled: false, code: "SUPABASE_URL_NOT_CONFIGURED" });
  });

  it("bloqueia sem anon key ou com o placeholder dela", () => {
    expect(resolveRecoveryTransportState(baseEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: " " }))).toStrictEqual({
      enabled: false,
      code: "SUPABASE_ANON_KEY_NOT_CONFIGURED",
    });
    expect(
      resolveRecoveryTransportState(baseEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "missing-anon-key" }))
    ).toStrictEqual({ enabled: false, code: "SUPABASE_ANON_KEY_NOT_CONFIGURED" });
  });

  it("exige confirmacao explicita do transporte de e-mail", () => {
    expect(resolveRecoveryTransportState(baseEnv())).toStrictEqual({
      enabled: false,
      code: "PASSWORD_RECOVERY_NOT_ENABLED",
    });
    expect(resolveRecoveryTransportState(baseEnv({ PASSWORD_RECOVERY_ENABLED: "false" }))).toStrictEqual({
      enabled: false,
      code: "PASSWORD_RECOVERY_NOT_ENABLED",
    });
  });

  it("libera somente com credenciais reais e flag explicita", () => {
    expect(resolveRecoveryTransportState(baseEnv({ PASSWORD_RECOVERY_ENABLED: "TRUE" }))).toStrictEqual({
      enabled: true,
      code: "READY",
    });
  });
});

describe("recoveryRedirectUrl", () => {
  it("monta o destino da conclusao sem duplicar barra", () => {
    expect(recoveryRedirectUrl(baseEnv())).toBe("http://localhost:3000/redefinir-senha");
    expect(recoveryRedirectUrl(baseEnv({ NEXT_PUBLIC_APP_URL: "https://concursoai.com.br/" }))).toBe(
      "https://concursoai.com.br/redefinir-senha"
    );
  });

  it("cai para o appUrl publico quando o ambiente nao traz URL explicita", () => {
    expect(recoveryRedirectUrl(baseEnv({ NEXT_PUBLIC_APP_URL: "" })));
  });
});

describe("requestPasswordRecovery", () => {
  it("devolve unavailable sem tocar o provedor quando o transporte nao esta ativo", async () => {
    const createClient = vi.fn();
    const result = await requestPasswordRecovery({ email: EMAIL, env: baseEnv(), createClient });

    expect(result).toStrictEqual({
      status: "unavailable",
      code: PASSWORD_RECOVERY_UNAVAILABLE,
    });
    expect(createClient).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it("usa o metodo oficial de envio com o destino de conclusao", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    const result = await requestPasswordRecovery({
      email: EMAIL,
      env: baseEnv({ PASSWORD_RECOVERY_ENABLED: "true" }),
      createClient: () => ({ auth: { resetPasswordForEmail } }),
    });

    expect(result).toStrictEqual({ status: "accepted" });
    expect(resetPasswordForEmail).toHaveBeenCalledWith(EMAIL, {
      redirectTo: "http://localhost:3000/redefinir-senha",
    });
  });

  it("trata e-mail inexistente como aceito, sem revelar cadastro", async () => {
    const resetPasswordForEmail = vi
      .fn()
      .mockResolvedValue({ error: { message: "User not found" } });

    const result = await requestPasswordRecovery({
      email: EMAIL,
      env: baseEnv({ PASSWORD_RECOVERY_ENABLED: "true" }),
      createClient: () => ({ auth: { resetPasswordForEmail } }),
    });

    expect(result).toStrictEqual({ status: "accepted" });
  });

  it("engole falha de transporte e nao loga credencial nem endereco", async () => {
    const createClient = () => {
      throw new Error("connect ETIMEDOP postgres.candidate@exemplo.test:senha-secreta@db.supabase.co");
    };

    const result = await requestPasswordRecovery({
      email: EMAIL,
      env: baseEnv({ PASSWORD_RECOVERY_ENABLED: "true" }),
      createClient,
    });

    expect(result).toStrictEqual({ status: "accepted" });
    expect(error).toHaveBeenCalled();
    const logged = JSON.stringify([warn.mock.calls, error.mock.calls, info.mock.calls]);
    expect(logged).not.toContain("senha-secreta");
    expect(logged).not.toContain(EMAIL);
    expect(logged).not.toContain("ETIMEDOP");
  });
});
