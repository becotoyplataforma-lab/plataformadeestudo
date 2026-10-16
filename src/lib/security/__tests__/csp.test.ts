/**
 * O CSP do app precisa continuar permitindo o iframe do visualizador (mesma
 * origem) e so valer de fato quando houver aplicacao confirmada em navegador.
 */
import { describe, expect, it } from "vitest";

import {
  buildCspDirectives,
  buildCspHeader,
  buildCspHeaderValue,
} from "../csp";

describe("Content-Security-Policy do app", () => {
  it("padrao e Report-Only, para nao quebrar a aplicacao por suposicao", () => {
    const header = buildCspHeader({ NODE_ENV: "test" } as NodeJS.ProcessEnv);
    expect(header.name).toBe("Content-Security-Policy-Report-Only");
  });

  it("CSP_ENFORCE=true aplica o header de verdade", () => {
    const header = buildCspHeader(
      { NODE_ENV: "test", CSP_ENFORCE: "true" } as NodeJS.ProcessEnv
    );
    expect(header.name).toBe("Content-Security-Policy");
  });

  it("producao aplica, salvo CSP_REPORT_ONLY explicito", () => {
    const enforce = buildCspHeader({ NODE_ENV: "production" } as NodeJS.ProcessEnv);
    expect(enforce.name).toBe("Content-Security-Policy");
    const reportOnly = buildCspHeader(
      { NODE_ENV: "production", CSP_REPORT_ONLY: "true" } as NodeJS.ProcessEnv
    );
    expect(reportOnly.name).toBe("Content-Security-Policy-Report-Only");
  });

  it("mantem o iframe do visualizador: frame-ancestors e self, nunca none", () => {
    const directives = buildCspDirectives();
    expect(directives["frame-ancestors"]).toEqual(["'self'"]);
    expect(directives["frame-src"]).toEqual(["'self'"]);
    const value = buildCspHeaderValue();
    expect(value).not.toContain("frame-ancestors 'none'");
    expect(value).toContain("object-src 'none';");
    expect(value).toContain("base-uri 'self';");
    expect(value).toContain("upgrade-insecure-requests;");
  });

  it("adiciona os extras de desenvolvimento sem poluir producao", () => {
    const dev = buildCspDirectives({ development: true });
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toContain("wss:");
    const prod = buildCspDirectives({ development: false });
    expect(prod["script-src"]).not.toContain("'unsafe-eval'");
    expect(prod["connect-src"]).not.toContain("ws:");
  });

  it("declara as origens externas de storage e auth", () => {
    const value = buildCspHeaderValue();
    expect(value).toContain("https://*.supabase.co");
    expect(value).toContain("https://*.r2.dev");
    expect(value).toContain("data:");
    expect(value).toContain("blob:");
  });

  /**
   * Producao aplica o CSP de verdade. Se as webfonts do Google sairem da
   * politica, o `@import` de src/app/globals.css e bloqueado em silencio: a
   * plataforma inteira perde o Manrope (cai em sans-serif do sistema) e o
   * matrix-rain perde o Share Tech Mono. O teste trava essa regressao.
   */
  it("declara as origens de webfont confirmadas na passada de navegador", () => {
    const directives = buildCspDirectives();
    expect(directives["style-src"]).toContain("https://fonts.googleapis.com");
    expect(directives["font-src"]).toContain("https://fonts.gstatic.com");

    const value = buildCspHeaderValue();
    expect(value).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;");
    expect(value).toContain("font-src 'self' data: https://fonts.gstatic.com;");
  });
});
