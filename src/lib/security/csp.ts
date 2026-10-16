/**
 * Content-Security-Policy da aplicacao.
 *
 * Ate aqui o header so existia no Nginx de infra/, o que deixava o app sem
 * politica quando servido direto (next start, preview, Docker sem proxy). A
 * politica passa a nascer no proprio app e vale para qualquer caminho.
 *
 * Duas decisoes registradas de proposito:
 *   1. frame-ancestors usa self (e X-Frame-Options SAMEORIGIN): o visualizador
 *      da apostila embute a versao transformada em iframe da mesma origem, e
 *      deny quebraria a tela.
 *   2. Ate haver passagem de navegador confirmando cada origem usada em
 *      producao, o modo padrao e Report-Only. CSP_ENFORCE=true grava o header
 *      de aplicacao real.
 *
 * A passagem de navegador aconteceu no smoke da Aula 14 contra `next start`
 * (2026-10-13): as unicas origens bloqueadas eram as webfonts do Google, entao
 * elas estao declaradas abaixo. Qualquer origem nova precisa ser confirmada
 * por essa passada antes de entrar na politica.
 */

const SELF = "'self'";

/**
 * Origens de webfont confirmadas em navegador no build de producao
 * (smoke E2E da Aula 14, 2026-10-13). `src/app/globals.css` importa as duas
 * folhas de estilo do Google Fonts; sem elas o `style-src 'self'` bloqueia o
 * `@import`, o "Manrope" literal cai em sans-serif do sistema e o canvas do
 * matrix-rain perde o "Share Tech Mono". O CSS vem de fonts.googleapis.com e
 * os arquivos de fonte, de fonts.gstatic.com — sao diretivas distintas
 * (style-src vs font-src) e as duas precisam estar declaradas.
 */
const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com";
const GOOGLE_FONTS_FILES = "https://fonts.gstatic.com";

export interface CspOptions {
  development?: boolean;
}

export interface CspHeader {
  name: string;
  value: string;
}

/** Diretivas, montadas a partir de uma descricao de ambiente. */
export function buildCspDirectives(options: CspOptions = {}): Record<string, string[]> {
  const scriptSrc = [SELF, "'unsafe-inline'"];
  const styleSrc = [SELF, "'unsafe-inline'", GOOGLE_FONTS_CSS];
  const connectSrc = [SELF, "https://*.supabase.co", "https://*.r2.dev"];
  const directives: Record<string, string[]> = {
    "default-src": [SELF],
    "script-src": scriptSrc,
    "style-src": styleSrc,
    "img-src": [SELF, "data:", "blob:", "https://*.supabase.co", "https://*.r2.dev"],
    "font-src": [SELF, "data:", GOOGLE_FONTS_FILES],
    "connect-src": connectSrc,
    "object-src": ["'none'"],
    "base-uri": [SELF],
    "form-action": [SELF],
    "frame-ancestors": [SELF],
    "frame-src": [SELF],
  };

  if (options.development === true) {
    scriptSrc.push("'unsafe-eval'");
    connectSrc.push("ws:", "wss:");
  }

  return directives;
}

/** Serializa as diretivas em uma linha de header. */
export function buildCspHeaderValue(options: CspOptions = {}): string {
  const directives = buildCspDirectives(options);
  const parts = Object.keys(directives).map(function (key) {
    return key + " " + directives[key].join(" ") + ";";
  });
  parts.push("upgrade-insecure-requests;");
  return parts.join(" ");
}

/**
 * Header efetivo a partir do ambiente: Report-Only ate haver aplicacao real
 * confirmada em navegador; CSP_ENFORCE=true (ou producao sem CSP_REPORT_ONLY)
 * aplica de fato.
 */
export function buildCspHeader(env: NodeJS.ProcessEnv = process.env): CspHeader {
  const development = (env.NODE_ENV ?? "") === "development";
  const enforce =
    env.CSP_ENFORCE === "true" ||
    ((env.NODE_ENV ?? "") === "production" && env.CSP_REPORT_ONLY !== "true");
  return {
    name: enforce
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only",
    value: buildCspHeaderValue({ development }),
  };
}
