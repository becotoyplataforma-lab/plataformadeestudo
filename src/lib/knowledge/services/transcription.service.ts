/**
 * ConcursoAI — TranscriptionService (Item 9 do guia admin — STUB)
 *
 * Ponto de integração para transcrição de áudio/vídeo (Whisper ou similar).
 * HOJE NÃO há serviço configurado: a plataforma rejeita upload de mídia no
 * IngestionService (allowlist de MIME) e, caso um documento com
 * `metadata.media_type` chegue ao pipeline, ele é marcado como
 * `transcription_needed` e falha com status claro — nunca "funciona" em silêncio.
 *
 * Para ativar:
 *   1. Adicionar tipos de mídia ao ALLOWED_MIME_TYPES do IngestionService e um
 *      valor no document_type enum (ex.: "audio"/"video") via migration.
 *   2. Implementar `transcribe(buffer, mimeType)` aqui (Whisper local,
 *      OpenAI API, Deepgram, etc.) e conectar no DocumentPipelineService
 *      antes do ChunkService (áudio → texto → chunks).
 *   3. Configurar credenciais no .env (ex.: WHISPER_API_URL/KEY).
 *
 * Segue a mesma filosofia da geração de vídeo/avatar: arquitetura preparada,
 * serviço externo pendente (bloqueio real, não silencioso).
 */
import "server-only";

export class TranscriptionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "TranscriptionError";
    this.code = code;
  }
}

export const TranscriptionService = {
  /** Indica se há um serviço de transcrição configurado. */
  isConfigured(): boolean {
    return Boolean(process.env.WHISPER_API_URL);
  },

  /**
   * Transcreve áudio/vídeo para texto. Stub: lança erro claro quando não
   * configurado, para que o pipeline nunca finja sucesso.
   */
  async transcribe(buffer: Buffer, mimeType: string): Promise<string> {
    const note = `Transcrição de áudio/vídeo (${mimeType}, ${buffer.byteLength} bytes) requer serviço externo (Whisper) não configurado.`;
    if (!this.isConfigured()) {
      throw new TranscriptionError("TRANSCRIPTION_NOT_CONFIGURED", note);
    }
    // TODO: implementar integração real (Whisper/OpenAI/Deepgram) aqui.
    throw new TranscriptionError(
      "NOT_IMPLEMENTED",
      "Integração de transcrição ainda não implementada."
    );
  },
};
