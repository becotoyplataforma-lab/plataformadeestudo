# EMBEDDING STANDARD

> Padrão oficial de embeddings da plataforma.
> Resolve a decisão aberta OPEN-001 (provedor e dimensão de vetor).
> Sem SQL, sem migrations. Base para a geração do schema SQL das tabelas vetoriais.

---

## PROVIDER

- Provedor oficial: BAAI/bge-m3.
- Suporta múltiplos idiomas (multi-language).
- Geração de embeddings por serviço dedicado no servidor.
- Provedor isolado em camada de integração (substituível sem alterar o domínio).
- OpenAI não é utilizado para embeddings.

## VECTOR DIMENSION

- Dimensão oficial do vetor: 1024.
- Coluna vetorial dimensionada em 1024.
- Aplicada a todas as coleções vetoriais da plataforma.
- Modelo e dimensão são constantes de configuração.

## CHUNKING

- Tamanho padrão do chunk: 1000 caracteres.
- Overlap padrão: 200 caracteres.
- Divisão por estrutura quando o documento permitir (artigos, seções, parágrafos).
- Metadados do chunk preservados (página, seção, documento).

## STORAGE

- Banco vetorial: pgvector (Supabase).
- Vetor armazenado em coluna de 1024 dimensões.
- Relação 1:1 entre chunk e vetor.
- Cadeia de ownership: chunk → documento → usuário.

## INDEXING

- Índice vetorial: HNSW.
- Métrica: cosine.
- Índice criado sobre a coluna vetorial.
- Índice acompanha a evolução da coleção.

## SEARCH STRATEGY

- Estratégia oficial: Hybrid Search.
- Combina busca vetorial (similaridade de embeddings) com busca textual
  (Full Text Search sobre o conteúdo).
- Resultado combinado com pesos configuráveis.
- Filtro por usuário antes da busca para escalar e garantir privacidade.

## PERFORMANCE

- Similaridade: Cosine Similarity.
- Embeddings gerados em lote.
- Busca filtra por usuário antes da similaridade.
- Limites de resultado (top-k) configuráveis.
- Cache de embeddings por conteúdo quando aplicável.

## LIMITATIONS

- Custo de memória do índice HNSW em volumes altos.
- Re-ranking ainda não disponível (previsto para futuro).
- Chunks de 1000 caracteres podem não ser ideais para todos os documentos.
- Overlap aumenta volume armazenado.
- Coluna de 1024 dimensões exige gerenciamento de tamanho da tabela.

## FUTURE EVOLUTION

- Re-ranking de resultados previsto para versões futuras.
- Avaliação de novos modelos de embedding.
- Possível quantização para reduzir custo.
- Migração para store vetorial dedicada somente se a escala exigir.
- Ajuste fino de chunking por tipo de documento.
