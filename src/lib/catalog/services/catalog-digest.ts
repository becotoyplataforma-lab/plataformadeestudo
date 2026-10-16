/**
 * CatalogDigest (FASE 5) - unica implementacao de SHA-256 do dominio catalogo.
 *
 * Este modulo existe para desfazer um acoplamento que a FASE 4 deixou embutido: o hash
 * do texto analisado morava dentro de `source-validator.service.ts`, que tambem importa
 * o extrator de documentos (`mammoth`, via DocumentExtractionService). A aprovacao da
 * FASE 5 precisa exatamente do mesmo hash, mas nao precisa de parser de documento nenhum.
 * Entao o helper sobe para ca e os dois lados passam a depender deste modulo - nunca um
 * do outro.
 *
 * Grafo autorizado:
 *   catalog-digest.ts  <-  source-validator.service.ts
 *   catalog-digest.ts  <-  catalog-approval.service.ts
 * Proibido de proposito:
 *   catalog-approval.service.ts  ->  source-validator.service.ts  (arrastaria mammoth)
 *
 * Puro por construcao: sem filesystem, sem rede, sem banco, sem ambiente, sem relogio.
 * `string` e lido como UTF-8 (padrao do Node), portanto o resultado e byte a byte o mesmo
 * que a FASE 4 ja produzia: mover o helper NAO altera `analysisDigest`, `proposalId`,
 * `proposalDigest` nem `approvalId`. `Buffer` entra sem conversao porque `Uint8Array` o
 * cobre, e a assinatura fica identica a anterior para nao quebrar consumo externo.
 */
import "server-only";
import { createHash } from "node:crypto";

/** SHA-256 deterministico, hexadecimal minusculo, sempre 64 caracteres. */
export function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}