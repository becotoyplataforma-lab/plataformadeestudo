/**
 * ConcursoAI — Knowledge Services (barrel export)
 */
export { IngestionService, IngestionError } from "./ingestion.service";
export { DocumentService } from "./document.service";
export { MetadataService } from "./metadata.service";
export { ChunkService } from "./chunk.service";
export { EmbeddingService } from "./embedding.service";
export {
  ApostilasService,
  agruparPorMateria,
  extrairConcursos,
  nomeArquivoDownload,
} from "./apostilas.service";
export type {
  ListarApostilasInput,
  ApostilaArquivo,
  ApostilaLeitura,
} from "./apostilas.service";

export { HybridSearchService } from "./hybrid-search.service";
