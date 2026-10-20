/**
 * ConcursoAI — DocumentService
 *
 * Ciclo de vida do agregado Document. A única operação que remove bytes do
 * storage é a deleção (ADR-011): soft delete da linha + remoção do objeto.
 *
 * Como o soft delete não dispara o ON DELETE CASCADE das FKs, as junções e os
 * chunks são limpos explicitamente — sem isso a apostila continuaria a aparecer
 * agrupada na matéria depois de apagada.
 *
 * Segue: specs/knowledge-apostilas.md, .ai/04-CODING-RULES.md, .ai/08-SECURITY-STANDARDS.md
 */
import { getStorage } from "@/lib/storage";
import { DocumentRepository } from "../repositories/document.repository";
import { DocumentChunkRepository } from "../repositories/chunk.repository";
import {
  DocumentSubjectRepository,
  DocumentTagRepository,
  DocumentTopicRepository,
} from "../repositories/junction.repository";

export interface RemoverDocumentoInput {
  userId: string;
  documentId: string;
}

/** `storagePath` nunca sai daqui — o DTO da rota não conhece a chave (.ai/08). */
export type RemoverDocumentoResultado =
  | { status: "removido"; bytesRemovidos: boolean }
  | { status: "nao_encontrado" };

export const DocumentService = {
  /**
   * Apaga um documento do usuário: linha (soft), vínculos, chunks e bytes.
   * Documento de outro usuário é tratado como inexistente (404, sem leak).
   */
  async remover(input: RemoverDocumentoInput): Promise<RemoverDocumentoResultado> {
    const documento = await DocumentRepository.findById(input.documentId);
    if (!documento || documento.userId !== input.userId) {
      return { status: "nao_encontrado" };
    }

    await DocumentRepository.softDelete(documento.id);
    await DocumentSubjectRepository.deleteByDocument(documento.id);
    await DocumentTopicRepository.deleteByDocument(documento.id);
    await DocumentTagRepository.deleteByDocument(documento.id);
    await DocumentChunkRepository.softDeleteByDocument(documento.id);

    // Melhor esforço: o registro já sumiu da listagem do usuário. Se o storage
    // falhar, `bytesRemovidos: false` sinaliza a limpeza pendente no log.
    try {
      await getStorage().delete(documento.storagePath);
      return { status: "removido", bytesRemovidos: true };
    } catch (erroStorage) {
      console.error("[documents] falha ao remover bytes do storage:", erroStorage);
      return { status: "removido", bytesRemovidos: false };
    }
  },
};
