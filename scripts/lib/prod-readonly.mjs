/**
 * ConcursoAI - Sessao read-only comprovada para scripts que leem producao.
 *
 * A confirmacao de ref (scripts/lib/db-safety.mjs) prova ONDE se vai ligar; isto prova
 * o QUE a sessao pode fazer. Em conjunto fecham os dois riscos dos scripts de auditoria
 * e diagnostico: acertar o projeto errado, e acabar a escrever por um SELECT que nao o
 * era ou por um erro de digitacao.
 *
 * O SET de sessao e silenciosamente ignorado por alguns poolers em modo transacao, por
 * isso o SHOW posterior e obrigatorio: se o servidor nao confirmar, aborta-se antes de
 * qualquer leitura. Falhar para o lado seguro, sempre.
 */

/** Valor esperado de default_transaction_read_only depois do SET. */
const READ_ONLY_ON = "on";

/**
 * Torna a sessao read-only e exige a confirmacao do servidor.
 *
 * @param sql handle do driver (postgres.js) ja conectado.
 * @returns o valor reportado pelo servidor, sempre "on".
 * @throws quando o destino nao accepta read-only ou nao responde.
 */
export async function assertReadOnlySession(sql) {
  if (!sql || typeof sql.unsafe !== "function") {
    throw new Error("assertReadOnlySession: handle sem metodo unsafe(); nada sera executado");
  }

  let reported = "";
  await sql.unsafe("SET default_transaction_read_only = on");
  const rows = await sql.unsafe("SHOW default_transaction_read_only");
  const first = Array.isArray(rows) && rows.length > 0 ? rows[0] : undefined;
  if (first && typeof first === "object") {
    const values = Object.values(first);
    reported = values.length > 0 ? String(values[0]).trim().toLowerCase() : "";
  }

  if (reported !== READ_ONLY_ON) {
    throw new Error(
      "a sessao nao ficou read-only (servidor reportou \"" + (reported || "nada") + "\"); nenhuma query sera executada",
    );
  }
  return reported;
}
