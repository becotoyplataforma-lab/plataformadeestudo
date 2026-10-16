/**
 * FASE B1 - Interpretacao do link de recuperacao (parte pura, sem rede).
 *
 * Cobre a validacao de token exigida pela conclusao da redefinio: tipo correto,
 * presenca de access e refresh token, erro trazido pelo provedor e forca da senha.
 */
import { describe, expect, it } from "vitest";

import {
  evaluateRecoveryLink,
  parseRecoveryHash,
  validateRecoveryPassword,
} from "../recovery-link";

describe("parseRecoveryHash", () => {
  it("aceita fragmento com ou sem # inicial", () => {
    const withHash = parseRecoveryHash("#access_token=abc&refresh_token=def&type=recovery");
    const withoutHash = parseRecoveryHash("access_token=abc&refresh_token=def&type=recovery");
    expect(withHash).toStrictEqual(withoutHash);
    expect(withHash.accessToken).toBe("abc");
    expect(withHash.refreshToken).toBe("def");
    expect(withHash.type).toBe("recovery");
  });

  it("fragmento vazio devolve objeto vazio", () => {
    expect(parseRecoveryHash("")).toStrictEqual({});
    expect(parseRecoveryHash("#")).toStrictEqual({});
  });

  it("mantem erro do provedor quando presente", () => {
    const parsed = parseRecoveryHash("#error=otp_expired&error_description=link+expirou");
    expect(parsed.error).toBe("otp_expired");
    expect(parsed.errorDescription).toBe("link expirou");
  });
});

describe("evaluateRecoveryLink", () => {
  it("aceita somente link recovery completo", () => {
    expect(
      evaluateRecoveryLink({
        accessToken: "a",
        refreshToken: "b",
        type: "recovery",
      })
    ).toStrictEqual({ valid: true, code: "READY" });
  });

  it("recusa link sem token, incompleto, de outro tipo ou com erro", () => {
    expect(evaluateRecoveryLink({})).toStrictEqual({ valid: false, code: "TOKEN_MISSING" });
    expect(
      evaluateRecoveryLink({ accessToken: "a", type: "recovery" })
    ).toStrictEqual({
      valid: false,
      code: "TOKEN_INCOMPLETE",
    });
    expect(
      evaluateRecoveryLink({
        accessToken: "a",
        refreshToken: "b",
        type: "magiclink",
      })
    ).toStrictEqual({
      valid: false,
      code: "NOT_A_RECOVERY_LINK",
    });
    expect(evaluateRecoveryLink({ error: "otp_badly_formatted" })).toStrictEqual({
      valid: false,
      code: "PROVIDER_ERROR",
    });
  });
});

describe("validateRecoveryPassword", () => {
  it("exige letras, numeros e tamanho minimo", () => {
    expect(validateRecoveryPassword("abc12345").ok).toBe(true);
    expect(validateRecoveryPassword("12345678").ok).toBe(false);
    expect(validateRecoveryPassword("abcdefgh").ok).toBe(false);
    expect(validateRecoveryPassword("a1").ok).toBe(false);
  });

  it("mensagem de erro e a do schema, nunca um detalhe interno", () => {
    expect(validateRecoveryPassword("12345678").message).toContain("letras");
    expect(validateRecoveryPassword("").message).toContain("8 caracteres");
  });
});
